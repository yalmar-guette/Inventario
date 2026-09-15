import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { TrendingUp, DollarSign, Activity, Calendar as CalendarIcon, ArrowUpRight } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

const Analytics = () => {
    const { currentUser } = useAuth();
    const activeBodegaId = currentUser?.assigned_bodega_id || null;
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalCost: 0,
        netProfit: 0,
        margin: 0
    });
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        fetchAnalyticsData();
    }, [activeBodegaId]);

    const fetchAnalyticsData = async () => {
        try {
            setLoading(true);
            const today = new Date();
            const sevenDaysAgo = subDays(today, 6); // Ultimos 7 dias incluyendo hoy

            const { data, error } = await supabase
                .from('sales')
                .select('id, timestamp, total_usd, items')
                .gte('timestamp', startOfDay(sevenDaysAgo).toISOString())
                .lte('timestamp', endOfDay(today).toISOString())
                .eq('status', 'COMPLETED')
                .eq('bodega_id', activeBodegaId);

            if (error) throw error;

            // Procesar datos para las tarjetas resumen
            let revenue = 0;
            let cost = 0;

            const sales = data || [];

            sales.forEach(sale => {
                revenue += parseFloat(sale.total_usd) || 0;
                
                const items = sale.items || [];
                items.forEach(item => {
                    const itemCost = parseFloat(item.cost_usd) || 0;
                    const qty = parseInt(item.quantity) || 0;
                    cost += (itemCost * qty);
                });
            });

            const profit = revenue - cost;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

            setStats({
                totalRevenue: revenue,
                totalCost: cost,
                netProfit: profit,
                margin: margin
            });

            // Preparar datos para el grÃ¡fico por dÃ­a (Ãºltimos 7 dÃ­as)
            const daysInterval = eachDayOfInterval({ start: sevenDaysAgo, end: today });
            
            const groupedData = daysInterval.map(day => {
                const daySales = sales.filter(s => isSameDay(new Date(s.timestamp), day));
                
                let dayRevenue = 0;
                let dayCost = 0;

                daySales.forEach(sale => {
                    dayRevenue += parseFloat(sale.total_usd) || 0;
                    const items = sale.items || [];
                    items.forEach(item => {
                        const itemCost = parseFloat(item.cost_usd) || 0;
                        const qty = parseInt(item.quantity) || 0;
                        dayCost += (itemCost * qty);
                    });
                });

                return {
                    name: format(day, 'EEE', { locale: es }).toUpperCase(),
                    fecha: format(day, "d MMM", { locale: es }),
                    Ingresos: parseFloat(dayRevenue.toFixed(2)),
                    Ganancia: parseFloat((dayRevenue - dayCost).toFixed(2))
                };
            });

            setChartData(groupedData);

        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900/95 dark:bg-slate-800/95 border border-slate-700/50 p-4 rounded-xl shadow-xl backdrop-blur-md">
                    <p className="text-slate-300 font-bold mb-3">{payload[0].payload.fecha}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-6 mb-1">
                            <span className="flex items-center gap-2 text-sm text-slate-400">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}
                            </span>
                            <span className="font-black text-white">${entry.value.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="p-8 h-full flex flex-col justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                <p className="text-slate-500 font-medium">Analizando mÃ©tricas...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 h-full flex flex-col max-w-7xl mx-auto w-full animate-in fade-in duration-500 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-primary-600 dark:text-primary-400" size={32} />
                        Métricas Semanales
                    </h1>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Inteligencia de Negocios
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <CalendarIcon size={16} className="text-slate-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Ãšltimos 7 dÃ­as</span>
                </div>
            </div>

            {/* Resumen Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Ingresos Brutos */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={80} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-6">
                            <DollarSign className="text-primary-600 dark:text-primary-400" size={24} />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ingresos Brutos</p>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white">
                            ${stats.totalRevenue.toFixed(2)}
                        </h2>
                    </div>
                </div>

                {/* Costo de InversiÃ³n */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Activity size={80} className="text-amber-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-6">
                            <Activity className="text-amber-500" size={24} />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Costo de InversiÃ³n</p>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white">
                            ${stats.totalCost.toFixed(2)}
                        </h2>
                    </div>
                </div>

                {/* Ganancia Neta */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 p-6 rounded-[2rem] shadow-lg shadow-emerald-500/20 relative overflow-hidden group text-white">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ArrowUpRight size={80} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6 backdrop-blur-sm">
                            <ArrowUpRight className="text-white" size={24} />
                        </div>
                        <div className="flex justify-between items-end mb-1">
                            <p className="text-xs font-black text-emerald-100 uppercase tracking-widest">Ganancia Neta</p>
                            <span className="text-sm font-bold bg-white/20 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                                {stats.margin.toFixed(1)}% Margen
                            </span>
                        </div>
                        <h2 className="text-4xl font-black text-white">
                            ${stats.netProfit.toFixed(2)}
                        </h2>
                    </div>
                </div>
            </div>

            {/* GrÃ¡fico */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex-1 min-h-[400px]">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">EvoluciÃ³n de Ganancias</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 0, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(100,116,139,0.05)'}} />
                        <Legend 
                            iconType="circle" 
                            wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 700, color: '#64748b' }} 
                        />
                        <Bar dataKey="Ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="Ganancia" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Analytics;