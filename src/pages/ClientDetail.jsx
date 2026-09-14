import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { supabase } from '../supabase';
import { 
    ArrowLeft, Wallet, MessageCircle, ArrowDownLeft, ArrowUpRight, 
    FileText, CheckCircle, X, DollarSign 
} from 'lucide-react';
import clsx from 'clsx';

const ClientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { rate } = useSystemConfig(currentUser?.assigned_bodega_id ?? null);
    
    const [client, setClient] = useState(null);
    const [statement, setStatement] = useState({ fiado: 0, abonado: 0, saldo: 0 });
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal de Pago
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isUsd, setIsUsd] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO_USD');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (id) fetchClientData();
    }, [id]);

    const fetchClientData = async () => {
        setLoading(true);
        try {
            // 1. Obtener info del deudor
            const { data: clientData, error: clientErr } = await supabase
                .from('debtors')
                .select('*')
                .eq('id', id)
                .single();
                
            if (clientErr) {
                console.error(`[ClientDetail] Error al cargar deudor con ID: ${id}`, clientErr);
                throw clientErr;
            }
            setClient(clientData);

            // 2. Obtener pagos del deudor (Historial real)
            const { data: payments, error: payErr } = await supabase
                .from('debt_payments')
                .select('*')
                .eq('debtor_id', id)
                .order('created_at', { ascending: true });
                
            if (payErr) {
                console.error("[ClientDetail] Error al cargar pagos:", payErr);
            }

            // 3. Cálculos matemáticos locales (Sin necesidad de RPC)
            // Saldo = Fiado - Abonado, por ende: Fiado = Saldo + Abonado
            const saldoActual = parseFloat(clientData.total_debt_usd) || 0;
            
            let totalAbonado = 0;
            const paymentsLedger = (payments || []).map(p => {
                const amount = parseFloat(p.amount_usd) || 0;
                totalAbonado += amount;
                return {
                    id: `p_${p.id}`,
                    type: 'PAYMENT',
                    date: new Date(p.created_at),
                    amount: amount,
                    amount_bs: parseFloat(p.amount_bs) || 0,
                    method: p.payment_method || 'Abono',
                    reference: p.notes
                };
            });

            const totalFiado = saldoActual + totalAbonado;

            setStatement({
                fiado: totalFiado,
                abonado: totalAbonado,
                saldo: saldoActual
            });

            // 4. Reconstruir el Ledger visual
            // Insertamos un registro inicial ficticio de deuda para que el historial cuadre
            const ledgerItems = [];
            if (totalFiado > 0) {
                ledgerItems.push({
                    id: 'deuda_historica',
                    type: 'DEBT',
                    // Ponemos una fecha anterior al primer pago, o la fecha de creación del deudor
                    date: new Date(clientData.created_at),
                    amount: totalFiado,
                    amount_bs: totalFiado * rate, // Aproximación
                    method: 'Crédito Inicial',
                    reference: 'Histórico'
                });
            }

            const combined = [...ledgerItems, ...paymentsLedger].sort((a, b) => a.date - b.date);
            
            // Calculamos saldo progresivo
            let runningBalance = 0;
            const computedLedger = combined.map(item => {
                if (item.type === 'DEBT') runningBalance += item.amount;
                if (item.type === 'PAYMENT') runningBalance = Math.max(0, runningBalance - item.amount);
                return { ...item, runningBalance };
            });

            // Revertimos para que lo más reciente salga arriba
            setLedger(computedLedger.reverse());

        } catch (err) {
            console.error("Error al cargar datos del cliente", err);
        } finally {
            setLoading(false);
        }
    };

    const handleProcessPayment = async (e) => {
        e.preventDefault();
        if (!paymentAmount || isProcessing) return;
        
        setIsProcessing(true);
        const amountInput = parseFloat(paymentAmount);
        const amountUSD = isUsd ? amountInput : amountInput / rate;
        const amountBS = isUsd ? amountInput * rate : amountInput;

        try {
            // 1. Registrar el pago en el historial
            const { error: payErr } = await supabase.from('debt_payments').insert({
                debtor_id: id,
                amount_usd: amountUSD,
                amount_bs: amountBS,
                payment_method: paymentMethod,
                notes: paymentNotes || null
            });
            if (payErr) throw payErr;
            
            // 2. Descontar el saldo en la tabla debtors
            const currentDebt = parseFloat(client.total_debt_usd) || 0;
            let newDebtRaw = currentDebt - amountUSD;
            const newDebt = Math.round(newDebtRaw * 100) / 100;
            
            if (newDebt <= 0.05) {
                // Liquidado
                await supabase.from('debtors').update({ total_debt_usd: 0, total_debt_bs: 0 }).eq('id', id);
                await supabase.from('debtors').delete().eq('id', id); // Opcional, pero así era tu lógica vieja
            } else {
                // Abono parcial
                await supabase.from('debtors').update({
                    total_debt_usd: newDebt,
                    total_debt_bs: newDebt * rate
                }).eq('id', id);
            }

            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            setPaymentNotes('');
            fetchClientData(); // recargar vista
        } catch (err) {
            console.error(err);
            alert("Error al registrar el abono");
        } finally {
            setIsProcessing(false);
        }
    };

    const shareReceipt = (item) => {
        if (!client?.phone) return alert("El cliente no tiene un teléfono registrado.");
        
        const dateStr = item.date.toLocaleString();
        let msg = `Hola *${client.name}*,\n\n`;
        msg += `Confirmamos la recepción de su abono por *$${item.amount.toFixed(2)}* (${item.amount_bs?.toFixed(2) || 0} Bs) vía ${item.method} el día ${dateStr}.\n\n`;
        msg += `Su saldo actual pendiente es: *$${statement.saldo.toFixed(2)}*.\n\n`;
        msg += `Gracias por su pago.`;
        
        const phone = client.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (!client) return <div className="p-8 text-center">Cliente no encontrado.</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row transition-colors duration-300">
            {/* Header Móvil y Sidebar Desktop (Izquierda) */}
            <div className="md:w-1/3 lg:w-1/4 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col z-20">
                
                <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10 px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <button onClick={() => navigate('/clients')} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
                        <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg tracking-widest shrink-0">
                                #{String(client?.code || '?').padStart(3, '0')}
                            </span>
                            <h2 className="font-bold text-slate-900 dark:text-white truncate text-lg">{client?.name || 'Cliente sin nombre'}</h2>
                        </div>
                        {client?.nickname && <p className="text-xs text-slate-500 truncate">"{client.nickname}"</p>}
                    </div>
                </div>

                {/* Resumen Financiero */}
                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                    {/* Tarjeta de Saldo */}
                    <div className={clsx(
                        "p-5 rounded-3xl border shadow-sm relative overflow-hidden transition-all",
                        (statement?.saldo || 0) > 0.05 ? "bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30" : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
                    )}>
                        <p className={clsx("text-[10px] font-black uppercase tracking-widest mb-1", (statement?.saldo || 0) > 0.05 ? "text-rose-500" : "text-emerald-500")}>Saldo Pendiente Actual</p>
                        <p className={clsx("text-4xl font-black", (statement?.saldo || 0) > 0.05 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
                            ${(statement?.saldo || 0).toFixed(2)}
                        </p>
                        <p className={clsx("text-xs font-bold mt-1", (statement?.saldo || 0) > 0.05 ? "text-rose-600/70 dark:text-rose-500/70" : "text-emerald-600/70 dark:text-emerald-500/70")}>
                            ~ {((statement?.saldo || 0) * (rate || 1)).toFixed(2)} Bs
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Comprado</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">${(statement?.fiado || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Abonado</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">${(statement?.abonado || 0).toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Botón Flotante para Abono (Visible en desktop o scrollable area) */}
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Wallet size={18} /> Registrar Abono
                    </button>
                    
                    {client?.phone && (
                        <button 
                            onClick={() => window.open(`https://wa.me/${client.phone.replace(/\D/g,'')}`, '_blank')}
                            className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 p-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all"
                        >
                            <MessageCircle size={18} /> Contactar
                        </button>
                    )}
                </div>
            </div>

            {/* Main Area: Ledger (Historial) */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col h-full overflow-hidden relative">
                <div className="p-4 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 z-10 flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2">
                        <FileText size={16} className="text-primary-500" /> Movimientos
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    {ledger.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                <FileText size={24} />
                            </div>
                            <p className="font-bold text-slate-500 text-sm">No hay movimientos registrados.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                            {ledger.map((item, idx) => (
                                <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-in slide-in-from-bottom-2">
                                    {/* Line marker */}
                                    <div className="flex items-center justify-center w-12 shrink-0 md:order-1 md:w-24">
                                        <div className={clsx(
                                            "w-8 h-8 rounded-full shadow-sm flex items-center justify-center z-10 border-4 border-slate-50 dark:border-slate-950 transition-transform group-hover:scale-110",
                                            item.type === 'PAYMENT' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                        )}>
                                            {item.type === 'PAYMENT' ? <ArrowDownLeft size={14} strokeWidth={3} /> : <ArrowUpRight size={14} strokeWidth={3} />}
                                        </div>
                                    </div>
                                    
                                    {/* Card */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm w-[calc(100%-3rem)] md:w-[calc(50%-3rem)] hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={clsx("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg mb-1 inline-block", item.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400')}>
                                                    {item.type === 'PAYMENT' ? 'Abono Recibido' : 'Compra Fiada'}
                                                </span>
                                                <p className="font-bold text-slate-900 dark:text-white text-sm">
                                                    {item.method}
                                                </p>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 text-right whitespace-nowrap pl-2">
                                                {item?.date instanceof Date && !isNaN(item.date.getTime()) ? item.date.toLocaleDateString() : 'Fecha Inválida'} <br className="md:hidden" />
                                                {item?.date instanceof Date && !isNaN(item.date.getTime()) ? item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                            </p>
                                        </div>
                                        
                                        {item?.reference && <p className="text-xs text-slate-500 italic mb-2">Ref: {item.reference}</p>}

                                        <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Saldo Restante</p>
                                                <p className="font-bold text-slate-600 dark:text-slate-300 text-xs">${(item?.runningBalance || 0).toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={clsx("font-black text-lg", item.type === 'PAYMENT' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                                    {item.type === 'PAYMENT' ? '-' : '+'}${(item?.amount || 0).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action: Share Receipt if Payment */}
                                        {item?.type === 'PAYMENT' && client?.phone && (
                                            <button 
                                                onClick={() => shareReceipt(item)}
                                                className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                                            >
                                                <MessageCircle size={14} /> Compartir Recibo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Sheet / Modal de Pago */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
                            <div>
                                <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">Registrar Abono</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{client?.name || 'Cliente'}</p>
                            </div>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-all shrink-0">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <form onSubmit={handleProcessPayment} className="space-y-5">
                                {/* Amount Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monto a abonar</label>
                                    <div className="flex rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden focus-within:border-primary-500 dark:focus-within:border-primary-400 transition-all bg-white dark:bg-slate-800">
                                        <input
                                            type="number" step="0.01" required autoFocus
                                            className="flex-1 px-5 py-4 bg-transparent outline-none font-black text-2xl text-slate-900 dark:text-white"
                                            placeholder="0.00"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                        />
                                        <div className="flex p-1.5 gap-1 shrink-0 bg-slate-50 dark:bg-slate-800">
                                            <button type="button" onClick={() => setIsUsd(true)} className={clsx("px-4 rounded-xl font-black text-xs transition-all", isUsd ? "bg-emerald-500 text-white shadow-md" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700")}>USD</button>
                                            <button type="button" onClick={() => setIsUsd(false)} className={clsx("px-4 rounded-xl font-black text-xs transition-all", !isUsd ? "bg-primary-500 text-white shadow-md" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700")}>BS</button>
                                        </div>
                                    </div>
                                    
                                    {/* Live Conversion Preview */}
                                    {paymentAmount && (
                                        <div className="text-right px-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Equivale a: <span className="text-slate-700 dark:text-slate-300">
                                                    {isUsd ? `${(parseFloat(paymentAmount) * (rate || 1)).toFixed(2)} Bs` : `$${(parseFloat(paymentAmount) / (rate || 1)).toFixed(2)}`}
                                                </span>
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Method */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Método de Pago</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['EFECTIVO_USD', 'PAGO_MOVIL', 'EFECTIVO_BS', 'ZELLE', 'PUNTO'].map(method => (
                                            <button
                                                key={method} type="button"
                                                onClick={() => setPaymentMethod(method)}
                                                className={clsx("px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all", paymentMethod === method ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md" : "bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300")}
                                            >
                                                {method.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Reference */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Referencia / Notas (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-primary-500 font-bold text-sm text-slate-900 dark:text-white"
                                        placeholder="Ej. Transferencia Banesco 1234"
                                        value={paymentNotes}
                                        onChange={(e) => setPaymentNotes(e.target.value)}
                                    />
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
                            <button
                                onClick={handleProcessPayment}
                                disabled={isProcessing || !paymentAmount}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? 'Procesando...' : <><CheckCircle size={18} /> Confirmar Abono</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDetail;
