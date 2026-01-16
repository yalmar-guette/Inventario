import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Package, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ProductModal = ({ isOpen, onClose, onSave, productToEdit }) => {
    const { currentUser } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        price_usd: '',
        cost_usd: '',
        barcode: '',
        stock: 0
    });

    useEffect(() => {
        if (productToEdit) {
            // Get stock for current bodega
            const currentStock = productToEdit.stock?.[currentUser?.assigned_bodega_id] || 0;
            setFormData({
                name: productToEdit.name,
                price_usd: productToEdit.price_usd,
                cost_usd: productToEdit.cost_usd || 0,
                barcode: productToEdit.barcode || '',
                stock: currentStock
            });
        } else {
            setFormData({ name: '', price_usd: '', cost_usd: '', barcode: '', stock: 0 });
        }
    }, [productToEdit, isOpen, currentUser]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            price_usd: parseFloat(formData.price_usd),
            cost_usd: parseFloat(formData.cost_usd) || 0,
            initialStock: parseInt(formData.stock) || 0
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Gestión de Inventario</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nombre del Producto</label>
                        <input
                            required
                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ej: Harina Pan 1kg"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Precio de Venta ($)</label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                                    <DollarSign size={18} />
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full pl-11 pr-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white font-black text-lg transition-all"
                                    value={formData.price_usd}
                                    onChange={e => setFormData({ ...formData, price_usd: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Barra / Código</label>
                            <input
                                className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-mono font-bold"
                                value={formData.barcode}
                                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                placeholder="ESCANEAR..."
                            />
                        </div>
                    </div>

                    <div className="bg-primary-50/50 dark:bg-slate-800/60 p-5 rounded-[2rem] border border-primary-100 dark:border-slate-700 relative overflow-hidden transition-colors">
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600 dark:text-primary-400">
                                <Package size={20} />
                            </div>
                            <label className="text-xs font-black text-primary-700 dark:text-primary-400 uppercase tracking-widest">
                                {productToEdit ? 'Actualizar Existencia' : 'Existencia Inicial'}
                            </label>
                        </div>
                        <input
                            type="number"
                            min="0"
                            className="w-full px-5 py-3.5 bg-white dark:bg-slate-900 border-2 border-primary-200 dark:border-slate-600 rounded-2xl focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white font-black text-xl transition-all relative z-10 shadow-sm"
                            value={formData.stock}
                            onChange={e => setFormData({ ...formData, stock: e.target.value })}
                            placeholder="0"
                        />
                        <p className="text-[10px] font-bold text-primary-600/80 dark:text-primary-400/60 mt-3 flex items-center gap-2 relative z-10 px-1">
                            <AlertCircle size={14} />
                            {productToEdit
                                ? 'Se actualizará el stock físico en el inventario actual'
                                : 'Se registrará como stock de apertura'}
                        </p>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 dark:bg-primary-400/5 -mr-8 -mt-8 rounded-full blur-2xl" />
                    </div>

                    <div className="pt-4">
                        <button type="submit" className="w-full py-4 bg-primary-600 dark:bg-primary-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-primary-700 dark:hover:bg-primary-600 active:scale-[0.98] transition-all flex items-center gap-3 justify-center shadow-lg shadow-primary-200 dark:shadow-none translate-y-0 hover:-translate-y-0.5">
                            <Save size={20} />
                            Guardar Producto
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductModal;
