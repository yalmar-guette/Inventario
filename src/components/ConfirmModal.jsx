import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'danger' }) => {
    if (!isOpen) return null;

    const colors = variant === 'danger'
        ? {
            icon: 'text-red-500 dark:text-red-400',
            bg: 'bg-red-50 dark:bg-red-950/30',
            border: 'border-red-100 dark:border-red-900/40',
            button: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
        }
        : variant === 'warning'
            ? {
                icon: 'text-amber-500 dark:text-amber-400',
                bg: 'bg-amber-50 dark:bg-amber-950/30',
                border: 'border-amber-100 dark:border-amber-900/40',
                button: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600'
            }
            : {
                icon: 'text-primary-500 dark:text-primary-400',
                bg: 'bg-primary-50 dark:bg-primary-950/30',
                border: 'border-primary-100 dark:border-primary-900/40',
                button: 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600'
            };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 animate-scale-in">
                {/* Header con Icono */}
                <div className={`p-6 ${colors.bg} ${colors.border} border-b`}>
                    <div className="flex items-start gap-4">
                        {variant === 'danger' ? (
                            <div className="flex-shrink-0">
                                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl">
                                    <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-shrink-0">
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-xl">
                                    <CheckCircle className={`w-6 h-6 ${colors.icon}`} />
                                </div>
                            </div>
                        )}
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {title}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Mensaje */}
                <div className="p-6">
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">
                        {message}
                    </p>
                </div>

                {/* Botones */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex gap-3 justify-end border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-6 py-2.5 rounded-xl font-medium text-white ${colors.button} transition-all shadow-sm`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
