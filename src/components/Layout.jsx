import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    FileText,
    Settings,
    LogOut,
    Menu,
    X,
    Circle,
    Moon,
    Sun
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Layout = () => {
    const { currentUser, userRole, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        // Mostrar la animación de despedida por 1.5 segundos antes de invalidar la sesión
        setTimeout(async () => {
            try {
                await logout();
                navigate('/login?loggedOut=true');
            } catch (error) {
                console.error("Failed to log out", error);
                setIsLoggingOut(false);
            }
        }, 1500);
    };

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['OWNER', 'EMPLOYEE'] },
        { name: 'Registrar Ventas', path: '/pos', icon: ShoppingCart, roles: ['OWNER', 'EMPLOYEE'] },
        { name: 'Inventario', path: '/inventory', icon: Package, roles: ['OWNER', 'EMPLOYEE'] },
        { name: 'Deudores', path: '/debtors', icon: Users, roles: ['OWNER', 'EMPLOYEE'] },
        { name: 'Reportes', path: '/reports', icon: FileText, roles: ['OWNER', 'EMPLOYEE'] },
        { name: 'Configuración', path: '/settings', icon: Settings, roles: ['OWNER'] },
    ];

    const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

    return (
        <div className={`flex h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-300 overflow-hidden`}>
            {/* Sidebar con Glassmorphism - Escritorio */}
            <aside className="hidden md:flex flex-col w-64 glass-sidebar transition-colors duration-300">
                {/* Logo con estado pulsante */}
                <div className="p-6 border-b border-slate-200/60">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-200">
                                B
                            </div>
                            {/* Pulso de Estado Online */}
                            <div className="absolute -top-1 -right-1 w-3 h-3">
                                <Circle className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                                <Circle className="w-3 h-3 fill-emerald-500 text-emerald-500 absolute inset-0 animate-ping opacity-75" />
                            </div>
                        </div>
                        <div>
                            <span className="text-lg font-bold text-slate-900 dark:text-white block transition-colors">Bodega</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide transition-colors">Sistema POS</span>
                        </div>
                    </div>
                    {/* Dark Mode Toggle Desktop */}
                    <button
                        onClick={toggleTheme}
                        className="mt-6 w-full flex items-center justify-between px-4 py-2.5 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 transition-all duration-300 group"
                    >
                        <div className="flex items-center gap-3">
                            {theme === 'light' ? (
                                <>
                                    <Moon size={18} className="text-slate-600" />
                                    <span className="text-sm font-medium text-slate-600">Modo Oscuro</span>
                                </>
                            ) : (
                                <>
                                    <Sun size={18} className="text-amber-400" />
                                    <span className="text-sm font-medium text-slate-300">Modo Claro</span>
                                </>
                            )}
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${theme === 'dark' ? 'bg-primary-500' : 'bg-slate-300'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 ${theme === 'dark' ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
                        </div>
                    </button>
                </div>

                {/* Navegación */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all group ${isActive
                                    ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={20} className={isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
                                    <span className="text-sm">{item.name}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Perfil de Usuario con Tarjeta Glassmorphism */}
                <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 transition-colors">
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-3 mb-3 border border-slate-100 dark:border-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors">
                                {((currentUser?.email || 'US').substring(0, 2)).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate transition-colors">{currentUser?.email}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-soft"></div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase transition-colors">{userRole}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                        <LogOut size={16} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Contenido Principal */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Cabecera Móvil — padding-top maneja el notch/Dynamic Island */}
                <div
                    className="md:hidden flex items-center justify-between px-4 pb-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800 transition-colors"
                    style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white font-bold shadow-lg">
                            B
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white transition-colors">Bodega</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 transition-all"
                        >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-amber-400" />}
                        </button>
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 dark:text-slate-400">
                            {isMobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden absolute inset-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl flex flex-col p-6"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white font-bold shadow-lg">
                                    B
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">Bodega</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-600 dark:text-slate-400">
                                <X size={28} />
                            </button>
                        </div>
                        <nav className="space-y-2">
                            {filteredNavItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-4 px-4 py-3 rounded-2xl text-base ${isActive
                                            ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium'
                                            : 'text-slate-600 dark:text-slate-400'
                                        }`
                                    }
                                >
                                    <item.icon size={24} />
                                    <span>{item.name}</span>
                                </NavLink>
                            ))}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-4 px-4 py-3 rounded-2xl text-base text-red-600 dark:text-red-400 w-full mt-8"
                            >
                                <LogOut size={24} />
                                <span>Cerrar Sesión</span>
                            </button>
                        </nav>
                    </motion.div>
                )}

                {/* Page Content */}
                <div className="flex-1 overflow-auto flex flex-col">
                    <div className="flex-1">
                        <Outlet />
                    </div>

                    {/* Footer Profesional Global */}
                    <footer className="py-8 border-t border-slate-200/60 bg-white dark:bg-slate-900 transition-colors mt-auto">
                        <div className="flex flex-col items-center gap-4 text-center px-4">
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                                © 2026 Sistema de Inventario. Todos los derechos reservados.
                            </p>
                            <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md hover:border-primary-100 dark:hover:border-primary-900 group">
                                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Desarrollado por</span>
                                <span className="text-primary-600 dark:text-primary-400 font-black text-sm group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">Yalmar Guette</span>
                                <div className="w-10 h-10 rounded-full border-2 border-primary-100 dark:border-primary-900 p-0.5 shadow-sm overflow-hidden group-hover:border-primary-200 dark:group-hover:border-primary-800 group-hover:scale-110 transition-all duration-300">
                                    <img
                                        src="/yalmar-profile.png"
                                        alt="Yalmar Guette"
                                        className="w-full h-full object-cover rounded-full"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            const parent = e.target.parentElement;
                                            if (parent) {
                                                parent.innerHTML = '<div class="w-full h-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold text-xs">YG</div>';
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </footer>
                </div>
            </main>

            {/* Overlay de Cierre de Sesión */}
            {isLoggingOut && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-500"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center"
                    >
                        <div className="w-24 h-24 mx-auto mb-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-xl">
                            <LogOut className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-pulse" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Cerrando sesión</h2>
                        <p className="text-slate-500 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">Hasta pronto 👋</p>
                    </motion.div>
                </motion.div>
            )}
        </div>
    );
};

export default Layout;
