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
        lateDebtors: []
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const todayStart = startOfDay(new Date());
                const todayEnd = endOfDay(new Date());

                const salesRef = collection(db, 'sales');
                const qSales = query(
                    salesRef,
                    where('bodega_id', '==', currentUser?.assigned_bodega_id || 'main'),
                    where('timestamp', '>=', Timestamp.fromDate(todayStart)),
                    where('timestamp', '<=', Timestamp.fromDate(todayEnd))
                );

                const salesSnap = await getDocs(qSales);
                let totalUSD = 0;
                salesSnap.forEach(doc => {
                    totalUSD += doc.data().totalUSD || 0;
                });

                const sevenDaysAgo = subDays(new Date(), 7);
                const debtorsRef = collection(db, 'debtors');
                const qDebtors = query(
                    debtorsRef,
                    where('bodega_id', '==', currentUser?.assigned_bodega_id || 'main'),
                    where('amount_owed', '>', 0),
                    where('last_update', '<', Timestamp.fromDate(sevenDaysAgo))
                );

                const debtorsSnap = await getDocs(qDebtors);
                const lateList = [];
                debtorsSnap.forEach(doc => {
                    lateList.push({ id: doc.id, ...doc.data() });
                });

                setStats({
                    todaySalesUSD: totalUSD,
                    todaySalesBs: totalUSD * rate,
                    debtorsCount: lateList.length,
                    lateDebtors: lateList
                });

            } catch (error) {
                console.error("Error loading dashboard", error);
            }
        };

        if (rate > 0) fetchStats();
    }, [rate, currentUser]);

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
        <div className="min-h-screen bg-slate-50 p-8">
            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="max-w-7xl mx-auto space-y-8">



                {/* Encabezado */}
                <motion.div variants={itemVariants} className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                        <p className="text-slate-500 mt-1 text-sm">Vista general de tu negocio</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <Activity className="w-4 h-4 text-primary-600" />
                        <div className="text-sm">
                            <span className="text-slate-400 text-xs">Tasa</span>
                            <span className="ml-2 font-bold text-slate-900">{rate.toFixed(2)} Bs/$</span>
                        </div>
                    </div>
                </motion.div>

                {/* Cuadrícula de Métricas */}
                <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Tarjeta de Ventas - VERDE */}
                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-emerald-50 rounded-2xl">
                                <DollarSign className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div className="flex items-center gap-1 text-emerald-600 text-sm font-semibold px-2 py-1 bg-emerald-50 rounded-lg">
                                <TrendingUp className="w-4 h-4" />
                                <span>+18%</span>
                            </div>
                        </div>
                        <h3 className="text-slate-400 text-xs font-semibold mb-2 uppercase">Ventas Hoy</h3>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-4xl font-bold text-slate-900">${stats.todaySalesUSD.toFixed(2)}</span>
                            <span className="text-sm text-slate-400">USD</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" style={{ width: '65%' }}></div>
                            </div>
                            <span className="text-xs text-slate-400">65%</span>
                        </div>
                        <p className="text-xs text-slate-400 bg-slate-50 inline-block px-2 py-1 rounded-md mt-3">
                            ≈ {stats.todaySalesBs.toFixed(2)} Bs
                        </p>
                    </motion.div>

                    {/* Tarjeta de Deudores - ROJO */}
                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-red-50 rounded-2xl">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            {stats.debtorsCount > 0 && (
                                <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-lg">Atención</span>
                            )}
                        </div>
                        <h3 className="text-slate-400 text-xs font-semibold mb-2 uppercase">Deudores Morosos</h3>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-4xl font-bold text-slate-900">{stats.debtorsCount}</span>
                            <span className="text-sm text-slate-400">clientes</span>
                        </div>
                        <p className="text-xs mt-4">
                            {stats.debtorsCount > 0 ? (
                                <span className="text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-md">Requiere seguimiento</span>
                            ) : (
                                <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-md">✓ Al día</span>
                            )}
                        </p>
                    </motion.div>

                    {/* Tarjeta de Usuario - MORADO */}
                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-primary-50 rounded-2xl">
                                <Users className="w-6 h-6 text-primary-600" />
                            </div>
                            <span className="px-2.5 py-1 bg-primary-50 text-primary-600 text-xs font-bold rounded-lg uppercase">{userRole}</span>
                        </div>
                        <h3 className="text-slate-400 text-xs font-semibold mb-2 uppercase">Usuario Activo</h3>
                        <div className="mb-2">
                            <span className="text-lg font-bold text-slate-900 block truncate">{currentUser?.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <p className="text-xs text-slate-400">En línea • Caja Principal</p>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Tabla de Deudores */}
                <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Alertas de Cobranza</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Clientes con más de 7 días sin abonos</p>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-600 font-medium">{stats.lateDebtors.length} pendientes</span>
                            </div>
                        </div>
                    </div>

                    {stats.lateDebtors.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-slate-900 font-semibold">Todo al día</p>
                            <p className="text-slate-500 text-sm mt-1">No hay deudores pendientes</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Cliente</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Teléfono</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Deuda</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Días</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats.lateDebtors.map((debtor, index) => {
                                        const daysLate = Math.floor((new Date() - debtor.last_update.toDate()) / (1000 * 60 * 60 * 24));
                                        return (
                                            <motion.tr
                                                key={debtor.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="hover:bg-slate-50"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white text-xs font-bold">
                                                            {debtor.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-900">{debtor.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500">{debtor.phone}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-bold text-red-600">${debtor.amount_owed.toFixed(2)}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-full">
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
