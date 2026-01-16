import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, currentUser } = useAuth();
    const navigate = useNavigate();
    const [justLoggedOut, setJustLoggedOut] = useState(false);

    useEffect(() => {
        // Diagnóstico: Verificar URL de Supabase cargada
        console.log("Conectando a:", import.meta.env.VITE_SUPABASE_URL);

        const params = new URLSearchParams(window.location.search);
        if (params.get('loggedOut')) {
            setJustLoggedOut(true);
            // Limpiar el parámetro de la URL sin recargar
            window.history.replaceState({}, document.title, "/login");
        }
    }, []);

    useEffect(() => {
        if (currentUser) {
            navigate('/');
        }
    }, [currentUser, navigate]);

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
            await login(cleanEmail, cleanPassword);
            // La navegación ahora es manejada por el useEffect cuando cambia currentUser
        } catch (error) {
            console.error('Login error:', error);

            // Traducir algunos errores comunes de Supabase
            let errorMsg = 'Error al iniciar sesión. Verifica tu información.';

            if (error.message === 'Invalid login credentials') {
                errorMsg = 'Credenciales incorrectas. Verifica tu correo y contraseña.';
            } else if (error.message === 'Email not confirmed') {
                errorMsg = 'El correo electrónico no ha sido confirmado aún.';
            } else if (error.message === 'Too many requests') {
                errorMsg = 'Demasiados intentos. Intenta de nuevo más tarde.';
            } else if (error.message) {
                // Si es un error desconocido, lo mostramos traducido si es posible o el original
                errorMsg = `Error: ${error.message}`;
            }

            setError(errorMsg);
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-stone-50 dark:bg-slate-950 transition-colors duration-500">
            {/* Left Side - Image */}
            <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary-950/20 dark:bg-slate-950/40 z-10 transition-colors"></div>
                <img
                    src="/login_lifestyle_warm_1768270649037.png"
                    alt="Lifestyle Abstract"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 p-12 z-20 text-white">
                    <h2 className="text-4xl font-black mb-4 uppercase tracking-tight leading-none">Gestión Inteligente, <br /><span className="text-primary-400">Trato Humano.</span></h2>
                    <p className="text-white/80 text-lg max-w-md font-medium">Tu sistema de confianza para mantener todo en orden, sin complicaciones.</p>
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
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white transition-colors">¡Qué bueno verte! 👋</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg font-medium">Ingresa para administrar tu bodega</p>
                    </div>

                    {error && (
                        <div className="p-5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-3xl flex items-center gap-4 text-xs font-black uppercase tracking-widest border border-red-100 dark:border-red-900/30 animate-shake">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

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

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">Correo Electrónico</label>
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
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">Contraseña</label>
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

                    <p className="text-center text-slate-400 dark:text-slate-600 text-[10px] font-black uppercase tracking-widest pt-4">
                        ¿Olvidaste tu contraseña? <span className="text-primary-600 dark:text-primary-400 cursor-pointer hover:underline">Recuperar acceso</span>
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
