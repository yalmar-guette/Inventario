import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, ArrowUpDown, Grid3x3, LayoutGrid, Store, List, ChevronRight, Package } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import AuthorizationModal from '../components/AuthorizationModal';
import { supabase } from '../supabase';
import { useToast } from '../contexts/ToastContext';

const POS = () => {
    // Contextos
    const { currentUser, userRole } = useAuth();
    // Usar 'bodega_1' como respaldo si assigned_bodega_id no está definido
    const activeBodegaId = currentUser?.assigned_bodega_id || 'bodega_1';
    const { products } = useInventory(activeBodegaId);
    const { rate: exchangeRate } = useSystemConfig();
    const toast = useToast();

    // Fetch Bodega Name for UI
    const [bodegaName, setBodegaName] = useState('Cargando...');
    React.useEffect(() => {
        const fetchBodegaName = async () => {
            if (activeBodegaId === 'bodega_1') {
                setBodegaName('Bodega Principal');
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('bodegas')
                    .select('name')
                    .eq('id', activeBodegaId)
                    .single();

                if (error) throw error;
                setBodegaName(data?.name || 'Bodega Desconocida');
            } catch (err) {
                setBodegaName(activeBodegaId);
            }
        };
        fetchBodegaName();
    }, [activeBodegaId]);

    // Estado Local
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('popularity-desc'); // Por defecto: Más populares
    const [cart, setCart] = useState([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    // Filtrar y Ordenar Productos
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        const term = searchTerm.toLowerCase();

        // 1. Filtrar
        let result = products.filter(p => {
            const matchesText = (p.name || '').toLowerCase().includes(term) || (p.barcode && p.barcode.includes(term));
            // Aislamiento Estricto: Ocultar items con stock 0 a menos que "existan" en la estructura de esta bodega
            const hasEntry = p.stock && Object.prototype.hasOwnProperty.call(p.stock, activeBodegaId);
            return matchesText && hasEntry;
        });

        // 2. Ordenar
        result.sort((a, b) => {
            const stockA = a.stock?.[activeBodegaId] || 0;
            const stockB = b.stock?.[activeBodegaId] || 0;
            const priceA = parseFloat(a.price_usd) || 0;
            const priceB = parseFloat(a.price_usd) || 0;
            const salesA = a.sales_count || 0;
            const salesB = b.sales_count || 0;

            switch (sortOption) {
                case 'stock-desc': return stockB - stockA;
                case 'stock-asc': return stockA - stockB;
                case 'price-desc': return priceB - priceA;
                case 'price-asc': return priceA - priceB;
                case 'popularity-desc': return salesB - salesA;
                case 'name-asc': return a.name.localeCompare(b.name);
                default: return 0;
            }
        });

        return result;
    }, [products, searchTerm, sortOption, activeBodegaId]);

    // Operaciones del Carrito
    const addToCart = (product) => {
        setCart(currentCart => {
            const existingItem = currentCart.find(item => item.id === product.id);
            const availableStock = product.stock?.[activeBodegaId] || 0;

            if (existingItem) {
                if (existingItem.quantity >= availableStock) {
                    alert(`Stock máximo alcanzado (${availableStock})`);
                    return currentCart;
                }
                return currentCart.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...currentCart, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(currentCart => currentCart.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, change) => {
        setCart(currentCart => currentCart.map(item => {
            if (item.id === productId) {
                const availableStock = item.stock?.[activeBodegaId] || 0;

                // Bloquear incremento si se alcanza el stock
                if (change > 0 && item.quantity >= availableStock) {
                    alert(`Stock máximo alcanzado (${availableStock})`);
                    return item;
                }

                const newQuantity = Math.max(1, item.quantity + change);
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const clearCart = () => {
        setCart([]);
    };

    const requestClearCart = () => {
        if (userRole === 'OWNER') {
            clearCart();
        } else {
            setPendingAction('CLEAR_CART');
            setIsAuthModalOpen(true);
        }
    };

    const handleAuthSuccess = () => {
        if (pendingAction === 'CLEAR_CART') {
            clearCart();
        }
        setPendingAction(null);
    };

    // Calcular Total - ESTILO BUCLE IMPERATIVO
    let finalCartTotal = 0;
    let totalItems = 0;

    // Usando un bucle básico para evitar rarezas con reduce
    for (const item of cart) {
        // Asegurar que los valores son números
        const pRaw = item.price_usd;
        const qRaw = item.quantity;
        const p = parseFloat(pRaw);
        const q = parseInt(qRaw);

        // Solo sumar si es válido
        if (!isNaN(p) && !isNaN(q)) {
            finalCartTotal += (p * q);
            totalItems += q;
        }
    }

    const validRate = parseFloat(exchangeRate) || 0;
    const subtotalBs = finalCartTotal * validRate;

    // Procesamiento de Pagos
    const handleProcessPayment = async ({ payments, debtor, totalUSD, totalBs }) => {
        try {
            const saleData = {
                bodega_id: activeBodegaId,
                cashier_id: currentUser?.uid,
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: parseInt(item.quantity),
                    price_usd: parseFloat(item.price_usd)
                })),
                payment_method: payments[0]?.method || 'CASH', // Método principal
                payments: payments,
                total_usd: totalUSD,
                total_bs: totalBs
            };

            // 1. Crear Registro de Venta
            const { data: saleRecord, error: saleError } = await supabase
                .from('sales')
                .insert([saleData])
                .select()
                .single();

            if (saleError) throw saleError;

            // 2. Manejar Deudor (si aplica)
            if (debtor) {
                const debtPayments = payments.filter(p => p.method === 'FIADO');
                const debtAmountUSD = debtPayments.reduce((sum, p) =>
                    sum + (p.isUsd ? p.amount : p.amount / validRate), 0);

                const { error: debtorError } = await supabase
                    .from('debtors')
                    .insert([{
                        name: debtor.name,
                        phone: debtor.phone,
                        bodega_id: activeBodegaId,
                        total_debt_usd: debtAmountUSD,
                        total_debt_bs: debtAmountUSD * validRate,
                        sale_id: saleRecord.id
                    }]);

                if (debtorError) throw debtorError;
            }

            // 3. Actualizar Inventario y Conteo de Ventas
            for (const item of cart) {
                // Obtener stock actual
                const { data: currentProduct } = await supabase
                    .from('products')
                    .select('stock, sales_count')
                    .eq('id', item.id)
                    .single();

                if (currentProduct) {
                    const currentStock = currentProduct.stock || {};
                    const newStock = {
                        ...currentStock,
                        [activeBodegaId]: (currentStock[activeBodegaId] || 0) - item.quantity
                    };

                    const { error: updateError } = await supabase
                        .from('products')
                        .update({
                            stock: newStock,
                            sales_count: (currentProduct.sales_count || 0) + item.quantity
                        })
                        .eq('id', item.id);

                    if (updateError) throw updateError;
                }
            }

            toast.success('¡Venta procesada con éxito!');
            setCart([]);
            setIsPaymentModalOpen(false);

        } catch (error) {
            console.error("Error processing sale:", error);
            toast.error("Error al procesar la venta: " + error.message);
        }
    };

    const [viewMode, setViewMode] = useState('compact'); // por defecto, compacto

    return (
        <div className="flex flex-col md:flex-row h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                totalUSD={finalCartTotal}
                cart={cart}
                exchangeRate={validRate}
                onProcessPayment={handleProcessPayment}
            />
            <AuthorizationModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={handleAuthSuccess}
            />

            {/* Sección de Productos */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800">
                {/* Cabecera de búsqueda mejorada */}
                <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Registrar Ventas</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Store className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] md:text-xs uppercase tracking-wider font-bold">{bodegaName}</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código o nombre..."
                                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                                <ArrowUpDown className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-1" />
                                <select
                                    className="bg-transparent border-none text-xs font-bold text-slate-600 dark:text-slate-300 focus:ring-0 outline-none pr-6"
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value)}
                                >
                                    <option value="popularity-desc">Populares</option>
                                    <option value="name-asc">A-Z</option>
                                    <option value="stock-desc">Más Stock</option>
                                    <option value="stock-asc">Menos Stock</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                                <button
                                    onClick={() => setViewMode('default')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'default' ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-400'}`}
                                >
                                    <Grid3x3 size={16} />
                                </button>
                                <button
                                    onClick={() => setViewMode('compact')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'compact' ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-400'}`}
                                >
                                    <LayoutGrid size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cuadrícula de productos */}
                <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
                    {filteredProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Package className="w-16 h-16 opacity-10 mb-4" />
                            <p className="font-bold uppercase tracking-widest text-xs">No se encontraron productos</p>
                        </div>
                    ) : (
                        <div className={`grid gap-4 ${viewMode === 'compact'
                            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                            }`}>
                            {filteredProducts.map(product => {
                                const stock = product.stock?.[activeBodegaId] || 0;
                                const isOutOfStock = stock === 0;
                                const isLowStock = stock > 0 && stock <= 5;

                                return (
                                    <motion.div
                                        key={product.id}
                                        whileHover={!isOutOfStock ? { y: -4, scale: 1.02 } : {}}
                                        whileTap={!isOutOfStock ? { scale: 0.98 } : {}}
                                        onClick={() => !isOutOfStock && addToCart({ ...product, price_usd: parseFloat(product.price_usd) })}
                                        className={`relative group bg-white dark:bg-slate-900 rounded-2xl border ${isOutOfStock
                                            ? 'border-red-100 dark:border-red-900/40 bg-red-50/10'
                                            : 'border-slate-200 dark:border-slate-800 hover:border-primary-500 dark:hover:border-primary-400 shadow-sm'
                                            } p-3 transition-all cursor-pointer overflow-hidden ${viewMode === 'compact' ? 'flex flex-col' : ''}`}
                                    >
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors">
                                                    <Package className={`w-4 h-4 ${isOutOfStock ? 'text-red-400' : 'text-primary-600 dark:text-primary-400'}`} />
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-base font-black text-slate-900 dark:text-white">${parseFloat(product.price_usd).toFixed(2)}</div>
                                                </div>
                                            </div>

                                            <div className="flex-1">
                                                <h3 className={`font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors ${viewMode === 'compact' ? 'text-xs' : 'text-sm'}`}>
                                                    {product.name}
                                                </h3>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5 tracking-wider truncate">{product.barcode}</p>
                                            </div>

                                            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'}`}></div>
                                                    <span className={`text-[10px] font-bold ${isOutOfStock ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {stock} disp.
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {isOutOfStock && <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[1px] pointer-events-none transition-colors"></div>}
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Carrito de Ventas */}
            <div className="w-full md:w-96 bg-white dark:bg-slate-900 flex flex-col border-l border-slate-200 dark:border-slate-800 transition-colors shadow-xl z-20">
                <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-600 rounded-xl shadow-lg shadow-primary-500/20">
                            <ShoppingCart className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white transition-colors">Carrito</h2>
                    </div>
                    <span className="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {totalItems} items
                    </span>
                </div>

                <div className="flex-1 overflow-auto p-4 md:p-6 space-y-3 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 space-y-4">
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full transition-colors border border-slate-100 dark:border-slate-800">
                                <ShoppingCart className="w-12 h-12 opacity-20" />
                            </div>
                            <p className="font-bold uppercase tracking-widest text-[10px]">El carrito está vacío</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={item.id}
                                className="group bg-white dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 hover:border-primary-200 dark:hover:border-primary-900 transition-all shadow-sm"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate transition-colors">{item.name}</h4>
                                        <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 mt-0.5">$ {parseFloat(item.price_usd).toFixed(2)} c/u</p>
                                    </div>
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700 transition-colors">
                                        <button
                                            onClick={() => updateQuantity(item.id, -1)}
                                            className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-8 text-center font-black text-xs text-slate-900 dark:text-white">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.id, 1)}
                                            className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-900 dark:text-white">$ {(parseFloat(item.price_usd) * item.quantity).toFixed(2)}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
                            <div className="text-right">
                                <div className="text-4xl font-black text-primary-600 dark:text-primary-400 tracking-tighter">
                                    ${finalCartTotal.toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Equivalente en Bolívares</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">{subtotalBs.toLocaleString()} Bs</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                        <button
                            onClick={requestClearCart}
                            disabled={cart.length === 0}
                            className="col-span-1 flex items-center justify-center aspect-square bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all disabled:opacity-30 disabled:grayscale"
                            title="Limpiar Carrito (Requiere Autorización)"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => cart.length > 0 && setIsPaymentModalOpen(true)}
                            disabled={cart.length === 0}
                            className="col-span-4 bg-primary-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary-500/30 hover:bg-primary-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            Procesar Pago
                            <ChevronRight className="w-5 h-5 invisible md:visible" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default POS;
