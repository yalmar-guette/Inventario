import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, AlertCircle, Loader2, Fingerprint, ShieldCheck, ShieldOff, X } from 'lucide-react';
import {
    isBiometricAvailable,
    hasBiometricCredential,
    registerBiometric,
    authenticateWithBiometric,
    clearBiometricCredential,
} from '../hooks/useBiometricAuth';
import { supabase } from '../supabase';

// ── Modal: "¿Guardar inicio de sesión?" ──────────────────────────────────────
const BiometricPromptModal = ({ onAccept, onDecline }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
    >
        <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
        >
            {/* Icono */}
            <div className="pt-8 pb-2 flex justify-center">
                <div className="w-20 h-20 rounded-3xl bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800 flex items-center justify-center">
                    <Fingerprint size={40} className="text-primary-600 dark:text-primary-400" />
                </div>
            </div>

            {/* Texto */}
            <div className="px-8 py-4 text-center">
                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                    ¿Guardar inicio de sesión?
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                    La próxima vez puedes entrar sin contraseña usando{' '}
                    <span className="font-bold text-primary-600 dark:text-primary-400">
                        Face ID, huella dactilar o el PIN
                    </span>{' '}
                    de tu dispositivo.
                </p>
            </div>

            {/* Botones */}
            <div className="px-6 pb-8 pt-2 space-y-3">
                <button
                    onClick={onAccept}
                    className="w-full py-4 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-primary-200 dark:shadow-none flex items-center justify-center gap-3"
                >
                    <ShieldCheck size={20} />
                    Sí, guardar con biometría
                </button>
                <button
                    onClick={onDecline}
                    className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-600 dark:text-slate-400 font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                    <ShieldOff size={18} />
                    No, solo esta vez
                </button>
            </div>
        </motion.div>
    </motion.div>
);

// ── Componente principal ─────────────────────────────────────────────────────
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [bioLoading, setBioLoading] = useState(false);
    const { login, currentUser } = useAuth();
    const navigate = useNavigate();
    const [justLoggedOut, setJustLoggedOut] = useState(false);

    // Estado biometría
    const [bioAvailable, setBioAvailable] = useState(false);
    const [bioSaved, setBioSaved] = useState(false);
    const [showBioPrompt, setShowBioPrompt] = useState(false);
    const [pendingSession, setPendingSession] = useState(null); // { userId, refreshToken }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('loggedOut')) {
            setJustLoggedOut(true);
            window.history.replaceState({}, document.title, '/login');
        }
        // Verificar soporte y credencial guardada
        isBiometricAvailable().then((ok) => {
            setBioAvailable(ok);
            if (ok) setBioSaved(hasBiometricCredential());
        });
    }, []);

    useEffect(() => {
        if (currentUser && !showBioPrompt) navigate('/');
    }, [currentUser, navigate, showBioPrompt]);

    // ── Login normal ─────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const cleanEmail = email.trim();
        const cleanPassword = password.trim();
        if (!cleanEmail || !cleanPassword) {
            setError('Por favor completa todos los campos');
            return;
        }
        setLoading(true);
        try {
            const session = await login(cleanEmail, cleanPassword);
            // Si biometría disponible y no guardada aún → preguntar
            if (bioAvailable && !bioSaved) {
                const { data } = await supabase.auth.getSession();
                if (data?.session?.refresh_token && data?.session?.user?.id) {
                    setPendingSession({
                        userId: data.session.user.id,
                        refreshToken: data.session.refresh_token,
                    });
                    setShowBioPrompt(true);
                    setLoading(false);
                    return;
                }
            }
            navigate('/');
        } catch (err) {
            console.error('Login error:', err);
            let msg = 'Error al iniciar sesión. Verifica tu información.';
            if (err.message === 'Invalid login credentials') msg = 'Credenciales incorrectas. Verifica tu correo y contraseña.';
            else if (err.message === 'Email not confirmed') msg = 'El correo electrónico no ha sido confirmado aún.';
            else if (err.message === 'Too many requests') msg = 'Demasiados intentos. Intenta de nuevo más tarde.';
            else if (err.message) msg = `Error: ${err.message}`;
            setError(msg);
            setLoading(false);
        }
    };

    // ── Aceptar guardar biometría ────────────────────────────────────────────
    const handleBioAccept = async () => {
        if (!pendingSession) return;
        try {
            await registerBiometric(pendingSession.userId, pendingSession.refreshToken);
            setBioSaved(true);
        } catch (err) {
            console.warn('Error registrando biometría:', err);
        } finally {
            setShowBioPrompt(false);
            setPendingSession(null);
            navigate('/');
        }
    };

    const handleBioDecline = () => {
        setShowBioPrompt(false);
        setPendingSession(null);
        navigate('/');
    };

    // ── Login con biometría ──────────────────────────────────────────────────
    const handleBioLogin = async () => {
        setError('');
        setBioLoading(true);
        try {
            const refreshToken = await authenticateWithBiometric();
            const { data, error: refreshErr } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
            if (refreshErr) throw refreshErr;
            if (!data?.session) throw new Error('No se pudo restaurar la sesión');
            // Supabase actualiza el estado de auth automáticamente → navigate via useEffect
        } catch (err) {
            console.error('Bio login error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Autenticación cancelada o no reconocida.');
            } else if (err.message?.includes('sesión')) {
                // Credencial caducada → limpiar
                clearBiometricCredential();
                setBioSaved(false);
                setError('La sesión guardada expiró. Inicia sesión normalmente.');
            } else {
                setError('No se pudo verificar la identidad. Intenta con contraseña.');
            }
        } finally {
            setBioLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-stone-50 dark:bg-slate-950 transition-colors duration-500">
            {/* Left Side - Image */}
            <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary-950/20 dark:bg-slate-950/40 z-10 transition-colors" />
                <img
                    src="/login_lifestyle_warm_1768270649037.png"
                    alt="Lifestyle Abstract"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 p-12 z-20 text-white">
                    <h2 className="text-4xl font-black mb-4 uppercase tracking-tight leading-none">
                        Gestión Inteligente, <br />
                        <span className="text-primary-400">Trato Humano.</span>
                    </h2>
                    <p className="text-white/80 text-lg max-w-md font-medium">
                        Tu sistema de confianza para mantener todo en orden, sin complicaciones.
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md space-y-8"
                >
                    <div className="text-center lg:text-left">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-3xl flex items-center justify-center mb-8 mx-auto lg:mx-0 text-primary-600 dark:text-primary-400 transition-colors border border-primary-50 dark:border-primary-800">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white transition-colors">
                            ¡Qué bueno verte! 👋
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg font-medium">
                            Ingresa para administrar tu bodega
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-3xl flex items-center gap-4 text-xs font-black uppercase tracking-widest border border-red-100 dark:border-red-900/30">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    {/* Logged out notice */}
                    {justLoggedOut && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center gap-4 text-xs font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800"
                        >
                            <AlertCircle size={20} className="rotate-180" />
                            Sesión cerrada. ¡Vuelve pronto!
                        </motion.div>
                    )}

                    {/* ── Botón de biometría (si ya está guardada) ── */}
                    {bioSaved && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <button
                                onClick={handleBioLogin}
                                disabled={bioLoading}
                                className="w-full py-5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest rounded-3xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 border border-slate-700 dark:border-slate-600 group disabled:opacity-70"
                            >
                                {bioLoading ? (
                                    <Loader2 size={22} className="animate-spin" />
                                ) : (
                                    <Fingerprint size={22} className="group-hover:scale-110 transition-transform" />
                                )}
                                {bioLoading ? 'Verificando...' : 'Entrar con Face ID / Huella'}
                            </button>

                            <div className="flex items-center gap-3 my-6">
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                                    o usa tu contraseña
                                </span>
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                            </div>
                        </motion.div>
                    )}

                    {/* ── Formulario normal ── */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                                Correo Electrónico
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-600 group-focus-within:text-primary-500 transition-colors pointer-events-none" />
                                <input
                                    type="email"
                                    className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                                    placeholder="tu@correo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                                Contraseña
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-600 group-focus-within:text-primary-500 transition-colors pointer-events-none" />
                                <input
                                    type="password"
                                    className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-primary-600 dark:bg-primary-500 hover:bg-primary-700 dark:hover:bg-primary-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-3xl shadow-xl shadow-primary-200 dark:shadow-none hover:shadow-2xl hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                        >
                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Ingresar al Sistema'}
                        </button>
                    </form>

                    {/* Quitar credencial guardada */}
                    {bioSaved && (
                        <button
                            onClick={() => { clearBiometricCredential(); setBioSaved(false); }}
                            className="w-full text-center text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <X size={12} />
                            Quitar inicio de sesión guardado
                        </button>
                    )}

                    <p className="text-center text-slate-400 dark:text-slate-600 text-[10px] font-black uppercase tracking-widest pt-2">
                        ¿Olvidaste tu contraseña?{' '}
                        <span className="text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">
                            Recuperar acceso
                        </span>
                    </p>
                </motion.div>
            </div>

            {/* Modal biometría */}
            <AnimatePresence>
                {showBioPrompt && (
                    <BiometricPromptModal
                        onAccept={handleBioAccept}
                        onDecline={handleBioDecline}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Login;
