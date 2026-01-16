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

    // Estado del Modal
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
            const activeBodegaId = currentUser?.assigned_bodega_id || 'bodega_1';
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

        // Calcular monto en USD
        const amountInUSD = isUsd ? amountInput : (amountInput / rate);

        try {
            const newDebt = selectedDebtor.amount_owed - amountInUSD;
            const ref = doc(db, 'debtors', selectedDebtor.id);

            // 1. Actualizar/Eliminar Registro de Deudor
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

            // 2. Opcional: Registrar la transacción de pago si tuvieras una colección 'payments'
            // Por ahora, solo actualizamos la deuda según lo solicitado.

            setIsModalOpen(false);
            fetchDebtors();
        } catch (err) {
            console.error(err);
            alert('Error al registrar abono');
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <p className="text-slate-500 dark:text-slate-400 col-span-full text-center py-12 font-bold uppercase text-xs tracking-widest">Cargando...</p>
                    ) : debtors.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-800 transition-colors">
                                <User className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">No hay deudores registrados.</p>
                        </div>
                    ) : (
                        debtors.map(debtor => (
                            <div key={debtor.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all p-6 flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-sm transition-colors border border-primary-100 dark:border-primary-800">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-lg transition-colors">{debtor.name}</h3>
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
                                            {debtor.amount_owed?.toFixed(2)}
                                        </p>
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 text-right uppercase tracking-widest">
                                            ~ {(debtor.amount_owed * rate).toFixed(2)} BS
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => openPaymentModal(debtor)}
                                    className="w-full px-5 py-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 justify-center border border-emerald-100 dark:border-emerald-900/40"
                                >
                                    <CheckCircle size={18} /> Registrar Abono
                                </button>
                            </div>
                        ))
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
                                        <div className="font-black text-red-700 dark:text-red-300 text-2xl">${selectedDebtor.amount_owed.toFixed(2)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-red-500/60 dark:text-red-400/50 uppercase tracking-widest">Equivalente</div>
                                        <div className="font-bold text-red-600/80 dark:text-red-400/80 text-sm">{(selectedDebtor.amount_owed * rate).toFixed(2)} Bs</div>
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
                                    {paymentAmount && (
                                        <div className="text-right px-2 animate-in fade-in slide-in-from-top-1">
                                            {isUsd ? (
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total: <span className="text-slate-900 dark:text-white">{(parseFloat(paymentAmount) * rate).toFixed(2)} Bs</span></span>
                                            ) : (
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total: <span className="text-slate-900 dark:text-white">${(parseFloat(paymentAmount) / rate).toFixed(2)} USD</span></span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Método de Pago */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Método de Recibo</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['EFECTIVO', 'PAGO MOVIL', 'ZELLE', 'TRANSFERENCIA'].map(method => (
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
            </div>
        </div>
    );
};

export default Debtors;
