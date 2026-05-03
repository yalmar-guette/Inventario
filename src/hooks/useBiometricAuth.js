/**
 * useBiometricAuth.js
 * ───────────────────
 * Hook para registrar y autenticar con WebAuthn (Face ID / Huella / PIN).
 *
 * Estrategia: guarda las credenciales (email + password) en localStorage
 * "protegidas" por la verificación WebAuthn del dispositivo.
 * Al autenticar, primero pide biometría al dispositivo; si pasa,
 * devuelve email+password para hacer un login fresco con Supabase.
 *
 * Esto evita el problema del refresh_token que expira rápidamente.
 */

const RP_NAME    = 'Gestión de Inventario';
const CRED_KEY   = 'bio_cred_id';
const EMAIL_KEY  = 'bio_email';
const PASS_KEY   = 'bio_pass';

// ── Helpers base64 ───────────────────────────────────────────────────────────

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

// ── API pública ──────────────────────────────────────────────────────────────

/** Comprueba si el dispositivo tiene sensor biométrico/PIN disponible */
export const isBiometricAvailable = async () => {
    if (!window.PublicKeyCredential) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
};

/** Devuelve true si ya hay una credencial registrada en este dispositivo */
export const hasBiometricCredential = () =>
    !!localStorage.getItem(CRED_KEY) &&
    !!localStorage.getItem(EMAIL_KEY) &&
    !!localStorage.getItem(PASS_KEY);

/**
 * Registra biometría tras un login exitoso.
 * @param {string} userId       - UID del usuario (para WebAuthn)
 * @param {string} email        - Email con el que se loguea
 * @param {string} password     - Password en texto plano (se guarda en localStorage)
 */
export const registerBiometric = async (userId, email, password) => {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId8 = new TextEncoder().encode(userId.substring(0, 64));

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: { name: RP_NAME },
            user: {
                id: userId8,
                name: email,
                displayName: email,
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },   // ES256
                { type: 'public-key', alg: -257 },  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'preferred',
            },
            timeout: 60000,
        },
    });

    localStorage.setItem(CRED_KEY,  bufferToB64(credential.rawId));
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(PASS_KEY,  password);

    return true;
};

/**
 * Pide al dispositivo que verifique la biometría.
 * Si es exitosa, devuelve { email, password } para hacer un login fresco.
 */
export const authenticateWithBiometric = async () => {
    const credIdB64 = localStorage.getItem(CRED_KEY);
    if (!credIdB64) throw new Error('No hay credencial registrada');

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Esto dispara el sensor del dispositivo (huella / Face ID / PIN)
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

    // Si llegamos aquí, el dispositivo verificó la identidad
    const email    = localStorage.getItem(EMAIL_KEY);
    const password = localStorage.getItem(PASS_KEY);
    if (!email || !password) throw new Error('No hay sesión guardada');

    return { email, password };
};

/** Elimina todos los datos biométricos guardados */
export const clearBiometricCredential = () => {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(PASS_KEY);
};
