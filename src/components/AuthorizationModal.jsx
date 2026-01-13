import React, { useState } from 'react';
import { Lock, Loader2, X } from 'lucide-react';

const AuthorizationModal = ({ isOpen, onClose, onSuccess, title = "Autorización Requerida" }) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(false);

        await new Promise(resolve => setTimeout(resolve, 600));

        // DEMO PIN: 1234
        if (pin === '1234') {
            onSuccess();
            onClose();
            setPin('');
        } else {
            setError(true);
            setPin('');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-100 w-full max-w-sm rounded-2xl shadow-xl p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4 text-rose-500 shadow-sm">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-text-main text-center">{title}</h3>
                    <p className="text-sm text-text-muted text-center mt-1">Ingrese el PIN del Dueño</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        autoFocus
                        maxLength={4}
                        className="w-full bg-slate-50 text-center text-3xl tracking-[1em] py-4 rounded-xl border border-slate-200 focus:border-primary-300 outline-none text-text-main font-mono placeholder:tracking-normal focus:bg-white transition-all shadow-inner"
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    />

                    {error && <p className="text-rose-500 text-sm text-center animate-pulse">PIN Incorrecto</p>}

                    <button
                        type="submit"
                        disabled={loading || pin.length < 4}
                        className="btn-primary w-full shadow-primary-200"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Autorizar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AuthorizationModal;
