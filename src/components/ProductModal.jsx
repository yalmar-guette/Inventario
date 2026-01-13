import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Package } from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                    <h2 className="text-xl font-bold text-slate-900">
                        {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nombre del Producto</label>
                        <input
                            required
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ejemplo: Harina Pan"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Precio de Venta ($)</label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                            value={formData.price_usd}
                            onChange={e => setFormData({ ...formData, price_usd: e.target.value })}
                            placeholder="0.00"
                        />
                    </div>

                    {/* Hidden cost field - internal only */}
                    <input type="hidden" value={formData.cost_usd || 0} />

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Código de Barras (Opcional)</label>
                        <input
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400 font-mono"
                            value={formData.barcode}
                            onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                            placeholder="ESCANEAR..."
                        />
                    </div>

                    {/* Stock field - both create and edit */}
                    <div className="bg-primary-50 p-4 rounded-2xl border border-primary-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="w-5 h-5 text-primary-600" />
                            <label className="text-sm font-bold text-primary-700">
                                {productToEdit ? 'Actualizar Stock' : 'Stock Inicial'}
                            </label>
                        </div>
                        <input
                            type="number"
                            min="0"
                            className="w-full px-4 py-2.5 bg-white border border-primary-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900"
                            value={formData.stock}
                            onChange={e => setFormData({ ...formData, stock: e.target.value })}
                            placeholder="0"
                        />
                        <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                            <AlertCircle size={12} />
                            {productToEdit
                                ? 'Se actualizará el stock de tu bodega actual'
                                : 'Se agregará a tu bodega actual'}
                        </p>
                    </div>

                    <div className="pt-4">
                        <button type="submit" className="w-full px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center gap-2 justify-center shadow-sm">
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
