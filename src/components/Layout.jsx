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
    Circle
} from 'lucide-react';

const Layout = () => {
    const { currentUser, userRole, logout } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
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
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar con Glassmorphism - Escritorio */}
            <aside className="hidden md:flex flex-col w-64 glass-sidebar">
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
                            <span className="text-lg font-bold text-slate-900 block">Bodega</span>
                            <span className="text-xs text-slate-500 uppercase tracking-wide">Sistema POS</span>
                        </div>
                    </div>
                </div>

                {/* Navegación */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all group ${isActive
                                    ? 'bg-primary-50 text-primary-700 font-medium shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'} />
                                    <span className="text-sm">{item.name}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Perfil de Usuario con Tarjeta Glassmorphism */}
                <div className="p-4 border-t border-slate-200/60">
                    <div className="bg-slate-50/50 backdrop-blur-sm rounded-2xl p-3 mb-3">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 font-semibold text-sm">
                                {currentUser?.email?.substring(0, 2).toUpperCase() || 'US'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{currentUser?.email}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-soft"></div>
                                    <p className="text-xs text-slate-500 uppercase">{userRole}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <LogOut size={16} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Contenido Principal */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Cabecera Móvil */}
                <div className="md:hidden flex items-center justify-between p-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white font-bold shadow-lg">
                            B
                        </div>
                        <span className="font-bold text-slate-900">Bodega</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
                        {isMobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden absolute inset-0 z-50 bg-white/95 backdrop-blur-xl flex flex-col p-6"
                    >
                        <div className="flex justify-end mb-8">
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-600">
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
                                            ? 'bg-primary-50 text-primary-700 font-medium'
                                            : 'text-slate-600'
                                        }`
                                    }
                                >
                                    <item.icon size={24} />
                                    <span>{item.name}</span>
                                </NavLink>
                            ))}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-4 px-4 py-3 rounded-2xl text-base text-red-600 w-full mt-8"
                            >
                                <LogOut size={24} />
                                <span>Cerrar Sesión</span>
                            </button>
                        </nav>
                    </motion.div>
                )}

                {/* Page Content */}
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
