import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { supabase } from '../supabase';
import { startOfDay, endOfDay, format } from 'date-fns';
import { FileText, Download, Table, ExternalLink } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports = () => {
    const { currentUser, userRole } = useAuth();
    const { rate: exchangeRate } = useSystemConfig();
    const [sales, setSales] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Filtro de Bodega (Solo Owner)
    const [bodegas, setBodegas] = useState([]);
    const [selectedBodega, setSelectedBodega] = useState('all'); // Por defecto mostrar TODAS las bodegas

    useEffect(() => {
        if (userRole === 'OWNER') {
            fetchBodegas();
        }
    }, [userRole]);

    useEffect(() => {
        fetchData();
    }, [date, selectedBodega, userRole]); // Re-fetch cuando cambia la bodega seleccionada

    const fetchBodegas = async () => {
        try {
            const { data, error } = await supabase
                .from('bodegas')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;

            setBodegas(data || []);

            // Auto-seleccionar: Si solo hay 1 bodega, seleccionarla directamente
            if (data && data.length === 1) {
                setSelectedBodega(data[0].id);
            } else if (data && data.length > 1) {
                setSelectedBodega('all'); // Si hay múltiples, mostrar "Ver Todo"
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Users Cache
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, name, email');

            if (usersError) throw usersError;

            const uMap = {};
            (usersData || []).forEach(u => {
                uMap[u.id] = u.name || u.email || 'Usuario';
            });
            setUsersMap(uMap);

            // 2. Fetch Sales (Filtered by Date/Bodega)
            const [year, month, day] = date.split('-').map(Number);
            const start = new Date(year, month - 1, day, 0, 0, 0, 0);
            const end = new Date(year, month - 1, day, 23, 59, 59, 999);

            const queryBodega = selectedBodega;

            let query = supabase
                .from('sales')
                .select('*')
                .gte('timestamp', start.toISOString())
                .lte('timestamp', end.toISOString());

            // Filtrar por bodega si no es 'all'
            if (queryBodega !== 'all') {
                query = query.eq('bodega_id', queryBodega);
            }

            const { data: salesData, error: salesError } = await query
                .order('timestamp', { ascending: false });

            if (salesError) throw salesError;

            // Filtrado local (ventas válidas)
            let data = (salesData || []).filter(s => s.items && s.items.length > 0 && s.total_usd != null);

            // Convertir timestamp strings a objetos Date para compatibilidad
            data = data.map(s => ({
                ...s,
                totalUSD: s.total_usd,
                totalBs: s.total_bs,
                timestamp: new Date(s.timestamp)
            }));

            setSales(data);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // DEBUG: Fetch absolute latest sales regardless of filter
    const [latestDebugSales, setLatestDebugSales] = useState([]);
    useEffect(() => {
        if (userRole === 'OWNER') {
            const fetchDebug = async () => {
                const { data, error } = await supabase
                    .from('sales')
                    .select('*')
                    .order('timestamp', { ascending: false })
                    .limit(5);

                if (!error && data) {
                    setLatestDebugSales(data);
                }
            };
            fetchDebug();
        }
    }, [userRole, sales]); // Update whenever main sales update

    const getCashierName = (sale) => {
        if (!sale) return 'N/A';
        if (sale.cashier_name) return sale.cashier_name;
        if (usersMap && sale.cashier_id && usersMap[sale.cashier_id]) return usersMap[sale.cashier_id];
        return 'Desconocido';
    };

    const exportPDF = () => {
        const doc = new jsPDF();

        // Colores de la Marca
        const primaryColor = [99, 102, 241]; // Indigo/Primary
        const slateColor = [30, 41, 59];

        // Encabezado
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("Reporte de Ventas", 14, 20);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(date, 14, 28);

        // Caja de Resumen
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 45, 180, 25, 3, 3, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 45, 180, 25, 3, 3, 'S');

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("TOTAL GENERADO", 20, 55);

        doc.setFontSize(16);
        doc.setTextColor(...slateColor);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${sales.reduce((a, b) => a + b.totalUSD, 0).toFixed(2)}`, 20, 64);

        doc.setTextColor(16, 185, 129); // Emerald
        doc.setFontSize(12);
        doc.text(`~ ${sales.reduce((a, b) => a + b.totalBs, 0).toFixed(2)} Bs`, 60, 64);

        const headRow = userRole === 'OWNER'
            ? [['Hora', 'Usuario', 'Productos', 'Total USD', 'Total Bs', 'Pago', ...(selectedBodega === 'all' ? ['Bodega'] : [])]]
            : [['Hora', 'Productos', 'Total USD', 'Total Bs', 'Pago']];

        const tableData = sales.map(s => {
            const payments = s.payments || [];
            const hasUsd = payments.some(p => p.isUsd);
            const hasBs = payments.some(p => !p.isUsd);

            // Lógica para el método de pago (igual a la tabla UI)
            const paymentsSize = payments.length;
            let paymentStr = 'N/A';
            if (paymentsSize > 1) {
                paymentStr = 'Mixto';
            } else if (paymentsSize === 1) {
                const p = payments[0];
                if (p.method === 'EFECTIVO_USD') paymentStr = 'Efectivo $';
                else if (p.method === 'EFECTIVO_BS') paymentStr = 'Efectivo Bs';
                else if (p.method === 'PAGO_MOVIL') paymentStr = 'Pago Móvil';
                else if (p.method === 'PUNTO') paymentStr = 'Punto';
                else if (p.method === 'FIADO') paymentStr = 'Crédito';
                else paymentStr = p.method;
            }

            // Timestamp safety
            let timeStr = 'N/A';
            if (s.timestamp) {
                try {
                    const date = s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp);
                    timeStr = format(date, 'hh:mm a');
                } catch (e) { timeStr = 'Error'; }
            }

            const row = [
                timeStr,
                // Conditional User Column
                ...(userRole === 'OWNER' ? [getCashierName(s)] : []),
                s.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
                hasUsd ? `$${(s.totalUSD || 0).toFixed(2)}` : '-',
                hasBs ? `${(s.totalBs || 0).toFixed(2)} Bs` : '-',
                paymentStr,
                ...(selectedBodega === 'all' ? [bodegas.find(b => b.id === s.bodega_id)?.name || s.bodega_id] : [])
            ];
            return row;
        });

        // Dynamic Column Styles
        const colStyles = userRole === 'OWNER' ? {
            0: { halign: 'center', cellWidth: 20 },
            3: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // Emerald amount
            4: { halign: 'right' },
            5: { halign: 'center', fontSize: 8 }, // Pago
            6: { halign: 'center', fontSize: 8 }  // Bodega
        } : {
            0: { halign: 'center', cellWidth: 25 },
            2: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // Emerald amount
            3: { halign: 'right' },
            4: { halign: 'center', fontSize: 8 } // Pago
        };

        autoTable(doc, {
            startY: 80,
            head: headRow,
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                textColor: slateColor,
                fontSize: 10,
                cellPadding: 4
            },
            columnStyles: colStyles,
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { top: 80 }
        });

        // NUEVA SECCIÓN: Calcular totales por método de pago
        const paymentTotals = {};

        sales.forEach(sale => {
            const payments = sale.payments || [];
            payments.forEach(payment => {
                const method = payment.method;
                const amountUSD = payment.isUsd ? payment.amount : (payment.amount / exchangeRate);

                if (!paymentTotals[method]) {
                    paymentTotals[method] = { totalUSD: 0, totalBs: 0, name: payment.name };
                }

                paymentTotals[method].totalUSD += amountUSD;
                paymentTotals[method].totalBs += (payment.isUsd ? payment.amount * exchangeRate : payment.amount);
            });
        });

        // Agregar sección de Resumen por Método de Pago
        const finalY = doc.lastAutoTable.finalY || 210;

        if (Object.keys(paymentTotals).length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(...slateColor);
            doc.setFont('helvetica', 'bold');
            doc.text('Resumen por Método de Pago', 14, finalY + 15);

            // Crear tabla de métodos de pago
            const paymentTableData = Object.entries(paymentTotals).map(([method, data]) => {
                const isUsdMethod = ['EFECTIVO_USD', 'FIADO'].includes(method);
                return [
                    data.name || method,
                    isUsdMethod ? `$${data.totalUSD.toFixed(2)}` : '-',
                    !isUsdMethod ? `${data.totalBs.toFixed(2)} Bs` : '-'
                ];
            });

            autoTable(doc, {
                startY: finalY + 20,
                head: [['Método de Pago', 'Total USD', 'Total Bs']],
                body: paymentTableData,
                theme: 'striped',
                headStyles: {
                    fillColor: [99, 102, 241],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    textColor: slateColor,
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold' },
                    1: { halign: 'right', textColor: [16, 185, 129], fontStyle: 'bold' },
                    2: { halign: 'right', textColor: [99, 102, 241] }
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                }
            });
        }
        doc.save(`reporte_ventas_${date}.pdf`);
    };

    const exportExcel = () => {
        let header = "Fecha/Hora,";
        if (userRole === 'OWNER') header += "Usuario,";
        header += "ID Venta,Productos,Total USD,Total Bs,Metodo de Pago";
        if (selectedBodega === 'all') header += ",Bodega";
        header += "\n";

        let csv = header;

        sales.forEach(s => {
            const items = s.items.map(i => `${i.quantity}x ${i.name}`).join('; ');

            // Lógica para el método de pago
            const paymentsSize = s.payments?.length || 0;
            let paymentStr = 'N/A';
            if (paymentsSize > 1) {
                paymentStr = 'Mixto';
            } else if (paymentsSize === 1) {
                const p = s.payments[0];
                if (p.method === 'EFECTIVO_USD') paymentStr = 'Efectivo $';
                else if (p.method === 'EFECTIVO_BS') paymentStr = 'Efectivo Bs';
                else if (p.method === 'PAGO_MOVIL') paymentStr = 'Pago Movil';
                else if (p.method === 'PUNTO') paymentStr = 'Punto';
                else if (p.method === 'FIADO') paymentStr = 'Crédito';
                else paymentStr = p.method;
            }

            const rowParts = [
                format(s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp), 'yyyy-MM-dd HH:mm'),
                // Conditional User Column
                ...(userRole === 'OWNER' ? [getCashierName(s)] : []),
                s.id,
                `"${items}"`,
                (s.totalUSD || 0).toFixed(2),
                (s.totalBs || 0).toFixed(2),
                paymentStr
            ];

            if (selectedBodega === 'all') {
                const bName = bodegas.find(b => b.id === s.bodega_id)?.name || s.bodega_id;
                rowParts.push(bName);
            }

            csv += rowParts.join(',') + "\n";
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_ventas_${date}.csv`;
        a.click();
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-6">
                {/* Encabezado - Centrado */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Informes</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Historial de ventas y cierres</p>
                </div>

                {/* Filtros: Fecha y Bodega */}
                <div className="flex flex-col md:flex-row justify-center gap-4 mb-6">
                    <input
                        type="date"
                        className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 dark:text-slate-100 shadow-sm"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />

                    {userRole === 'OWNER' && (
                        <select
                            value={selectedBodega}
                            onChange={(e) => setSelectedBodega(e.target.value)}
                            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 dark:text-slate-100 font-medium shadow-sm transition-colors"
                        >
                            {/* Solo mostrar "Ver Todo" si hay más de 1 bodega */}
                            {bodegas.length > 1 && <option value="all">👁️ Ver Todas las Bodegas</option>}
                            {/* Mostrar todas las bodegas sin filtrar main */}
                            {bodegas.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Tarjetas de Resumen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center transition-colors">
                        <h3 className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest mb-2">Total del Día (USD)</h3>
                        <p className="text-4xl font-black text-slate-900 dark:text-white">
                            ${sales.reduce((acc, curr) => acc + (curr.totalUSD || 0), 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center transition-colors">
                        <h3 className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest mb-2">Transacciones</h3>
                        <p className="text-4xl font-black text-primary-600 dark:text-primary-400">{sales.length}</p>
                    </div>
                </div>

                {/* Tabla de Transacciones */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                    <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white transition-colors">Detalle de Transacciones</h2>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={exportPDF} className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <FileText size={16} /> PDF
                            </button>
                            <button onClick={exportExcel} className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <Table size={16} /> EXCEL
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hora</th>
                                    {userRole === 'OWNER' && (
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cajero</th>
                                    )}
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Productos</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Total USD</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Total Bs</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Método</th>
                                    {selectedBodega === 'all' && <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Bodega</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
                                {renderSalesList()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    function renderSalesList() {
        // Calculate colSpan dynamically
        const baseCols = 5; // Hora, Artículos, Total USD, Total Bs, Método de Pago, (empty action col)
        const ownerCol = userRole === 'OWNER' ? 1 : 0; // Usuario
        const bodegaCol = selectedBodega === 'all' ? 1 : 0; // Bodega
        const totalCols = baseCols + ownerCol + bodegaCol + 1; // +1 for the action column

        if (loading) {
            return (
                <tr>
                    <td colSpan={totalCols} className="px-6 py-8 text-center text-slate-400">
                        <div className="flex justify-center items-center gap-2">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                    </td>
                </tr>
            );
        }

        if (sales.length === 0) {
            return (
                <tr>
                    <td colSpan={totalCols} className="px-6 py-8 text-center text-slate-400">
                        No hay ventas registradas
                    </td>
                </tr>
            );
        }

        return sales.map((sale) => {
            try {
                // Defensive access to all properties
                const saleBodega = bodegas.find(b => b.id === sale?.bodega_id);
                const bodegaName = saleBodega ? saleBodega.name : (sale?.bodega_id || 'N/A');

                // Timestamp safety
                let dateStr = 'Hora desconocida';
                if (sale?.timestamp) {
                    try {
                        const date = sale.timestamp instanceof Date ? sale.timestamp : new Date(sale.timestamp);
                        dateStr = format(date, 'HH:mm aaa');
                    } catch (e) {
                        dateStr = 'Fecha inválida';
                    }
                }

                // Items safety - filter out nulls first
                const rawItems = Array.isArray(sale?.items) ? sale.items : [];
                const validItems = rawItems.filter(i => i); // remove null/undefined

                return (
                    <tr key={sale.id || Math.random()} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                            {dateStr}
                        </td>
                        {userRole === 'OWNER' && (
                            <td className="px-6 py-4 text-slate-700 text-sm font-medium">
                                {getCashierName(sale)}
                            </td>
                        )}
                        <td className="px-6 py-4 text-slate-900 dark:text-white">
                            <div className="flex flex-col">
                                {validItems.length > 0 ? validItems.map((item, idx) => (
                                    <span key={idx} className="text-sm text-slate-900 dark:text-white">
                                        {(item?.quantity || 0)} x {(item?.name || 'Item desconocido')}
                                    </span>
                                )) : <span className="text-slate-400 dark:text-slate-500 text-xs italic">- Datos de items perdidos -</span>}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                            ${(sale?.totalUSD || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-primary-500 font-medium">
                            {(sale?.totalBs || 0).toFixed(2)} Bs
                        </td>
                        <td className="px-6 py-4 text-center">
                            {(() => {
                                // Analizar el array de payments para determinar el método
                                const payments = sale?.payments || [];

                                if (payments.length === 0) {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">❓ N/A</span>;
                                }

                                // Si hay múltiples métodos de pago
                                if (payments.length > 1) {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">🔀 Mixto</span>;
                                }

                                // Un solo método de pago
                                const method = payments[0].method;

                                if (method === 'EFECTIVO_USD') {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">💵 Efectivo $</span>;
                                } else if (method === 'EFECTIVO_BS') {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">💵 Efectivo Bs</span>;
                                } else if (method === 'PAGO_MOVIL') {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">📱 Pago Móvil</span>;
                                } else if (method === 'PUNTO') {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">💳 Punto</span>;
                                } else if (method === 'FIADO') {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">📋 Crédito</span>;
                                } else {
                                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">❓ {method}</span>;
                                }
                            })()}
                        </td>
                        {selectedBodega === 'all' && (
                            <td className="px-6 py-4 text-xs text-slate-500">
                                {bodegaName}
                            </td>
                        )}
                    </tr>
                );
            } catch (error) {
                console.warn("Skipping corrupt sale row:", sale?.id, error);
                return null;
            }
        }).filter(Boolean);
    }
};

export default Reports;
