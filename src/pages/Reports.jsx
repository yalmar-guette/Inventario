import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { startOfDay, endOfDay, format } from 'date-fns';
import { FileText, Download, Table } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports = () => {
    const { currentUser, userRole } = useAuth();
    const [sales, setSales] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Filtro de Bodega (Solo Owner)
    const [bodegas, setBodegas] = useState([]);
    const [selectedBodega, setSelectedBodega] = useState(currentUser?.assigned_bodega_id || 'main');

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
            const snap = await getDocs(collection(db, 'bodegas'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setBodegas(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Users Cache
            const usersSnap = await getDocs(collection(db, 'users'));
            const uMap = {};
            usersSnap.forEach(doc => {
                const u = doc.data();
                uMap[doc.id] = u.name || u.email || 'Usuario';
            });
            setUsersMap(uMap);

            // 2. Fetch Sales (Filtered by Date/Bodega)
            const [year, month, day] = date.split('-').map(Number);
            const start = new Date(year, month - 1, day, 0, 0, 0, 0);
            const end = new Date(year, month - 1, day, 23, 59, 59, 999);

            const queryBodega = userRole === 'OWNER' ? selectedBodega : (currentUser?.assigned_bodega_id || 'main');

            let q;
            if (queryBodega === 'all') {
                q = query(
                    collection(db, 'sales'),
                    where('timestamp', '>=', Timestamp.fromDate(start)),
                    where('timestamp', '<=', Timestamp.fromDate(end))
                    // orderBy removed to avoid Index issues
                );
            } else {
                q = query(
                    collection(db, 'sales'),
                    where('bodega_id', '==', queryBodega),
                    where('timestamp', '>=', Timestamp.fromDate(start)),
                    where('timestamp', '<=', Timestamp.fromDate(end))
                );
            }

            const snap = await getDocs(q);
            // Client-side sort
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => b.timestamp - a.timestamp);

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
                const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(5));
                const s = await getDocs(q);
                setLatestDebugSales(s.docs.map(d => ({ id: d.id, ...d.data() })));
            };
            fetchDebug();
        }
    }, [userRole, sales]); // Update whenever main sales update

    const getCashierName = (sale) => {
        if (sale.cashier_name) return sale.cashier_name;
        if (sale.cashier_id && usersMap[sale.cashier_id]) return usersMap[sale.cashier_id];
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
            ? [['Hora', 'Usuario', 'Items', 'Total USD', 'Total Bs']]
            : [['Hora', 'Items', 'Total USD', 'Total Bs']];

        const tableData = sales.map(s => {
            const row = [
                format(s.timestamp.toDate(), 'hh:mm a'),
                // Conditional User Column
                ...(userRole === 'OWNER' ? [getCashierName(s)] : []),
                s.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
                `$${s.totalUSD.toFixed(2)}`,
                `${s.totalBs.toFixed(2)} Bs`
            ];
            return row;
        });

        // Dynamic Column Styles
        const colStyles = userRole === 'OWNER' ? {
            0: { halign: 'center', cellWidth: 20 },
            3: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // Emerald amount
            4: { halign: 'right' }
        } : {
            0: { halign: 'center', cellWidth: 25 },
            2: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // Emerald amount
            3: { halign: 'right' }
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

        doc.save(`reporte_ventas_${date}.pdf`);
    };

    const exportExcel = () => {
        let header = "Fecha/Hora,";
        if (userRole === 'OWNER') header += "Usuario,";
        header += "ID Venta,Items,Total USD,Total Bs\n";

        let csv = header;

        sales.forEach(s => {
            const items = s.items.map(i => `${i.quantity}x ${i.name}`).join('; ');
            const rowParts = [
                format(s.timestamp.toDate(), 'yyyy-MM-dd HH:mm'),
                // Conditional User Column
                ...(userRole === 'OWNER' ? [getCashierName(s)] : []),
                s.id,
                `"${items}"`,
                s.totalUSD.toFixed(2),
                s.totalBs.toFixed(2)
            ];
            const row = rowParts.join(",");
            csv += row + "\n";
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_ventas_${date}.csv`;
        a.click();
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Encabezado - Centrado */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Informes</h1>
                    <p className="text-slate-500 mt-2 text-sm">Historial de ventas y cierres</p>
                </div>

                {/* Filtros: Fecha y Bodega */}
                <div className="flex flex-col md:flex-row justify-center gap-4 mb-6">
                    <input
                        type="date"
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 shadow-sm"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />

                    {userRole === 'OWNER' && (
                        <select
                            value={selectedBodega}
                            onChange={(e) => setSelectedBodega(e.target.value)}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 font-medium shadow-sm"
                        >
                            <option value="all">👁️ Ver Todas las Bodegas</option>
                            <option value="main">🔹 Bodega Principal (Sistema)</option>
                            {bodegas.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Tarjetas de Resumen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center">
                        <h3 className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Total del Día (USD)</h3>
                        <p className="text-4xl font-bold text-slate-900">
                            ${sales.reduce((acc, curr) => acc + curr.totalUSD, 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center">
                        <h3 className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Transacciones</h3>
                        <p className="text-4xl font-bold text-primary-500">{sales.length}</p>
                    </div>
                </div>

                {/* DEBUG: Últimas 5 Ventas Globales */}
                {userRole === 'OWNER' && latestDebugSales.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                        <h3 className="text-orange-800 font-bold text-sm mb-2">🕵️ Auditoría: {date}</h3>
                        <div className="text-xs text-orange-700 mb-2">
                            (Mostrando lo que hay realmente en la BD, sin filtros de fecha)
                        </div>
                        <div className="space-y-2">
                            {latestDebugSales.map(s => (
                                <div key={s.id} className="text-xs flex gap-2 text-orange-900 border-b border-orange-100 pb-1">
                                    <span className="font-mono">{s.timestamp?.toDate ? format(s.timestamp.toDate(), 'dd/MM HH:mm') : 'N/A'}</span>
                                    <span className="font-bold">{s.bodega_id}</span>
                                    <span>${s.totalUSD.toFixed(2)}</span>
                                    <span className="truncate flex-1">{(s.items || []).map(i => i.name).join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tabla de Transacciones */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900">Detalle de Transacciones</h2>
                        <div className="flex gap-2">
                            <button onClick={exportPDF} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center gap-2">
                                <FileText size={18} /> PDF
                            </button>
                            <button onClick={exportExcel} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center gap-2">
                                <Table size={18} /> Excel
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Hora</th>
                                    {userRole === 'OWNER' && (
                                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                                    )}
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Artículos</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total USD</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Bs</th>
                                    {selectedBodega === 'all' && <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Bodega</th>}
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
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
        const baseCols = 4; // Hora, Artículos, Total USD, Total Bs, (empty action col)
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
            const saleBodega = bodegas.find(b => b.id === sale.bodega_id);
            const bodegaName = saleBodega ? saleBodega.name : (sale.bodega_id === 'main' ? 'Bodega Principal (main)' : sale.bodega_id);
            // Safety check for timestamp
            const dateStr = sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'HH:mm aaa') : 'Hora inválida';
            // Safety check for items
            const itemsList = Array.isArray(sale.items) ? sale.items : [];

            return (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                        {dateStr}
                    </td>
                    {userRole === 'OWNER' && (
                        <td className="px-6 py-4 text-slate-700 text-sm font-medium">
                            {getCashierName(sale)}
                        </td>
                    )}
                    <td className="px-6 py-4 text-slate-900">
                        <div className="flex flex-col">
                            {itemsList.length > 0 ? itemsList.map((item, idx) => (
                                <span key={idx} className="text-sm">
                                    {item.quantity} x {item.name}
                                </span>
                            )) : <span className="text-red-400 text-xs text-center block">- Sin items -</span>}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                        ${(sale.totalUSD || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-primary-500 font-medium">
                        {sale.totalBs.toFixed(2)} Bs
                    </td>
                    {selectedBodega === 'all' && (
                        <td className="px-6 py-4 text-xs text-slate-500">
                            {bodegaName}
                        </td>
                    )}
                    <td className="px-6 py-4 text-right">
                        <button
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Ver detalles"
                        >
                            <ExternalLink size={16} />
                        </button>
                    </td>
                </tr>
            );
        });
    }
};

export default Reports;
