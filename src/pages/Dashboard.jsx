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
    Clock,
    ArrowUpRight
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
            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="max-w-[1600px] mx-auto space-y-6 md:space-y-10">

                {/* Encabezado */}
                <motion.div variants={itemVariants} className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs font-medium uppercase tracking-widest">Resumen de operaciones</p>
                    </div>
                    <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                        <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-primary-600 dark:text-primary-400">
                            <Activity size={18} />
                        </div>
                        <div>
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-tighter">Tasa del Día</span>
                            <p className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight">{rate.toFixed(2)} <span className="text-[10px] opacity-60 font-medium">Bs/$</span></p>
                        </div>
                    </div>
                </motion.div>

                {/* Grid de Métricas Principales */}
                <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Tarjeta de Ventas USD - AZUL */}
                    <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group relative overflow-hidden">
                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                                <DollarSign size={24} />
                            </div>
                            <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold flex items-center gap-1 uppercase tracking-widest">
                                <TrendingUp size={12} /> +18%
                            </div>
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-[0.2em] relative z-10">Ventas Hoy (USD)</h3>
                        <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">${stats.todaySalesUSD.toLocaleString()}</span>
                            <span className="text-slate-400 dark:text-slate-600 text-sm font-medium ml-1">USD</span>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 dark:bg-blue-400/5 -mr-8 -mt-8 rounded-full blur-3xl transition-colors" />
                    </motion.div>

                    {/* Tarjeta de Ventas BS - AMBAR */}
                    <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 hover:shadow-xl hover:border-amber-200 dark:hover:border-amber-900/50 transition-all group relative overflow-hidden">
                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600 dark:text-amber-400 shadow-sm group-hover:scale-110 transition-transform">
                                <ArrowUpRight size={24} />
                            </div>
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-[0.2em] relative z-10">Equivalente (BS)</h3>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{stats.todaySalesBs.toLocaleString()}</span>
                            <span className="text-amber-600 dark:text-amber-500 font-medium text-sm uppercase">Bs</span>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 dark:bg-amber-400/5 -mr-8 -mt-8 rounded-full blur-3xl transition-colors" />
                    </motion.div>

                    {/* Tarjeta de Deudores - ROJO */}
                    <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 hover:shadow-xl hover:border-rose-200 dark:hover:border-rose-900/50 transition-all group relative overflow-hidden">
                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 shadow-sm group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-[0.2em] relative z-10">Deudores Activos</h3>
                        <div className="flex items-center gap-3 relative z-10">
                            <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{stats.debtorsCount}</span>
                            <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold rounded-lg uppercase tracking-widest transition-colors shadow-sm">Alerta</span>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 dark:bg-rose-400/5 -mr-8 -mt-8 rounded-full blur-3xl transition-colors" />
                    </motion.div>

                    {/* Tarjeta de Usuario - PÚRPURA */}
                    <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-900/50 transition-all group relative overflow-hidden">
                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/30 rounded-2xl text-primary-600 dark:text-primary-400 shadow-sm group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                            <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-[10px] font-bold rounded-lg uppercase tracking-widest">{userRole}</span>
                        </div>
                        <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-[0.2em] relative z-10">Usuario en Línea</h3>
                        <div className="mb-2 truncate relative z-10">
                            <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{currentUser?.email}</span>
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest truncate">{stats.bodegaName || 'Conexión Segura'}</p>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 dark:bg-primary-400/5 -mr-8 -mt-8 rounded-full blur-3xl transition-colors" />
                    </motion.div>
                </motion.div>

                {/* Tabla de Deudores */}
                <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden transition-all hover:shadow-xl">
                    <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/20 transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Alertas de Cobranza</h2>
                                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Gestión de créditos pendientes</p>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all group overflow-hidden">
                                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest">{stats.lateDebtors.length} Casos Críticos</span>
                            </div>
                        </div>
                    </div>

                    {stats.lateDebtors.length === 0 ? (
                        <div className="p-20 text-center bg-white dark:bg-slate-900 transition-colors">
                            <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all scale-100 hover:scale-105 shadow-inner">
                                <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">
                                    <TrendingUp className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">¡Todo en Orden!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold mt-2 uppercase tracking-widest">No hay deudores en estado crítico actualmente</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 transition-colors">
                                    <tr>
                                        <th className="px-10 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cliente</th>
                                        <th className="px-10 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contacto</th>
                                        <th className="px-10 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monto Adeudado</th>
                                        <th className="px-10 py-5 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Antigüedad</th>
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
                                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group"
                                            >
                                                <td className="px-10 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-primary-500/10 group-hover:rotate-6 transition-all duration-300">
                                                            {debtor.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{debtor.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-tight">{debtor.phone}</td>
                                                <td className="px-10 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-base font-extrabold text-red-600 dark:text-red-400">${debtor.amount_owed.toFixed(2)}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-tighter">{(debtor.amount_owed * rate).toFixed(2)} BS</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-5">
                                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-[10px] font-bold rounded-full border border-red-100 dark:border-red-900/30 transition-colors uppercase tracking-widest shadow-sm">
                                                        <AlertCircle size={12} />
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
