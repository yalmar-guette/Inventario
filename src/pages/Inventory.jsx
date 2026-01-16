import React, { useState, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Trash2, Edit, Package, AlertTriangle, ArrowUpDown } from 'lucide-react';
import ProductModal from '../components/ProductModal';

const Inventory = () => {
    const { currentUser, userRole } = useAuth();
    const { products, loading, error, addProduct, updateProduct, deleteProduct } = useInventory(currentUser?.assigned_bodega_id);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('stock-asc'); // Por defecto: Poco stock primero (accionable)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showGlobalCatalog, setShowGlobalCatalog] = useState(false);

    // Filtrar y Ordenar
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        const term = searchTerm.toLowerCase();
        const targetBodega = currentUser?.assigned_bodega_id || 'bodega_1';

        // 1. Filtrar
        let result = products.filter(product => {
            // Búsqueda de Texto
            const matchesText = (product.name || '').toLowerCase().includes(term) || product.barcode?.includes(term);

            // Visibilidad de Bodega: Mostrar si "Mostrar Global" está ACTIVADO O si el producto tiene entrada para esta bodega
            const hasBodegaEntry = product.stock && Object.prototype.hasOwnProperty.call(product.stock, targetBodega);
            const isVisible = showGlobalCatalog || hasBodegaEntry;

            return matchesText && isVisible;
        });

        // 2. Ordenar
        result.sort((a, b) => {
            // Respaldo 'bodega_1' si el usuario no tiene bodega asignada
            const stockA = a.stock?.[targetBodega] || 0;
            const stockB = b.stock?.[targetBodega] || 0;
            const priceA = parseFloat(a.price_usd) || 0;
            const priceB = parseFloat(b.price_usd) || 0;
            const salesA = a.sales_count || 0;
            const salesB = b.sales_count || 0;

            switch (sortOption) {
                case 'stock-asc': return stockA - stockB;
                case 'stock-desc': return stockB - stockA;
                case 'price-asc': return priceA - priceB;
                case 'price-desc': return priceB - priceA;
                case 'popularity-desc': return salesB - salesA;
                case 'name-asc': return a.name.localeCompare(b.name);
                default: return 0;
            }
        });

        return result;
    }, [products, searchTerm, sortOption, currentUser, showGlobalCatalog]);

    const handleSaveProduct = async (productData) => {
        try {
            if (editingProduct) {
                await updateProduct(editingProduct.id, productData);
            } else {
                await addProduct(productData);
            }
            setIsModalOpen(false);
            setEditingProduct(null);
        } catch (error) {
            console.error("Error saving product:", error);
            // Mostrar el mensaje específico del error
            const errorMessage = error?.message || error?.error?.message || JSON.stringify(error);
            alert(`Error al guardar producto: ${errorMessage}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            await deleteProduct(id);
        }
    };

    const openEdit = (product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const openCreate = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-6">
                {/* Encabezado - Centrado */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Inventario</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Gestión de productos y existencias</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-primary-50 dark:bg-primary-900/30 rounded-full border border-primary-100 dark:border-primary-800 transition-colors">
                        <span className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">
                            Bodega: {currentUser?.assigned_bodega_id === 'bodega_1' || !currentUser?.assigned_bodega_id ? 'Principal' : 'Sucursal ' + currentUser.assigned_bodega_id.slice(0, 4)}
                        </span>
                    </div>
                </div>

                {/* Alternar Catálogo Global */}
                {currentUser?.assigned_bodega_id !== 'bodega_1' && currentUser?.assigned_bodega_id && (
                    <div className="flex justify-end mb-2">
                        <label className="inline-flex items-center cursor-pointer gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={showGlobalCatalog}
                                onChange={(e) => setShowGlobalCatalog(e.target.checked)}
                            />
                            <div className="relative w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Ver Catálogo Global (Importar)</span>
                        </label>
                    </div>
                )}

                {/* Search and Add Button */}
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="glass-panel px-3 py-2 flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex-1 md:flex-none min-w-[170px]">
                            <ArrowUpDown size={16} className="text-slate-400 dark:text-slate-500" />
                            <select
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer w-full outline-none"
                            >
                                <option value="stock-asc">📉 Menor Stock</option>
                                <option value="stock-desc">📈 Mayor Stock</option>
                                <option value="popularity-desc">🔥 Más Vendidos</option>
                                <option value="price-desc">💰 Mayor Precio</option>
                                <option value="price-asc">🪙 Menor Precio</option>
                                <option value="name-asc">🔤 Nombre (A-Z)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 dark:text-slate-500 whitespace-nowrap font-bold uppercase text-[10px]">
                            {filteredProducts.length} productos
                        </span>
                        {userRole === 'OWNER' && (
                            <button onClick={openCreate} className="btn-primary whitespace-nowrap px-6">
                                <Plus size={20} /> Nuevo Item
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Producto</th>
                                    <th className="px-6 py-4">Código</th>
                                    <th className="px-6 py-4">Precio ($)</th>
                                    <th className="px-6 py-4">Stock</th>
                                    {userRole === 'OWNER' && <th className="px-6 py-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {error ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2">
                                                <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                                                <p className="text-red-500 font-bold text-sm">Error cargando inventario</p>
                                                <p className="text-slate-400 text-xs mb-3">{error.message}</p>
                                                <button
                                                    onClick={() => window.location.reload()}
                                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    Reintentar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : loading ? (
                                    <tr><td colSpan="5" className="text-center py-10 text-slate-400 dark:text-slate-600 font-bold uppercase text-[10px]">Cargando inventario...</td></tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-10 text-slate-400 dark:text-slate-600 font-bold uppercase text-[10px]">No se encontraron productos</td></tr>
                                ) : (
                                    filteredProducts.map(product => {
                                        const targetBodega = currentUser?.assigned_bodega_id || 'bodega_1';
                                        const stock = product.stock?.[targetBodega] || 0;
                                        const isOutOfStock = stock === 0;
                                        const isLowStock = stock > 0 && stock <= 5;

                                        return (
                                            <tr key={product.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold uppercase text-xs transition-colors">
                                                            {(product.name || '??').substring(0, 2)}
                                                        </div>
                                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm transition-colors">{product.name || 'Sin Nombre'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono text-xs uppercase tracking-widest">{product.barcode || '-'}</td>
                                                <td className="px-6 py-4 text-primary-600 dark:text-primary-400 font-black text-sm">${(parseFloat(product.price_usd) || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isOutOfStock ? 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400' :
                                                        isLowStock ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                                                            'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                                        } transition-colors border ${isOutOfStock ? 'border-red-100 dark:border-red-900/40' :
                                                            isLowStock ? 'border-amber-100 dark:border-amber-900/40' :
                                                                'border-emerald-100 dark:border-emerald-900/40'
                                                        }`}>
                                                        {isOutOfStock && <AlertTriangle size={12} />}
                                                        {isLowStock && <Package size={12} />}
                                                        {stock} UNIDADES
                                                    </div>
                                                </td>
                                                {userRole === 'OWNER' && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-all transform md:translate-x-1 md:group-hover:translate-x-0">
                                                            <button
                                                                onClick={() => openEdit(product)}
                                                                className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                                            >
                                                                <Edit size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(product.id)}
                                                                className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <ProductModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveProduct}
                    productToEdit={editingProduct}
                />
            </div>
        </div>
    );
};

export default Inventory;
