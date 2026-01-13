import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { User, CheckCircle, Phone, X, DollarSign, Wallet } from 'lucide-react';

const Debtors = () => {
    const { currentUser } = useAuth();
    const { rate } = useSystemConfig();
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isUsd, setIsUsd] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');

    useEffect(() => {
        fetchDebtors();
    }, [currentUser]);

    const fetchDebtors = async () => {
        try {
            const activeBodegaId = currentUser?.assigned_bodega_id || 'main';
            const q = query(
                collection(db, 'debtors'),
                where('bodega_id', '==', activeBodegaId)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDebtors(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openPaymentModal = (debtor) => {
        setSelectedDebtor(debtor);
        setPaymentAmount('');
        setIsUsd(true);
        setIsModalOpen(true);
    };

    const handleProcessPayment = async (e) => {
        e.preventDefault();
        if (!selectedDebtor || !paymentAmount) return;

        const amountInput = parseFloat(paymentAmount);
        if (isNaN(amountInput) || amountInput <= 0) return;

        // Calculate amount in USD
        const amountInUSD = isUsd ? amountInput : (amountInput / rate);

        try {
            const newDebt = selectedDebtor.amount_owed - amountInUSD;
            const ref = doc(db, 'debtors', selectedDebtor.id);

            // 1. Update/Delete Debtor Record
            if (newDebt <= 0.01) {
                await deleteDoc(ref);
                alert('Deuda pagada por completo. Cliente eliminado de lista.');
            } else {
                await updateDoc(ref, {
                    amount_owed: newDebt,
                    last_update: serverTimestamp()
                });
                alert('Abono registrado exitosamente.');
            }

            // 2. Optional: Record the payment transaction if you had a 'payments' collection
            // For now, we just update the debt as requested.

            setIsModalOpen(false);
            fetchDebtors();
        } catch (err) {
            console.error(err);
            alert('Error al registrar abono');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header - Centered */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Deudores</h1>
                    <p className="text-slate-500 mt-2 text-sm">Gestión de cuentas por cobrar (Fiados)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <p className="text-slate-500 col-span-full text-center py-12">Cargando...</p>
                    ) : debtors.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <User className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500">No hay deudores registrados.</p>
                        </div>
                    ) : (
                        debtors.map(debtor => (
                            <div key={debtor.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-6 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 shadow-sm">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">{debtor.name}</h3>
                                            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                                                <Phone size={12} />
                                                <span>{debtor.phone || 'Sin teléfono'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-6 bg-slate-50 p-4 rounded-2xl">
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Deuda Total</p>
                                        <p className="text-3xl font-bold text-slate-900 flex items-center gap-1">
                                            <span className="text-emerald-500 text-lg">$</span>
                                            {debtor.amount_owed?.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1 text-right">
                                            ~ {(debtor.amount_owed * rate).toFixed(2)} Bs
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => openPaymentModal(debtor)}
                                    className="w-full px-5 py-2.5 bg-emerald-50 text-emerald-700 font-medium rounded-xl hover:bg-emerald-100 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 justify-center border border-emerald-200"
                                >
                                    <CheckCircle size={18} /> Registrar Abono
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* LOGIC-LIKE PAYMENT MODAL */}
                {isModalOpen && selectedDebtor && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">Registrar Abono</h3>
                                    <p className="text-sm text-slate-500">Cliente: {selectedDebtor.name}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleProcessPayment} className="p-6 space-y-6">
                                {/* Debt Info */}
                                <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                                    <span className="text-red-600 font-medium text-sm">Deuda Actual</span>
                                    <div className="text-right">
                                        <div className="font-bold text-red-700 text-lg">${selectedDebtor.amount_owed.toFixed(2)}</div>
                                        <div className="text-xs text-red-500">~ {(selectedDebtor.amount_owed * rate).toFixed(2)} Bs</div>
                                    </div>
                                </div>

                                {/* Amount Input */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Monto a abonar</label>
                                    <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            className="flex-1 px-4 py-3 bg-white outline-none font-bold text-lg text-slate-900 placeholder:font-normal"
                                            placeholder="0.00"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                        />
                                        <div className="flex border-l border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setIsUsd(true)}
                                                className={`px-4 font-bold text-sm transition-colors ${isUsd ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                            >
                                                USD
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsUsd(false)}
                                                className={`px-4 font-bold text-sm transition-colors ${!isUsd ? 'bg-primary-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                            >
                                                Bs
                                            </button>
                                        </div>
                                    </div>
                                    {/* Conversion Preview */}
                                    {paymentAmount && (
                                        <div className="text-right text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                            {isUsd ? (
                                                <span className="text-slate-500">Son: <span className="text-slate-900">{(parseFloat(paymentAmount) * rate).toFixed(2)} Bs</span></span>
                                            ) : (
                                                <span className="text-slate-500">Son: <span className="text-slate-900">${(parseFloat(paymentAmount) / rate).toFixed(2)} USD</span></span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Method */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Método de Pago</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['EFECTIVO', 'PAGO MOVIL', 'ZELLE', 'TRANSFERENCIA'].map(method => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => setPaymentMethod(method)}
                                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${paymentMethod === method
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <Wallet size={20} />
                                    Confirmar Abono
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Debtors;
