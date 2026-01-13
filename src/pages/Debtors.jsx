import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { User, CheckCircle, Phone } from 'lucide-react';

const Debtors = () => {
    const { currentUser } = useAuth();
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDebtors();
    }, []);

    const fetchDebtors = async () => {
        try {
            const activeBodegaId = currentUser?.assigned_bodega_id || 'main'; // Assume context provides currentUser, need to check if Debtors has it.
            // Wait, Debtors.jsx likely needs useAuth context if not present.
            // Let's assume for now I need to add useAuth if missing.
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

    const handlePayDebt = async (debtor) => {
        const amount = prompt(`Deuda actual: $${debtor.amount_owed}. ¿Cuánto desea abonar?`);
        if (!amount || isNaN(amount)) return;

        const val = parseFloat(amount);
        if (val <= 0) return;

        try {
            const newDebt = debtor.amount_owed - val;
            const ref = doc(db, 'debtors', debtor.id);

            if (newDebt <= 0.01) {
                await deleteDoc(ref);
                alert('Deuda pagada por completo. Cliente eliminado de lista.');
            } else {
                await updateDoc(ref, {
                    amount_owed: newDebt,
                    last_update: new Date()
                });
                alert('Abono registrado.');
            }
            fetchDebtors();
        } catch (err) {
            console.error(err);
            alert('Error al procesar pago');
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
                                    </div>
                                </div>

                                <button
                                    onClick={() => handlePayDebt(debtor)}
                                    className="w-full px-5 py-2.5 bg-emerald-50 text-emerald-700 font-medium rounded-xl hover:bg-emerald-100 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 justify-center border border-emerald-200"
                                >
                                    <CheckCircle size={18} /> Registrar Abono
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Debtors;
