import React, { useState, useEffect } from 'react';
import { X, DollarSign, Wallet, CreditCard, User, Check, Trash2, PlusCircle } from 'lucide-react';
import clsx from 'clsx';

const PAYMENT_METHODS = [
    { id: 'EFECTIVO_USD', name: 'Efectivo $', isUsd: true },
    { id: 'EFECTIVO_BS', name: 'Efectivo Bs', isUsd: false },
    { id: 'PAGO_MOVIL', name: 'Pago Móvil', isUsd: false },
    { id: 'PUNTO', name: 'Punto Venta', isUsd: false },
    { id: 'FIADO', name: 'Fiado / Crédito', isUsd: true },
];

const PaymentModal = ({ isOpen, onClose, totalUSD, exchangeRate, onProcessPayment, cart = [] }) => {
    // Por defecto una fila vacía
    const [rows, setRows] = useState([{ id: Date.now(), methodId: 'EFECTIVO_USD', amount: '' }]);
    const [debtorInfo, setDebtorInfo] = useState({ name: '', phone: '' });

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
            // Inicial: 1 Fila con el monto total
            const initialRow = { id: Date.now(), methodId: 'EFECTIVO_USD', amount: totalUSD.toFixed(2) };
            setRows([initialRow]);
            setDebtorInfo({ name: '', phone: '' });
        }
    }, [isOpen, totalUSD]); // Agregar dependencia totalUSD para actualizar si cambia

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

    const hasFiado = rows.some(r => r.methodId === 'FIADO');

    // Operaciones de Fila
    const addRow = () => {
        const newRow = { id: Date.now(), methodId: 'EFECTIVO_USD', amount: '0' };
        const nextRows = [...rows, newRow];

        // Auto-distribuir
        const distributed = getDistributedRows(nextRows, totalUSD);
        setRows(distributed);
    };

    const removeRow = (id) => {
        if (rows.length === 1) {
            // Si solo hay 1 fila, restablecer al total completo en lugar de borrar/eliminar
            const resetRow = { ...rows[0], amount: totalUSD.toFixed(2) };
            setRows([resetRow]);
            return;
        }
        const filtered = rows.filter(r => r.id !== id);
        const distributed = getDistributedRows(filtered, totalUSD);
        setRows(distributed);
    };

    const updateRow = (id, field, value) => {
        // 1. Crear el estado actualizado hipotético primero
        const nextRows = rows.map(r => {
            if (r.id !== id) return r;

            // Manejar Conversión de Moneda al cambiar el Método (Lógica Estándar)
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

        // 2. Lógica de Balance Inteligente (Solo si hay estrictamente 2 filas)
        // Si acabamos de actualizar una fila, queremos que la OTRA fila se auto-rellene con el resto.
        if (nextRows.length === 2 && (field === 'amount')) {
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

    const handleSubmit = () => {
        if (!isCovered) return;

        // Compilar pagos válidos
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

        onProcessPayment({
            payments: validPayments,
            debtor: hasFiado ? debtorInfo : null,
            totalUSD,
            totalBs,
            changeUSD: isOverpaid ? Math.abs(difference) : 0 // Pasar información del cambio
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in notranslate" translate="no">
            <div className="bg-white border border-slate-200 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden">

                {/* Left: Summary */}
                <div className="w-1/3 bg-slate-50 border-r border-slate-100 p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-text-main mb-6">Resumen de Pago</h2>

                    <div className="space-y-4 mb-auto">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-text-muted text-sm">Total a Pagar</p>
                            <div className="flex justify-between items-baseline mt-1">
                                <p className="text-2xl font-bold text-text-main">${totalUSD.toFixed(2)}</p>
                                <p className="text-lg font-bold text-emerald-600">{totalBs.toFixed(2)} Bs</p>
                            </div>
                        </div>

                        <div className={clsx("p-4 rounded-xl border transition-colors", remainingInfo.bgClass)}>
                            <p className={clsx("text-sm font-bold", remainingInfo.colorClass)}>
                                {remainingInfo.label}
                            </p>
                            <div className="flex justify-between items-baseline mt-1">
                                <p className={clsx("text-xl font-bold", remainingInfo.colorClass)}>
                                    ${remainingInfo.amountUSD.toFixed(2)}
                                </p>
                                <p className={clsx("text-sm font-bold", remainingInfo.colorClass)}>
                                    {remainingInfo.amountBs.toFixed(2)} Bs
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Cart Items List (Corrected) */}
                    <div className="mt-6 flex-1 overflow-y-auto custom-scrollbar border-t border-slate-100 pt-4">
                        <h3 className="text-xs font-bold text-text-muted uppercase mb-3 px-1">Productos en Carrito</h3>
                        <div className="space-y-2">
                            {cart.map(item => (
                                <div key={item.id} className="flex justify-between items-start bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-700 text-sm line-clamp-2">{item.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">x{item.quantity}</span>
                                        </div>
                                    </div>
                                    <div className="text-right pl-2">
                                        <p className="font-bold text-slate-800 text-sm">${(parseFloat(item.price_usd) * item.quantity).toFixed(2)}</p>
                                        <p className="text-[10px] text-emerald-600 font-semibold">
                                            {(parseFloat(item.price_usd) * item.quantity * exchangeRate).toFixed(2)} Bs
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <p className="text-xs text-center text-slate-300 italic py-4">
                                    Carrito vacío
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Multi-Row Form */}
                <div className="flex-1 p-8 flex flex-col relative bg-white overflow-y-auto">
                    <button onClick={onClose} className="absolute top-4 right-4 text-text-light hover:text-text-main">
                        <X size={24} />
                    </button>

                    <h3 className="text-lg font-bold text-text-main mb-6">Detalles del Pago</h3>

                    <div className="space-y-4 mb-6">
                        {rows.map((row, index) => {
                            const method = PAYMENT_METHODS.find(m => m.id === row.methodId);
                            return (
                                <div key={row.id} className="flex gap-3 items-start animate-slide-up">
                                    {/* Method Selector */}
                                    <div className="flex-1">
                                        <select
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-medium text-slate-700"
                                            value={row.methodId}
                                            onChange={(e) => updateRow(row.id, 'methodId', e.target.value)}
                                        >
                                            {PAYMENT_METHODS.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="relative w-40">
                                        <span className="absolute left-3 top-3.5 text-slate-400 font-bold text-sm">
                                            {method?.isUsd ? '$' : 'Bs'}
                                        </span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-2 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-bold text-slate-900"
                                            value={row.amount}
                                            onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                                        />
                                    </div>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeRow(row.id)}
                                        className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                        title="Eliminar fila"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={addRow}
                        className="flex items-center gap-2 text-primary-600 font-bold hover:text-primary-700 self-start px-2 mb-8"
                    >
                        <PlusCircle size={20} />
                        <span>Añadir otro método de pago</span>
                    </button>

                    {/* Conditional Debt Info */}
                    {hasFiado && (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-6 animate-fade-in">
                            <h4 className="text-amber-600 font-bold text-sm mb-3 flex items-center gap-2">
                                <User size={16} /> Datos del Deudor
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    placeholder="Nombre Completo"
                                    className="input-field bg-white"
                                    value={debtorInfo.name}
                                    onChange={e => setDebtorInfo({ ...debtorInfo, name: e.target.value })}
                                />
                                <input
                                    placeholder="Teléfono"
                                    className="input-field bg-white"
                                    value={debtorInfo.phone}
                                    onChange={e => setDebtorInfo({ ...debtorInfo, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-auto pt-6 border-t border-slate-100">
                        <button
                            onClick={handleSubmit}
                            disabled={!isCovered}
                            className={clsx(
                                "w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-all",
                                isCovered
                                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            <Check size={24} />
                            Finalizar Venta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
