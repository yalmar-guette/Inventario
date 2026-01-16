import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
    TrendingUp,
    DollarSign,
    AlertCircle,
    Users,
    Activity,
    Clock
} from 'lucide-react';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const Dashboard = () => {
    const { userRole, currentUser } = useAuth();
    const { rate } = useSystemConfig();

    const [stats, setStats] = useState({
        todaySalesUSD: 0,
        todaySalesBs: 0,
        debtorsCount: 0,
        lateDebtors: [],
        bodegaName: ''
    });

    useEffect(() => {
        const fetchStats = async () => {
            if (!currentUser || !userRole || rate <= 0) return;

            try {
                const todayStart = startOfDay(new Date());
                const todayEnd = endOfDay(new Date());
                const sevenDaysAgo = subDays(new Date(), 7);

                const salesRef = collection(db, 'sales');
                const debtorsRef = collection(db, 'debtors');
                const userBodegaId = currentUser?.bodega_id || currentUser?.assigned_bodega_id;

                // Obtener nombre de la bodega
                if (userBodegaId) {
                    const bDoc = await getDocs(query(collection(db, 'bodegas')));
                    const bData = bDoc.docs.find(d => d.id === userBodegaId)?.data();
                    if (bData) {
                        setStats(prev => ({ ...prev, bodegaName: bData.name }));
                    }
                } else if (userRole === 'OWNER') {
                    setStats(prev => ({ ...prev, bodegaName: 'Global (Todas)' }));
                }

                // 1. Cargar Ventas (Filtrado de bodega en cliente para evitar error de Index)
                const qSales = query(
                    salesRef,
                    where('timestamp', '>=', Timestamp.fromDate(todayStart)),
                    where('timestamp', '<=', Timestamp.fromDate(todayEnd))
                );

                const salesSnap = await getDocs(qSales);
                let totalUSD = 0;
                salesSnap.forEach(doc => {
                    const data = doc.data();
                    // Priorizamos mostrar la bodega en la que el usuario está trabajando
                    if (data.bodega_id === userBodegaId) {
                        totalUSD += data.totalUSD || 0;
                    }
                });

                setStats(prev => ({
                    ...prev,
                    todaySalesUSD: totalUSD,
                    todaySalesBs: totalUSD * rate
                }));

                // 2. Cargar Deudores (Filtrado de bodega en cliente para evitar error de Index)
                const qDebtors = query(debtorsRef, where('amount_owed', '>', 0));
                const debtorsSnap = await getDocs(qDebtors);
                const lateList = [];

                debtorsSnap.forEach(doc => {
                    const d = doc.data();
                    const lastUpdate = d.last_update?.toDate();

                    // Filtro de bodega estricto + Filtro de fecha local
                    const matchesBodega = d.bodega_id === userBodegaId;
                    const isLate = lastUpdate && lastUpdate < sevenDaysAgo;

                    if (matchesBodega && isLate) {
                        lateList.push({ id: doc.id, ...d });
                    }
                });

                setStats(prev => ({
                    ...prev,
                    debtorsCount: lateList.length,
                    lateDebtors: lateList
                }));

            } catch (error) {
                console.error("Error loading dashboard", error);
            }
        };

        fetchStats();
    }, [rate, currentUser, userRole]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 text-slate-900 dark:text-slate-100 transition-colors duration-300" translate="no">
            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="max-w-7xl mx-auto space-y-4 md:space-y-6">

                {/* Encabezado */}
                <motion.div variants={itemVariants} className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Vista general de tu negocio</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                        <Activity className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <div className="text-sm">
                            <span className="text-slate-400 dark:text-slate-500 text-xs">Tasa</span>
                            <p className="font-bold text-slate-900 dark:text-slate-100">${rate.toFixed(2)}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Grid de Métricas Principales */}
                <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {/* Tarjeta de Ventas USD - AZUL */}
                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl transition-colors">
                                <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Ventas Hoy (USD)</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">${stats.todaySalesUSD.toLocaleString()}</span>
                        </div>
                    </motion.div>

                    {/* Tarjeta de Ventas BS - AMBAR */}
                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl transition-colors">
                                <ArrowUpRight className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Ventas Hoy (Bs)</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.todaySalesBs.toLocaleString()}</span>
                            <span className="text-slate-400 dark:text-slate-500 font-bold text-sm">Bs</span>
                        </div>
                    </motion.div>

                    {/* Tarjeta de Deudores - ROJO */}
                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl transition-colors">
                                <Users className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                            </div>
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Deudores</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.debtorsCount}</span>
                            <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 text-[10px] font-bold rounded-lg uppercase transition-colors text-center">Atención</span>
                        </div>
                    </motion.div>

                    {/* Tarjeta de Usuario - PÚRPURA */}
                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-2xl transition-colors">
                                <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            </div>
                            <span className="px-2.5 py-1 bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-[10px] font-bold rounded-lg uppercase transition-colors">{userRole}</span>
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Usuario</h3>
                        <div className="mb-1 truncate">
                            <span className="text-[15px] font-bold text-slate-900 dark:text-white">{currentUser?.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-soft"></div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-tighter truncate">{stats.bodegaName || 'Carga Global'}</p>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Tabla de Deudores */}
                <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                    <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Alertas de Cobranza</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Clientes con más de 7 días sin abonos</p>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{stats.lateDebtors.length} pendientes</span>
                            </div>
                        </div>
                    </div>

                    {stats.lateDebtors.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-slate-900 dark:text-white font-semibold">Todo al día</p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">No hay deudores pendientes</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 transition-colors">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Teléfono</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Deuda</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Días</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
                                    {stats.lateDebtors.map((debtor, index) => {
                                        const daysLate = Math.floor((new Date() - debtor.last_update.toDate()) / (1000 * 60 * 60 * 24));
                                        return (
                                            <motion.tr
                                                key={debtor.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shadow-sm group-hover:scale-110 transition-transform">
                                                            {debtor.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{debtor.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{debtor.phone}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-black text-red-600 dark:text-red-400">${debtor.amount_owed.toFixed(2)}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-[10px] font-bold rounded-full border border-red-100 dark:border-red-900/40 transition-colors">
                                                        {daysLate} días
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
};

export default Dashboard;
