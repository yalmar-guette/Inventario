import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Por favor completa todos los campos');
            return;
        }

        if (!email.includes('@')) {
            setError('Por favor ingresa un correo electrónico válido');
            return;
        }

        setLoading(true);

        try {
            await login(email, password);
            navigate('/');
        } catch (error) {
            console.error('Login error:', error);

            switch (error.code) {
                case 'auth/user-not-found':
                    setError('❌ No existe una cuenta con este correo electrónico');
                    break;
                case 'auth/wrong-password':
                    setError('❌ Contraseña incorrecta. Por favor intenta de nuevo');
                    break;
                case 'auth/invalid-email':
                    setError('❌ Formato de correo electrónico inválido');
                    break;
                case 'auth/user-disabled':
                    setError('❌ Esta cuenta ha sido desactivada. Contacta al administrador');
                    break;
                case 'auth/too-many-requests':
                    setError('⚠️ Demasiados intentos fallidos. Intenta más tarde');
                    break;
                case 'auth/network-request-failed':
                    setError('🌐 Error de conexión. Verifica tu internet');
                    break;
                case 'auth/invalid-credential':
                    setError('❌ Credenciales incorrectas. Verifica tu usuario y contraseña');
                    break;
                default:
                    setError('❌ Error al iniciar sesión. Intenta nuevamente');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            {/* Subtle gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-200/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
                            <Lock className="w-7 h-7 text-white" />
                        </div>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900">Bienvenido</h2>
                        <p className="text-slate-500 mt-2 text-sm">Sistema Administrativo Bodega</p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <span className="text-sm text-red-700">{error}</span>
                        </motion.div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400 transition-all"
                                    placeholder="admin@bodega.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400 transition-all"
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
                            className="w-full px-5 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center gap-2 justify-center text-base"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Iniciando sesión...
                                </>
                            ) : (
                                'Ingresar'
                            )}
                        </button>
                    </form>

                    {/* Demo credentials */}
                    <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-600 text-center">
                            <span className="font-semibold block mb-1">Cuenta Demo</span>
                            <span className="text-slate-500">admin@bodega.com / admin123</span>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
