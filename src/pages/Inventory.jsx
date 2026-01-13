import React, { useState, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Trash2, Edit, Package, AlertTriangle, ArrowUpDown } from 'lucide-react';
import ProductModal from '../components/ProductModal';

const Inventory = () => {
    const { currentUser, userRole } = useAuth();
    const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory(currentUser?.assigned_bodega_id);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('stock-asc'); // Default: Low stock first (actionable)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showGlobalCatalog, setShowGlobalCatalog] = useState(false);

    // Filter & Sort
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        const term = searchTerm.toLowerCase();
        const targetBodega = currentUser?.assigned_bodega_id || 'main';

        // 1. Filter
        let result = products.filter(product => {
            // Text Search
            const matchesText = product.name.toLowerCase().includes(term) || product.barcode?.includes(term);

            // Bodega Visibility: Show if "Show Global" is ON OR if product has entry for this bodega
            const hasBodegaEntry = product.stock && Object.prototype.hasOwnProperty.call(product.stock, targetBodega);
            const isVisible = showGlobalCatalog || hasBodegaEntry;

            return matchesText && isVisible;
        });

        // 2. Sort
        result.sort((a, b) => {
            // Fallback to 'main' if user has no assigned bodega
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
            alert("Error al guardar producto");
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
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header - Centered */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Inventario</h1>
                    <p className="text-slate-500 mt-2 text-sm">Gestión de productos y existencias</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-primary-50 rounded-full border border-primary-100">
                        <span className="text-xs font-bold text-primary-700 uppercase">
                            Bodega: {currentUser?.assigned_bodega_id === 'bodega_1' || !currentUser?.assigned_bodega_id ? 'Principal' : 'Sucursal ' + currentUser.assigned_bodega_id.slice(0, 4)}
                        </span>
                    </div>
                </div>

                {/* Global Catalog Toggle */}
                {currentUser?.assigned_bodega_id !== 'bodega_1' && currentUser?.assigned_bodega_id && (
                    <div className="flex justify-end mb-2">
                        <label className="inline-flex items-center cursor-pointer gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={showGlobalCatalog}
                                onChange={(e) => setShowGlobalCatalog(e.target.checked)}
                            />
                            <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                            <span className="text-sm font-medium text-slate-600">Ver Catálogo Global (Importar)</span>
                        </label>
                    </div>
                )}

                {/* Search and Add Button */}
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        {/* Sort Dropdown */}
                        <div className="glass-panel px-3 py-2 flex items-center gap-2 bg-white border border-slate-200 shadow-sm flex-1 md:flex-none min-w-[170px]">
                            <ArrowUpDown size={16} className="text-slate-400" />
                            <select
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 cursor-pointer w-full outline-none"
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
                        <span className="text-sm text-slate-500 whitespace-nowrap">
                            {filteredProducts.length} productos
                        </span>
                        {userRole === 'OWNER' && (
                            <button onClick={openCreate} className="btn-primary whitespace-nowrap">
                                <Plus size={20} /> Nuevo
                            </button>
                        )}
                    </div>
                </div>

                <div className="glass-panel overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-primary-50 text-text-muted text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Producto</th>
                                    <th className="px-6 py-4">Código</th>
                                    <th className="px-6 py-4">Precio ($)</th>
                                    <th className="px-6 py-4">Stock</th>
                                    {userRole === 'OWNER' && <th className="px-6 py-4 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center py-10 text-text-muted">Cargando inventario...</td></tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-10 text-text-muted">No se encontraron productos</td></tr>
                                ) : (
                                    filteredProducts.map(product => {
                                        // Fallback to 'main' if user has no assigned bodega
                                        const targetBodega = currentUser?.assigned_bodega_id || 'main';
                                        const stock = product.stock?.[targetBodega] || 0;
                                        const isLow = stock < 5; // Alert threshold

                                        return (
                                            <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 py-4 font-medium text-text-main">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-400 font-bold uppercase text-xs">
                                                            {product.name.substring(0, 2)}
                                                        </div>
                                                        {product.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-text-light font-mono text-sm">{product.barcode || '-'}</td>
                                                <td className="px-6 py-4 text-emerald-600 font-bold">${product.price_usd?.toFixed(2)}</td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isLow ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                                                        }`}>
                                                        {isLow && <AlertTriangle size={12} />}
                                                        {stock} u
                                                    </div>
                                                </td>
                                                {userRole === 'OWNER' && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => openEdit(product)}
                                                                className="p-2 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                                            >
                                                                <Edit size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(product.id)}
                                                                className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
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
