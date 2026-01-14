import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { startOfDay, endOfDay, format } from 'date-fns';
import { FileText, Download, Table } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports = () => {
    const { currentUser } = useAuth();
    const [sales, setSales] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        fetchData();
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Users Cache (Optimizado: solo ids necesarios o todos si son pocos)
            // Asumimos que son pocos usuarios, traemos todos para el mapa
            const usersSnap = await getDocs(collection(db, 'users'));
            const uMap = {};
            usersSnap.forEach(doc => {
                const u = doc.data();
                uMap[doc.id] = u.name || u.email || 'Usuario';
            });
            setUsersMap(uMap);

            // 2. Fetch Sales
            // Construir fechas usando hora local explícitamente para evitar cambios UTC
            const [year, month, day] = date.split('-').map(Number);
            const start = new Date(year, month - 1, day, 0, 0, 0, 0);
            const end = new Date(year, month - 1, day, 23, 59, 59, 999);

            const q = query(
                collection(db, 'sales'),
                where('bodega_id', '==', currentUser?.assigned_bodega_id || 'main'),
                where('timestamp', '>=', Timestamp.fromDate(start)),
                where('timestamp', '<=', Timestamp.fromDate(end)),
                orderBy('timestamp', 'desc')
            );

            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSales(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

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

        const tableData = sales.map(s => [
            format(s.timestamp.toDate(), 'hh:mm a'),
            getCashierName(s),
            s.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
            `$${s.totalUSD.toFixed(2)}`,
            `${s.totalBs.toFixed(2)} Bs`
        ]);

        autoTable(doc, {
            startY: 80,
            head: [['Hora', 'Usuario', 'Items', 'Total USD', 'Total Bs']],
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
            columnStyles: {
                0: { halign: 'center', cellWidth: 20 },
                3: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // Emerald amount
                4: { halign: 'right' }
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { top: 80 }
        });

        doc.save(`reporte_ventas_${date}.pdf`);
    };

    const exportExcel = () => {
        let csv = "Fecha/Hora,Usuario,ID Venta,Items,Total USD,Total Bs\n";
        sales.forEach(s => {
            const items = s.items.map(i => `${i.quantity}x ${i.name}`).join('; ');
            const row = [
                format(s.timestamp.toDate(), 'yyyy-MM-dd HH:mm'),
                getCashierName(s),
                s.id,
                `"${items}"`,
                s.totalUSD.toFixed(2),
                s.totalBs.toFixed(2)
            ].join(",");
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

                {/* Selector de Fecha */}
                <div className="flex justify-center mb-6">
                    <input
                        type="date"
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
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
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Artículos</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total USD</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Bs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center py-12 text-slate-500">Cargando...</td></tr>
                                ) : sales.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-12 text-slate-500">No hay ventas registradas</td></tr>
                                ) : (
                                    sales.map(sale => (
                                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                                                {format(sale.timestamp.toDate(), 'HH:mm aaa')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 text-sm font-medium">
                                                {getCashierName(sale)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-900">
                                                <div className="flex flex-col">
                                                    {sale.items.map((item, idx) => (
                                                        <span key={idx} className="text-sm">
                                                            {item.quantity} x {item.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                                                ${sale.totalUSD.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-primary-500 font-medium">
                                                {sale.totalBs.toFixed(2)} Bs
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
