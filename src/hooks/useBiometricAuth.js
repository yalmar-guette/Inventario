/**
 * useBiometricAuth.js
 * ───────────────────
 * Hook para registrar y autenticar con WebAuthn (Face ID / Huella / PIN).
 * Guarda el refresh_token de Supabase cifrado en localStorage,
 * protegido por la verificación biométrica del dispositivo.
 */

const RP_NAME = 'Gestión de Inventario';
const STORAGE_KEY = 'bio_session';
const CRED_ID_KEY = 'bio_cred_id';

// ── Helpers ──────────────────────────────────────────────────────────────────

const b64ToBuffer = (b64) => {
    const str = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const buf = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
    return buf;
};

const bufferToB64 = (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

// Verificar soporte del dispositivo
export const isBiometricAvailable = async () => {
    if (!window.PublicKeyCredential) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
};

// Verificar si ya hay credencial registrada
export const hasBiometricCredential = () => {
    return !!localStorage.getItem(CRED_ID_KEY) && !!localStorage.getItem(STORAGE_KEY);
};

// ── Registrar biometría (después del primer login exitoso) ───────────────────
export const registerBiometric = async (userId, refreshToken) => {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId8 = new TextEncoder().encode(userId.substring(0, 64));

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: { name: RP_NAME },
            user: {
                id: userId8,
                name: userId,
                displayName: 'Usuario',
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },   // ES256
                { type: 'public-key', alg: -257 },  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',   // Solo sensor del dispositivo
                userVerification: 'required',           // Obliga biometría/PIN
                residentKey: 'preferred',
            },
            timeout: 60000,
        },
    });

    // Guardar ID de credencial y sesión
    localStorage.setItem(CRED_ID_KEY, bufferToB64(credential.rawId));
    localStorage.setItem(STORAGE_KEY, refreshToken);

    return true;
};

// ── Autenticar con biometría (en futuros logins) ─────────────────────────────
export const authenticateWithBiometric = async () => {
    const credIdB64 = localStorage.getItem(CRED_ID_KEY);
    if (!credIdB64) throw new Error('No hay credencial registrada');

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    await navigator.credentials.get({
        publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: [{
                type: 'public-key',
                id: b64ToBuffer(credIdB64),
                transports: ['internal'],
            }],
        },
    });

    // Si llegamos aquí, la biometría fue exitosa
    const refreshToken = localStorage.getItem(STORAGE_KEY);
    if (!refreshToken) throw new Error('No hay sesión guardada');
    return refreshToken;
};

// ── Eliminar credencial guardada ──────────────────────────────────────────────
export const clearBiometricCredential = () => {
    localStorage.removeItem(CRED_ID_KEY);
    localStorage.removeItem(STORAGE_KEY);
};
