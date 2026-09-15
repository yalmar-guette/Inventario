import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { supabase } from '../supabase';
import { User, CheckCircle, Phone, X, DollarSign, Wallet, AlertTriangle, History, Calendar, FileText, Search, Filter, ChevronDown } from 'lucide-react';

const Debtors = () => {
    const { currentUser } = useAuth();
    const toast = useToast();
    const { rate } = useSystemConfig(currentUser?.assigned_bodega_id ?? null);
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('recent'); // recent, highest_debt, lowest_debt

    // Estado del Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isUsd, setIsUsd] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
    const [paymentNotes, setPaymentNotes] = useState('');

    // Estado del Historial
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedDebtorHistory, setSelectedDebtorHistory] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        fetchDebtors();
    }, [currentUser]);

    const fetchDebtors = async () => {
        try {
            const activeBodegaId = currentUser?.assigned_bodega_id;

            let query = supabase
                .from('debtors')
                .select('*, payment_installments(*)')
                .gt('total_debt_usd', 0)
                .order('created_at', { ascending: false });

            if (activeBodegaId) {
                query = query.eq('bodega_id', activeBodegaId);
            }

            const { data, error } = await query;

            if (error) throw error;
            setDebtors(data || []);
        } catch (err) {
            console.error(err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const openPaymentModal = (debtor) => {
        setSelectedDebtor(debtor);
        setPaymentAmount('');
        setIsUsd(true);
        setPaymentNotes('');
        setIsModalOpen(true);
    };

    const openHistoryModal = async (debtor) => {
        setSelectedDebtorHistory(debtor);
        setIsHistoryModalOpen(true);
        setIsLoadingHistory(true);
        setPaymentHistory([]);
        
        try {
            const { data, error } = await supabase
                .from('debt_payments')
                .select('*')
                .eq('debtor_id', debtor.id)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            setPaymentHistory(data || []);
        } catch (err) {
            console.error("Error fetching payment history", err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Sincronizar moneda con método de pago automáticamente
    useEffect(() => {
        if (paymentMethod === 'USD') {
            setIsUsd(true);
        } else {
            setIsUsd(false);
        }
    }, [paymentMethod]);

    const handleProcessPayment = async (e) => {
        e.preventDefault();
        console.log("🟢 Iniciando proceso de pago...");

        if (!selectedDebtor) {
            toast.error("Error: No hay deudor seleccionado"); return;
            return;
        }

        if (!paymentAmount) {
            toast.error("Por favor ingresa un monto"); return;
            return;
        }

        const amountInput = parseFloat(paymentAmount);
        if (isNaN(amountInput) || amountInput <= 0) {
            toast.error("El monto debe ser un nÃºmero vÃ¡lido mayor a 0"); return;
            return;
        }

        // Calcular monto en USD
        const amountInUSD = isUsd ? amountInput : (amountInput / rate);

        try {
            const currentDebt = parseFloat(selectedDebtor.total_debt_usd) || 0;
            let newDebtRaw = currentDebt - amountInUSD;

            // Redondear a 2 decimales para evitar problemas de precisión flotante
            // Ejemplo: 0.0000000001 se convierte en 0
            const newDebt = Math.round(newDebtRaw * 100) / 100;

            console.log(`Procesando pago: Deuda ${currentDebt} - Pago ${amountInUSD} = Nueva ${newDebt}`);

            // 1. Lógica de Pago
            if (newDebt <= 0.05) {
                console.log("Deuda saldada. Actualizando a 0 antes de borrar...");

                // PASO 1: Asegurar que la deuda sea 0 (por si falla el borrado)
                const { error: updateError } = await supabase
                    .from('debtors')
                    .update({
                        total_debt_usd: 0,
                        total_debt_bs: 0
                    })
                    .eq('id', selectedDebtor.id);

                if (updateError) {
                    console.error("Error al poner deuda en 0:", updateError);
                    throw updateError;
                }

                // IMPORTANTE: Ya no borramos el registro del deudor, se queda como cliente
                console.log("Deuda saldada.");
                toast.success('Deuda pagada por completo. El cliente permanecerá en el directorio.');
            } else {
                console.log("Abono parcial. Actualizando saldo...");
                const { error } = await supabase
                    .from('debtors')
                    .update({
                        total_debt_usd: newDebt,
                        total_debt_bs: newDebt * rate
                    })
                    .eq('id', selectedDebtor.id);

                if (error) throw error;
                toast.success('Abono registrado exitosamente. Restan: $' + newDebt.toFixed(2));
            }

            // 2. Registrar la transacción de pago
            const { error: paymentError } = await supabase
                .from('debt_payments')
                .insert({
                    debtor_id: selectedDebtor.id,
                    amount_usd: amountInUSD,
                    amount_bs: isUsd ? amountInput * rate : amountInput,
                    exchange_rate: rate,
                    payment_method: paymentMethod,
                    notes: paymentNotes || null
                });
                
            if (paymentError) {
                console.error("Error guardando historial de abono:", paymentError);
            }

            setIsModalOpen(false);
            // Pequeño delay para asegurar que la DB procesó el cambio antes de leer
            setTimeout(fetchDebtors, 300);
        } catch (err) {
            console.error("Error crítico en proceso de pago:", err);
            toast.error('Error al registrar abono: ' + (err.message || 'Error desconocido'));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto space-y-6">
                {/* Encabezado - Centrado */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Deudores</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Gestión de cuentas por cobrar</p>
                </div>

                {/* Buscador y Filtros */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    {/* Buscador */}
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                            <Search size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, apodo o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-500 transition-all font-medium text-slate-700 dark:text-slate-200 shadow-sm"
                        />
                    </div>
                    {/* Filtro */}
                    <div className="relative min-w-[220px]">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                            <Filter size={20} />
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-500 transition-all font-medium text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="recent">Más recientes</option>
                            <option value="highest_debt">Mayor deuda a menor</option>
                            <option value="lowest_debt">Menor deuda a mayor</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {error ? (
                        <div className="col-span-full text-center py-12 flex flex-col items-center">
                            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
                            <p className="text-red-500 font-bold mb-2">Error cargando deudores</p>
                            <p className="text-slate-400 text-sm mb-4">{error.message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : loading ? (
                        <p className="text-slate-500 dark:text-slate-400 col-span-full text-center py-12 font-bold uppercase text-xs tracking-widest">Cargando...</p>
                    ) : debtors.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-800 transition-colors">
                                <User className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">No hay deudores registrados.</p>
                        </div>
                    ) : (
                        debtors
                            .filter((d) => {
                                if (!searchTerm) return true;
                                const term = searchTerm.toLowerCase();
                                return (d.name?.toLowerCase().includes(term) || d.nickname?.toLowerCase().includes(term) || d.phone?.toLowerCase().includes(term));
                            })
                            .sort((a, b) => {
                                if (sortBy === 'highest_debt') return (b.total_debt_usd || 0) - (a.total_debt_usd || 0);
                                if (sortBy === 'lowest_debt') return (a.total_debt_usd || 0) - (b.total_debt_usd || 0);
                                return new Date(b.created_at) - new Date(a.created_at);
                            })
                            .map(debtor => {
                            // Check for overdue installments
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const isOverdue = debtor.payment_installments?.some(inst => {
                                if (inst.status !== 'pending') return false;
                                const dueDate = new Date(inst.due_date);
                                dueDate.setHours(0,0,0,0);
                                return dueDate < today;
                            });

                            return (
                            <div key={debtor.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all p-6 flex flex-col justify-between group relative overflow-hidden">
                                {isOverdue && (
                                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                                        <AlertTriangle size={10} /> Cuota Vencida
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-sm transition-colors border border-primary-100 dark:border-primary-800">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {debtor.code && (
                                                    <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 tracking-widest">
                                                        #{String(debtor.code).padStart(3, '0')}
                                                    </span>
                                                )}
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg transition-colors">{debtor.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                                                <Phone size={12} />
                                                <span>{debtor.phone || 'Sin teléfono'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-6 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mb-1">Deuda Total</p>
                                        <p className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-1 transition-colors">
                                            <span className="text-emerald-500 dark:text-emerald-400 text-lg">$</span>
                                            {(parseFloat(debtor.total_debt_usd) || 0).toFixed(2)}
                                        </p>
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 text-right uppercase tracking-widest">
                                            ~ {((parseFloat(debtor.total_debt_usd) || 0) * rate).toFixed(2)} BS
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                                    <button
                                        onClick={() => openHistoryModal(debtor)}
                                        className="flex-1 px-3 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                                    >
                                        <History size={16} /> Historial
                                    </button>
                                    <button
                                        onClick={() => openPaymentModal(debtor)}
                                        className="flex-1 px-3 py-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 border border-emerald-100 dark:border-emerald-900/40"
                                    >
                                        <CheckCircle size={16} /> Abono
                                    </button>
                                </div>
                            </div>
                        )})
                    )}
                </div>

                {/* MODAL DE PAGO LOGIC-LIKE */}
                {isModalOpen && selectedDebtor && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md transition-all duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
                            {/* Encabezado */}
                            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                                <div>
                                    <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">Registrar Abono</h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Cliente: {selectedDebtor.name}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleProcessPayment} className="p-8 space-y-6">
                                {/* Info Deuda */}
                                <div className="flex items-center justify-between p-5 bg-red-50 dark:bg-red-950/20 rounded-3xl border border-red-100 dark:border-red-900/30 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-red-600 dark:text-red-400 font-black text-[10px] uppercase tracking-widest mb-1">Deuda Pendiente</span>
                                        <div className="font-black text-red-700 dark:text-red-300 text-2xl">${(parseFloat(selectedDebtor.total_debt_usd) || 0).toFixed(2)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-red-500/60 dark:text-red-400/50 uppercase tracking-widest">Equivalente</div>
                                        <div className="font-bold text-red-600/80 dark:text-red-400/80 text-sm">{((parseFloat(selectedDebtor.total_debt_usd) || 0) * rate).toFixed(2)} Bs</div>
                                    </div>
                                </div>

                                {/* Campo de Monto */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Monto a abonar</label>
                                    <div className="flex rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:border-primary-500 dark:focus-within:border-primary-400 transition-all bg-slate-50 dark:bg-slate-800">
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            className="flex-1 px-6 py-4 bg-transparent outline-none font-black text-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            placeholder="0.00"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                        />
                                        <div className="flex p-1.5 gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setIsUsd(true)}
                                                className={`px-4 rounded-2xl font-black text-xs transition-all ${isUsd ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none' : 'text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700'}`}
                                            >
                                                USD
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsUsd(false)}
                                                className={`px-4 rounded-2xl font-black text-xs transition-all ${!isUsd ? 'bg-primary-500 text-white shadow-lg shadow-primary-200 dark:shadow-none' : 'text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700'}`}
                                            >
                                                BS
                                            </button>
                                        </div>
                                    </div>
                                    {/* Vista Previa de Conversión */}
                                    {/* Vista Previa de Conversión Inteligente */}
                                    {paymentAmount && ((() => {
                                        const amountInput = parseFloat(paymentAmount) || 0;
                                        const paymentInUSD = isUsd ? amountInput : (amountInput / rate);
                                        const totalDebtUSD = parseFloat(selectedDebtor.total_debt_usd) || 0;
                                        const differenceUSD = totalDebtUSD - paymentInUSD;

                                        // Tolerancia pequeña para errores de flotante
                                        const isPaid = differenceUSD <= 0.05 && differenceUSD >= -0.05;
                                        const isOverpaid = differenceUSD < -0.05;
                                        const remainingUSD = Math.max(0, differenceUSD);
                                        const changeUSD = Math.abs(differenceUSD);

                                        return (
                                            <div className="flex flex-col items-end px-2 animate-in fade-in slide-in-from-top-1 gap-1">
                                                {/* 1. Mostrar valor del input */}
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                    Monto: <span className="text-slate-900 dark:text-white">
                                                        {isUsd
                                                            ? `$${amountInput.toFixed(2)} USD`
                                                            : `${amountInput.toFixed(2)} Bs`
                                                        }
                                                    </span>
                                                </span>

                                                {/* 2. Mostrar Estado (Falta o Sobra) en la moneda correspondiente */}
                                                {!isPaid && !isOverpaid && (
                                                    <span className="text-xs font-bold text-amber-500">
                                                        Faltan: {isUsd
                                                            ? `$${remainingUSD.toFixed(2)}`
                                                            : `${(remainingUSD * rate).toFixed(2)} Bs`
                                                        }
                                                    </span>
                                                )}

                                                {isOverpaid && (
                                                    <span className="text-xs font-bold text-emerald-500 uppercase">
                                                        Su Cambio: {isUsd
                                                            ? `$${changeUSD.toFixed(2)}`
                                                            : `${(changeUSD * rate).toFixed(2)} Bs`
                                                        }
                                                    </span>
                                                )}

                                                {isPaid && (
                                                    <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">
                                                        ¡Pago Completo!
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })())}
                                </div>

                                {/* Método de Pago */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Método de Recibo</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['EFECTIVO', 'PAGO MOVIL', 'USD', 'PUNTO DE VENTA'].map(method => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => setPaymentMethod(method)}
                                                className={`px-3 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${paymentMethod === method
                                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg'
                                                    : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                    }`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notas (Opcional) */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Notas (Opcional)</label>
                                    <div className="flex rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:border-primary-500 dark:focus-within:border-primary-400 transition-all bg-slate-50 dark:bg-slate-800">
                                        <input
                                            type="text"
                                            className="flex-1 px-6 py-4 bg-transparent outline-none font-medium text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            placeholder="Detalles del abono..."
                                            value={paymentNotes}
                                            onChange={(e) => setPaymentNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-3xl shadow-xl shadow-emerald-200 dark:shadow-none hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                >
                                    <Wallet size={20} />
                                    Confirmar Abono
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL DE HISTORIAL DE PAGOS */}
                {isHistoryModalOpen && selectedDebtorHistory && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md transition-all duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
                            {/* Encabezado */}
                            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
                                <div>
                                    <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                        <History className="text-primary-500" /> Historial de Abonos
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                        Cliente: {selectedDebtorHistory.name}
                                    </p>
                                </div>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all shrink-0">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            {/* Info Saldo Actual */}
                            <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 shrink-0 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Saldo Actual Pendiente</span>
                                <div className="text-right">
                                    <span className="font-black text-lg text-red-500 dark:text-red-400">${(parseFloat(selectedDebtorHistory.total_debt_usd) || 0).toFixed(2)}</span>
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2">({((parseFloat(selectedDebtorHistory.total_debt_usd) || 0) * rate).toFixed(2)} Bs)</span>
                                </div>
                            </div>

                            {/* Lista de Pagos */}
                            <div className="p-6 sm:p-8 overflow-y-auto flex-1">
                                {isLoadingHistory ? (
                                    <div className="flex flex-col gap-4 animate-pulse">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-2xl"></div>
                                        ))}
                                    </div>
                                ) : paymentHistory.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <History className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest">No hay abonos registrados para este cliente.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {paymentHistory.map(payment => (
                                            <div key={payment.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                        <Calendar size={12} />
                                                        {new Date(payment.created_at).toLocaleString()}
                                                    </div>
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                        {payment.payment_method}
                                                    </span>
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <div>
                                                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center">
                                                            <span className="text-lg mr-1">$</span>
                                                            {(parseFloat(payment.amount_usd) || 0).toFixed(2)}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                                                            {(parseFloat(payment.amount_bs) || 0).toFixed(2)} Bs
                                                        </span>
                                                    </div>
                                                    {payment.notes && (
                                                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs mt-2 max-w-[50%] text-right bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                                            <FileText size={12} className="shrink-0" />
                                                            <span className="truncate" title={payment.notes}>{payment.notes}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Debtors;
