import React, { useState, useEffect, useRef } from 'react';
import { X, DollarSign, Wallet, CreditCard, User, Check, Trash2, PlusCircle, Loader2, Search, UserPlus, ChevronRight, Hash } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../supabase';
import ClientSearchCombobox from './ui/ClientSearchCombobox';

const PAYMENT_METHODS = [
    { id: 'EFECTIVO_USD', name: 'Efectivo $', isUsd: true },
    { id: 'EFECTIVO_BS', name: 'Efectivo Bs', isUsd: false },
    { id: 'PAGO_MOVIL', name: 'Pago Móvil', isUsd: false },
    { id: 'PUNTO', name: 'Punto Venta', isUsd: false },
    { id: 'FIADO', name: 'Crédito', isUsd: true },
];

const PaymentModal = ({ isOpen, onClose, totalUSD, exchangeRate, onProcessPayment, cart = [], activeBodegaId }) => {
    const [rows, setRows] = useState([{ id: Date.now(), methodId: 'EFECTIVO_USD', amount: '' }]);
    const [isManualMode, setIsManualMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- Estados de búsqueda de deudor ---
    const [debtorSearch, setDebtorSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedDebtor, setSelectedDebtor] = useState(null);   // deudor existente seleccionado
    const [showNewForm, setShowNewForm] = useState(false);         // modo nuevo cliente
    const [newDebtorInfo, setNewDebtorInfo] = useState({ name: '', phone: '' });
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);
    const debounceRef = useRef(null);

    // Calculado siempre (antes de early return) para usarse en useEffect deps
    const hasFiado = rows.some(r => r.methodId === 'FIADO');

    // Helper para distribuir el total equitativamente entre filas
    const getDistributedRows = (currentRows, targetTotalUSD) => {
        const count = currentRows.length;
        if (count === 0) return [];

        const splitUSD = targetTotalUSD / count;

        return currentRows.map(row => {
            const method = PAYMENT_METHODS.find(m => m.id === row.methodId);
            const isUsd = method ? method.isUsd : true; // Por defecto USD si no se encuentra
            const val = isUsd ? splitUSD : (splitUSD * exchangeRate);
            return { ...row, amount: val.toFixed(2) };
        });
    };

    useEffect(() => {
        if (isOpen) {
            const initialRow = { id: Date.now(), methodId: 'EFECTIVO_USD', amount: totalUSD.toFixed(2) };
            setRows([initialRow]);
            setIsManualMode(false);
            // Reset debtor search state
            setDebtorSearch('');
            setSearchResults([]);
            setSelectedDebtor(null);
            setShowNewForm(false);
            setNewDebtorInfo({ name: '', phone: '' });
            setShowDropdown(false);
        }
    }, [isOpen, totalUSD]);

    // Debounce search
    useEffect(() => {
        const hasFiadoNow = rows.some(r => r.methodId === 'FIADO');
        if (!hasFiadoNow) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!debtorSearch.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const term = debtorSearch.trim();
                const isCode = /^\d+$/.test(term);
                let query = supabase
                    .from('debtors')
                    .select('*')
                    .order('code', { ascending: true })
                    .limit(8);
                // RLS ya filtra por bodega del usuario — no necesitamos filtro manual
                if (isCode) {
                    query = query.eq('code', parseInt(term));
                } else {
                    query = query.ilike('name', `%${term}%`);
                }
                const { data, error } = await query;
                if (error) console.error('Supabase error:', error);
                setSearchResults(data || []);
                setShowDropdown(true);
            } catch (e) {
                console.error('Error buscando deudor:', e);
            } finally {
                setSearchLoading(false);
            }
        }, 350);
    }, [debtorSearch, rows, activeBodegaId]);

    if (!isOpen) return null;

    const totalBs = totalUSD * exchangeRate;

    // Calcular Totales basados en Filas
    const totalPaidUSD = rows.reduce((sum, row) => {
        const val = parseFloat(row.amount);
        if (isNaN(val) || val < 0) return sum; // Permitir 0, ignorar negativos

        const method = PAYMENT_METHODS.find(m => m.id === row.methodId);
        if (!method) return sum;

        return sum + (method.isUsd ? val : (val / exchangeRate));
    }, 0);

    const difference = totalUSD - totalPaidUSD;
    const isExact = Math.abs(difference) < 0.01;
    const isOverpaid = difference < -0.01;

    // Valores de Visualización UI
    const remainingInfo = {
        label: isOverpaid ? 'Su Cambio / Vuelto' : (isExact ? 'Pago Completo' : 'Restante por Pagar'),
        amountUSD: Math.abs(difference),
        amountBs: Math.abs(difference * exchangeRate),
        colorClass: isOverpaid ? 'text-blue-600' : (isExact ? 'text-emerald-600' : 'text-rose-500'),
        bgClass: isOverpaid ? 'bg-blue-50 border-blue-200' : (isExact ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200')
    };

    // Permitir pequeña tolerancia decimal para "Está Cubierto" (Botón proceder)
    const isCovered = totalPaidUSD >= totalUSD - 0.01;

    // Para crédito: se necesita o un deudor existente seleccionado, o un nuevo con nombre
    const fiadoReady = !hasFiado || selectedDebtor || (showNewForm && newDebtorInfo.name.trim());
    const canSubmit = isCovered && fiadoReady;

    // Operaciones de Fila
    const addRow = () => {
        // En modo manual, añadimos una fila con 0. En inteligente, distribuimos.
        const newRow = { id: Date.now(), methodId: 'EFECTIVO_USD', amount: isManualMode ? '0' : '0' };
        const nextRows = [...rows, newRow];

        if (isManualMode) {
            setRows(nextRows);
        } else {
            // Auto-distribuir solo en modo inteligente
            const distributed = getDistributedRows(nextRows, totalUSD);
            setRows(distributed);
        }
    };

    const removeRow = (id) => {
        if (rows.length === 1) {
            // Si solo hay 1 fila, restablecer al total completo (Inteligente) o 0 (Manual)? 
            // Mejor restablecer al total completo por seguridad, o dejarlo como estaba.
            // Si es manual, quizás el usuario quiera borrarlo para poner 0.
            if (isManualMode) {
                const resetRow = { ...rows[0], amount: '0' };
                setRows([resetRow]);
            } else {
                const resetRow = { ...rows[0], amount: totalUSD.toFixed(2) };
                setRows([resetRow]);
            }
            return;
        }
        const filtered = rows.filter(r => r.id !== id);

        if (isManualMode) {
            setRows(filtered);
        } else {
            const distributed = getDistributedRows(filtered, totalUSD);
            setRows(distributed);
        }
    };

    const updateRow = (id, field, value) => {
        // 1. Crear el estado actualizado hipotético primero
        const nextRows = rows.map(r => {
            if (r.id !== id) return r;

            // Manejar Conversión de Moneda al cambiar el Método (Lógica Estándar - Se mantiene en ambos modos para comodidad)
            if (field === 'methodId') {
                const oldMethod = PAYMENT_METHODS.find(m => m.id === r.methodId);
                const newMethod = PAYMENT_METHODS.find(m => m.id === value);

                if (oldMethod && newMethod && r.amount) {
                    const val = parseFloat(r.amount);
                    if (!isNaN(val)) {
                        if (oldMethod.isUsd && !newMethod.isUsd) {
                            return { ...r, [field]: value, amount: (val * exchangeRate).toFixed(2) };
                        }
                        if (!oldMethod.isUsd && newMethod.isUsd) {
                            return { ...r, [field]: value, amount: (val / exchangeRate).toFixed(2) };
                        }
                    }
                }
            }
            return { ...r, [field]: value };
        });

        // 2. Lógica de Balance Inteligente (Solo si hay estrictamente 2 filas Y NO estamos en modo manual)
        // Si acabamos de actualizar una fila, queremos que la OTRA fila se auto-rellene con el resto.
        if (!isManualMode && nextRows.length === 2 && (field === 'amount')) {
            const editedRow = nextRows.find(r => r.id === id);
            const otherRow = nextRows.find(r => r.id !== id);

            // Solo proceder si tenemos números válidos
            const val = parseFloat(value);
            if (!isNaN(val)) {

                // Calcular cuánto vale la fila editada en USD
                const editedMethod = PAYMENT_METHODS.find(m => m.id === editedRow.methodId);
                const isEditedUsd = editedMethod ? editedMethod.isUsd : true;
                const editedAmountUSD = isEditedUsd ? val : (val / exchangeRate);

                // Calcular Restante necesario
                let remainingUSD = totalUSD - editedAmountUSD;

                // Si se pagó de más, la otra fila se vuelve 0 (y la UI de Cambio toma el control)
                if (remainingUSD < 0) remainingUSD = 0;

                // Actualizar la OTRA fila
                const otherMethod = PAYMENT_METHODS.find(m => m.id === otherRow.methodId);
                const isOtherUsd = otherMethod ? otherMethod.isUsd : true;
                const newOtherAmount = isOtherUsd ? remainingUSD : (remainingUSD * exchangeRate);

                // Aplicar la actualización a la otra fila en el array
                const finalRows = nextRows.map(r => {
                    if (r.id === otherRow.id) {
                        return { ...r, amount: newOtherAmount.toFixed(2) };
                    }
                    return r;
                });

                setRows(finalRows);
                return;
            }
        }

        setRows(nextRows);
    };

    const handleSubmit = async () => {
        if (!canSubmit || isProcessing) return;

        setIsProcessing(true);
        try {
            const validPayments = rows
                .filter(r => parseFloat(r.amount) > 0)
                .map(r => {
                    const method = PAYMENT_METHODS.find(m => m.id === r.methodId);
                    return {
                        id: r.id,
                        method: r.methodId,
                        name: method.name,
                        amount: parseFloat(r.amount),
                        isUsd: method.isUsd
                    };
                });

            // Construir objeto deudor para el POS
            let debtorPayload = null;
            if (hasFiado) {
                if (selectedDebtor) {
                    debtorPayload = { existingId: selectedDebtor.id, name: selectedDebtor.name };
                } else if (showNewForm && newDebtorInfo.name.trim()) {
                    debtorPayload = { isNew: true, name: newDebtorInfo.name.trim(), phone: newDebtorInfo.phone.trim() };
                }
            }

            await onProcessPayment({
                payments: validPayments,
                debtor: debtorPayload,
                totalUSD,
                totalBs,
                changeUSD: isOverpaid ? Math.abs(difference) : 0
            });
        } catch (error) {
            console.error('Error al procesar pago:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300 notranslate p-0 md:p-4" translate="no">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-y-auto md:overflow-hidden md:h-[90vh] md:rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row transition-colors" style={{maxHeight: '100dvh'}}>

                {/* Left: Summary */}
                <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-800/50 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 p-4 md:p-6 flex flex-col md:shrink-0 transition-colors md:overflow-y-auto">
                    <div className="flex items-center justify-between md:block mb-4 md:mb-8">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Resumen</h2>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Detalles de la Venta</p>
                        </div>
                        <button onClick={onClose} className="md:hidden p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-4 mb-auto">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors relative overflow-hidden group">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Total Neto a Pagar</p>
                            <div className="flex flex-col gap-1 relative z-10">
                                <p className="text-3xl font-black text-slate-900 dark:text-white">${totalUSD.toFixed(2)}</p>
                                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{totalBs.toFixed(2)} Bs</p>
                            </div>
                            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 dark:bg-emerald-400/5 -mr-8 -mt-8 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                        </div>

                        <div className={clsx("p-5 rounded-2xl border transition-all relative overflow-hidden",
                            remainingInfo.amountUSD > 0.01
                                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40"
                                : remainingInfo.amountUSD < -0.01
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40"
                                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700"
                        )}>
                            <p className={clsx("text-[10px] font-black uppercase tracking-widest mb-2",
                                remainingInfo.amountUSD > 0.01 ? "text-amber-600 dark:text-amber-400" : remainingInfo.amountUSD < -0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                            )}>
                                {remainingInfo.label}
                            </p>
                            <div className="flex flex-col gap-1">
                                <p className={clsx("text-2xl font-black",
                                    remainingInfo.amountUSD > 0.01 ? "text-amber-700 dark:text-amber-400" : remainingInfo.amountUSD < -0.01 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                                )}>
                                    ${Math.abs(remainingInfo.amountUSD).toFixed(2)}
                                </p>
                                <p className={clsx("text-sm font-bold opacity-80",
                                    remainingInfo.amountUSD > 0.01 ? "text-amber-600 dark:text-amber-500" : remainingInfo.amountUSD < -0.01 ? "text-emerald-600 dark:text-emerald-500" : "text-slate-500 dark:text-slate-500"
                                )}>
                                    {Math.abs(remainingInfo.amountBs).toFixed(2)} Bs
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Cart Items List */}
                    <div className="mt-8 flex-1 overflow-y-auto custom-scrollbar border-t border-slate-200 dark:border-slate-800 pt-6 hidden md:block">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 px-1">Productos en Carrito</h3>
                        <div className="space-y-3">
                            {cart.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-white dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-800 transition-all group">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <p className="font-bold text-slate-800 dark:text-white text-xs truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{item.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-lg text-slate-600 dark:text-slate-400 text-[10px] font-black">X{item.quantity}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-slate-900 dark:text-white text-xs">${(parseFloat(item.price_usd) * item.quantity).toFixed(2)}</p>
                                        <p className="text-[9px] text-emerald-600 dark:text-emerald-500 font-bold">
                                            {(parseFloat(item.price_usd) * item.quantity * exchangeRate).toFixed(2)} Bs
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <p className="text-[10px] font-bold text-center text-slate-300 dark:text-slate-700 uppercase tracking-widest py-8 italic">
                                    Carrito vacío
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Multi-Row Form */}
                <div className="md:flex-1 md:flex md:flex-col relative bg-white dark:bg-slate-900 transition-colors md:min-h-0">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all hidden md:block z-10">
                        <X size={24} />
                    </button>

                    {/* Scrollable form area */}
                    <div className="md:flex-1 md:overflow-y-auto p-6 md:p-10">

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Detalles del Pago</h3>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Selección de Métodos</p>
                        </div>

                        <button
                            onClick={() => {
                                const newMode = !isManualMode;
                                setIsManualMode(newMode);
                                if (!newMode) {
                                    const distributed = getDistributedRows(rows, totalUSD);
                                    setRows(distributed);
                                }
                            }}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 shadow-sm",
                                isManualMode
                                    ? "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    : "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-primary-100 dark:border-primary-800/50 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                            )}
                            title={isManualMode ? "Cambiar a modo inteligente" : "Cambiar a modo manual"}
                        >
                            {isManualMode ? (
                                <><div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Manual</>
                            ) : (
                                <><div className="w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-400 animate-pulse" /> Inteligente</>
                            )}
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        {rows.map((row, index) => {
                            const method = PAYMENT_METHODS.find(m => m.id === row.methodId);
                            return (
                                <div key={row.id} className="flex gap-4 items-start animate-in slide-in-from-bottom-2 duration-300">
                                    {/* Method Selector */}
                                    <div className="flex-1">
                                        <select
                                            className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 font-bold text-slate-700 dark:text-slate-200 transition-all appearance-none"
                                            value={row.methodId}
                                            onChange={(e) => updateRow(row.id, 'methodId', e.target.value)}
                                        >
                                            {PAYMENT_METHODS.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="relative w-36 md:w-48">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-black text-sm">
                                            {method?.isUsd ? '$' : 'Bs'}
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 font-black text-slate-900 dark:text-white text-lg transition-all shadow-sm"
                                            value={row.amount}
                                            onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                                        />
                                    </div>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeRow(row.id)}
                                        className="p-3.5 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all shadow-sm group"
                                        title="Eliminar fila"
                                    >
                                        <Trash2 size={22} className="group-active:scale-90 transition-transform" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={addRow}
                        className="flex items-center gap-3 text-primary-600 dark:text-primary-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-primary-700 dark:hover:text-primary-300 self-start px-2 mb-10 transition-colors group"
                    >
                        <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-xl group-hover:scale-110 transition-transform">
                            <PlusCircle size={18} />
                        </div>
                        <span>Añadir método de pago</span>
                    </button>

                    {/* Debtor Search Section */}
                    {hasFiado && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-6 rounded-[2rem] mb-8 animate-in zoom-in-95 duration-300 transition-colors relative overflow-hidden">
                            <h4 className="text-amber-700 dark:text-amber-400 font-black text-xs uppercase tracking-widest mb-5 flex items-center gap-3 relative z-10">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                                    <User size={18} />
                                </div>
                                Cliente a Crédito
                            </h4>

                            {/* Estado: deudor ya seleccionado o búsqueda predictiva */}
                            {showNewForm ? (
                                /* Estado: formulario nuevo cliente */
                                <div className="space-y-4 relative z-10">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-amber-600/70 dark:text-amber-400/50 uppercase tracking-widest ml-1">
                                            Nombre Completo <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            autoFocus
                                            placeholder="Nombre del cliente"
                                            className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl focus:outline-none focus:border-amber-400 text-slate-900 dark:text-white font-bold transition-all"
                                            value={newDebtorInfo.name}
                                            onChange={e => setNewDebtorInfo(p => ({ ...p, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-amber-600/70 dark:text-amber-400/50 uppercase tracking-widest ml-1">
                                            Teléfono <span className="text-slate-400">(opcional)</span>
                                        </label>
                                        <input
                                            placeholder="04xx-xxxxxxx"
                                            className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl focus:outline-none focus:border-amber-400 text-slate-900 dark:text-white font-bold transition-all"
                                            value={newDebtorInfo.phone}
                                            onChange={e => setNewDebtorInfo(p => ({ ...p, phone: e.target.value }))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setShowNewForm(false)}
                                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        ← Buscar cliente existente
                                    </button>
                                </div>
                            ) : (
                                <ClientSearchCombobox
                                    selectedClient={selectedDebtor}
                                    onSelect={(client) => setSelectedDebtor(client)}
                                    onClear={() => setSelectedDebtor(null)}
                                    onSelectNew={() => setShowNewForm(true)}
                                />
                            )}

                            <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-500/5 dark:bg-amber-400/5 -mr-12 -mb-12 rounded-full blur-2xl" />
                        </div>
                    )}

                    </div>
                    {/* End scrollable area */}

                    {/* Fixed bottom button */}
                    <div className="px-6 md:px-10 pt-4 pb-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 md:shrink-0">
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit || isProcessing}
                            className={clsx(
                                "w-full py-5 rounded-2xl text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all shadow-xl",
                                (canSubmit && !isProcessing)
                                    ? "bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white shadow-emerald-200/50 dark:shadow-none translate-y-0 hover:-translate-y-1 active:scale-[0.98]"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none"
                            )}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Procesando Venta...
                                </>
                            ) : (
                                <>
                                    <Check size={20} />
                                    Finalizar y Registrar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
