import React, { useState, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, ArrowUpDown, Grid3x3, LayoutGrid, Store } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import AuthorizationModal from '../components/AuthorizationModal';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';

const POS = () => {
    // Contextos
    const { currentUser, userRole } = useAuth();
    // Usar 'main' como respaldo si assigned_bodega_id no está definido
    const activeBodegaId = currentUser?.assigned_bodega_id || 'main';
    const { products } = useInventory(activeBodegaId);
    const { rate: exchangeRate } = useSystemConfig();
    const { toast } = useToast();

    // Fetch Bodega Name for UI
    const [bodegaName, setBodegaName] = useState('Cargando...');
    React.useEffect(() => {
        const fetchBodegaName = async () => {
            if (activeBodegaId === 'main') {
                setBodegaName('Bodega Principal (Main)');
                return;
            }
            try {
                const docSnap = await getDoc(doc(db, 'bodegas', activeBodegaId));
                if (docSnap.exists()) {
                    setBodegaName(docSnap.data().name);
                } else {
                    setBodegaName('Bodega Desconocida');
                }
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
            const matchesText = p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.includes(term));
            // Aislamiento Estricto: Ocultar items con stock 0 a menos que "existan" en la estructura de esta bodega
            const hasEntry = p.stock && Object.prototype.hasOwnProperty.call(p.stock, activeBodegaId);
            return matchesText && hasEntry;
        });

        // 2. Ordenar
        result.sort((a, b) => {
            const stockA = a.stock?.[activeBodegaId] || 0;
            const stockB = b.stock?.[activeBodegaId] || 0;
            const priceA = parseFloat(a.price_usd) || 0;
            const priceB = parseFloat(b.price_usd) || 0;
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
                cashier_name: currentUser?.name || currentUser?.email || 'Desconocido',
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: parseInt(item.quantity),
                    price_usd: parseFloat(item.price_usd)
                })),
                payments,
                totalUSD,
                totalBs,
                exchangeRate: validRate,
                timestamp: serverTimestamp(),
                status: 'COMPLETED'
            };

            // 1. Crear Registro de Venta
            const saleRef = await addDoc(collection(db, 'sales'), saleData);

            // 2. Manejar Deudor (si aplica)
            if (debtor) {
                const debtPayments = payments.filter(p => p.method === 'FIADO');
                const debtAmountUSD = debtPayments.reduce((sum, p) =>
                    sum + (p.isUsd ? p.amount : p.amount / validRate), 0);

                await addDoc(collection(db, 'debtors'), {
                    ...debtor,
                    bodega_id: activeBodegaId,
                    amount_owed: debtAmountUSD,
                    last_sale_id: saleRef.id,
                    last_update: serverTimestamp()
                });
            }

            // 3. Actualizar Inventario y Conteo de Ventas
            const batchPromises = cart.map(item => {
                const productRef = doc(db, 'products', item.id);
                const stockField = `stock.${activeBodegaId}`;
                return updateDoc(productRef, {
                    [stockField]: increment(-item.quantity),
                    sales_count: increment(item.quantity)
                });
            });
            await Promise.all(batchPromises);

            toast.success('¡Venta procesada con éxito!');
            setCart([]);
            setIsPaymentModalOpen(false);

        } catch (error) {
            console.error("Error processing sale:", error);
            toast.error("Error al procesar la venta: " + error.message);
        }
    };

    const [viewMode, setViewMode] = useState('compact'); // por defecto, compacto

    // ... (código de filtro existente)

    return (
        <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-theme(spacing.24))] gap-6 animate-fade-in relative notranslate" translate="no">
            {/* ... (Modals remain same) */}
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

            {/* Left Column: Products */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Search Bar */}
                <div className="glass-panel p-4 flex gap-4 items-center sticky top-0 z-10 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400 transition-all shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Bodega Indicator */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 shadow-sm">
                        <Store size={16} />
                        <span className="text-xs font-bold whitespace-nowrap">{bodegaName}</span>
                    </div>
                </div>

                <div className="flex gap-2 items-center ml-auto">
                    {/* View Mode Toggle */}
                    <div className="glass-panel p-1 flex items-center bg-white border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setViewMode('default')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'default' ? 'bg-primary-100 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Vista Normal"
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('compact')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'compact' ? 'bg-primary-100 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Vista Compacta"
                        >
                            <Grid3x3 size={20} />
                        </button>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="glass-panel px-3 py-2 flex items-center gap-2 bg-white/80 backdrop-blur-sm">
                        <ArrowUpDown size={16} className="text-slate-400" />
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 cursor-pointer outline-none w-32"
                        >
                            <option value="popularity-desc">🔥 Populares</option>
                            <option value="name-asc">🔤 Nombre</option>
                            <option value="stock-asc">📉 - Stock</option>
                            <option value="stock-desc">📈 + Stock</option>
                            <option value="price-desc">💰 + Precio</option>
                            <option value="price-asc">🪙 - Precio</option>
                        </select>
                    </div>
                </div>

                {/* Tasa Display */}
                <div className="glass-panel px-4 py-2 flex flex-col justify-center items-end shadow-sm bg-white/80 backdrop-blur-sm hidden md:flex">
                    <span className="text-xs text-text-muted font-medium">Tasa BCV</span>
                    <span className={`font-bold text-lg ${parseFloat(exchangeRate) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {parseFloat(exchangeRate) > 0 ? `${parseFloat(exchangeRate).toFixed(2)} Bs/$` : 'SIN TASA'}
                    </span>
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 glass-panel p-4 lg:overflow-y-auto custom-scrollbar">
                {filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <p>No se encontraron productos</p>
                    </div>
                ) : (
                    <div className={`grid gap-4 transition-all duration-300 ${viewMode === 'compact'
                        ? 'grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
                        : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}>
                        {filteredProducts.map(product => {
                            const stock = product.stock?.[activeBodegaId] || 0;
                            const price = parseFloat(product.price_usd);
                            const hasStock = stock > 0;

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => hasStock && addToCart(product)}
                                    disabled={!hasStock}
                                    className={`relative rounded-xl border text-left transition-all duration-200 flex flex-col items-center group
                                            ${viewMode === 'compact' ? 'p-2' : 'p-4'}
                                            ${hasStock
                                            ? 'bg-white border-slate-100 hover:border-primary-300 hover:shadow-lg hover:-translate-y-1'
                                            : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'}`}
                                >
                                    <div className={`w-full aspect-square mb-3 bg-primary-50 rounded-lg flex items-center justify-center group-hover:bg-primary-100 transition-colors ${viewMode === 'compact' ? 'mb-2' : 'mb-3'}`}>
                                        <span className={`font-bold text-primary-400 uppercase ${viewMode === 'compact' ? 'text-lg' : 'text-2xl'}`}>
                                            {product.name.slice(0, 2)}
                                        </span>
                                    </div>
                                    <div className="w-full">
                                        <h3 className={`font-bold text-text-main truncate text-center mb-1 ${viewMode === 'compact' ? 'text-xs' : 'text-sm'}`}>{product.name}</h3>
                                        <div className="flex justify-between items-center w-full mt-2">
                                            <span className={`font-medium text-slate-500 bg-slate-100 rounded-full ${viewMode === 'compact' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}`}>
                                                {stock}
                                            </span>
                                            <span className={`font-bold text-primary-600 ${viewMode === 'compact' ? 'text-sm' : 'text-lg'}`}>
                                                ${price.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="w-full lg:w-96 flex flex-col glass-panel overflow-hidden border-l border-white/60 shadow-xl">
                    {/* Cart Header */}
                    <div className="p-5 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-text-main font-bold text-xl">
                                <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                                    <ShoppingCart size={20} />
                                </div>
                                <span>Carrito ({totalItems})</span>
                            </div>
                            <span className="text-[10px] text-gray-300">v3-LOOP</span>
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 lg:flex-auto lg:overflow-y-auto min-h-[250px] p-3 space-y-2 bg-slate-50/50 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                                    <ShoppingCart size={40} className="opacity-50" />
                                </div>
                                <p className="font-medium">El carrito está vacío</p>
                            </div>
                        ) : (
                            cart.map(item => {
                                const price = parseFloat(item.price_usd);
                                const total = price * item.quantity;

                                return (
                                    <div key={item.id} className="bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm animate-slide-up">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-slate-800 pr-2 leading-tight text-sm line-clamp-1">{item.name}</h4>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="text-xs">
                                                <div className="text-slate-500">${price.toFixed(2)} x {item.quantity}</div>
                                                <div className="font-bold text-emerald-600 text-base">${total.toFixed(2)}</div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="w-7 h-7 flex items-center justify-center bg-white shadow-sm rounded-md text-slate-600 hover:text-primary-600 active:scale-95"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="font-bold w-4 text-center text-sm">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="w-7 h-7 flex items-center justify-center bg-white shadow-sm rounded-md text-slate-600 hover:text-primary-600 active:scale-95"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Cart Footer */}
                    <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-slate-500 font-medium">
                                <span>Subtotal (USD)</span>
                                <span className="font-bold text-emerald-600">${finalCartTotal.toFixed(2)}</span>
                            </div>
                            <div className="w-full h-px bg-slate-100" />
                            <div className="flex justify-between items-end">
                                <span className="text-lg font-bold text-slate-800">Total a Pagar</span>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-slate-900 leading-tight">
                                        ${finalCartTotal.toFixed(2)}
                                    </div>
                                    <div className="text-sm text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                        ~ {subtotalBs.toFixed(2)} Bs
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            <button
                                onClick={requestClearCart}
                                disabled={cart.length === 0}
                                className="col-span-1 flex items-center justify-center bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={24} />
                            </button>
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                disabled={cart.length === 0}
                                className="col-span-3 btn-primary text-lg py-4 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 disabled:shadow-none"
                            >
                                Procesar Pago
                            </button>
                        </div>
                    </div>
                </div>
            </div >
            );
};

            export default POS;
