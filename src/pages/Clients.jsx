import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import { 
    Search, UserPlus, Phone, X, AlertCircle, CheckCircle2, ChevronRight, Hash 
} from 'lucide-react';
import clsx from 'clsx';

const Clients = () => {
    const { currentUser } = useAuth();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all'); // all, debt, clear
    
    // Nuevo cliente modal
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', nickname: '', phone: '', address: '', notes: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchClients();
    }, [currentUser]);

    const fetchClients = async () => {
        try {
            const activeBodegaId = currentUser?.assigned_bodega_id;
            let query = supabase.from('clients').select('*').order('created_at', { ascending: false });

            if (activeBodegaId) {
                query = query.eq('bodega_id', activeBodegaId);
            }

            const { data, error } = await query;
            if (error) throw error;
            
            // Para poder filtrar, necesitamos obtener el saldo.
            // Para simplificar esta vista inicial, usaremos un RPC o 
            // asumiremos que la DB devuelve un cálculo si tuviéramos una vista.
            // Como no tenemos vista todavía que exponga saldos a esta query,
            // iteraremos para llamar a get_client_statement. (NOTA: en prod es mejor una VIEW).
            
            const clientsWithBalances = await Promise.all((data || []).map(async (client) => {
                const { data: stData, error: stError } = await supabase.rpc('get_client_statement', { client_id_param: client.id });
                let balance = 0;
                if (!stError && stData && stData.length > 0) {
                    balance = parseFloat(stData[0].saldo_actual) || 0;
                }
                return { ...client, current_balance: balance };
            }));

            setClients(clientsWithBalances);
        } catch (err) {
            console.error("Error fetching clients", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClient = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('clients').insert({
                name: newClient.name,
                nickname: newClient.nickname || null,
                phone: newClient.phone || null,
                address: newClient.address || null,
                notes: newClient.notes || null,
                bodega_id: currentUser?.assigned_bodega_id
            });
            if (error) throw error;
            
            setIsNewModalOpen(false);
            setNewClient({ name: '', nickname: '', phone: '', address: '', notes: '' });
            fetchClients();
        } catch (err) {
            console.error(err);
            alert("Error al crear cliente");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredClients = clients.filter(client => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
            client.name.toLowerCase().includes(searchLower) || 
            (client.nickname && client.nickname.toLowerCase().includes(searchLower)) ||
            (client.phone && client.phone.includes(searchTerm)) ||
            (client.code && client.code.toString().includes(searchTerm));
            
        const hasDebt = client.current_balance > 0.05;
        const matchesFilter = 
            filter === 'all' ? true : 
            filter === 'debt' ? hasDebt : 
            !hasDebt;
            
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
            {/* Header Sticky Móvil */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Directorio</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestión de Clientes</p>
                    </div>
                    <button 
                        onClick={() => setIsNewModalOpen(true)}
                        className="bg-primary-600 hover:bg-primary-700 text-white p-3 md:px-5 md:py-2.5 rounded-2xl shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <UserPlus size={20} />
                        <span className="hidden md:inline font-bold text-sm">Nuevo Cliente</span>
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, apodo, teléfono..."
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* Filtros Chips Scroll Horizontal */}
                    <div className="flex overflow-x-auto gap-2 pb-1 md:pb-0 hide-scrollbar snap-x shrink-0">
                        <button 
                            onClick={() => setFilter('all')}
                            className={clsx("px-5 py-3 rounded-2xl font-bold text-xs whitespace-nowrap snap-start transition-all", filter === 'all' ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}
                        >
                            Todos
                        </button>
                        <button 
                            onClick={() => setFilter('debt')}
                            className={clsx("px-5 py-3 rounded-2xl font-bold text-xs whitespace-nowrap snap-start transition-all", filter === 'debt' ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}
                        >
                            Con Deuda Activa
                        </button>
                        <button 
                            onClick={() => setFilter('clear')}
                            className={clsx("px-5 py-3 rounded-2xl font-bold text-xs whitespace-nowrap snap-start transition-all", filter === 'clear' ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}
                        >
                            Al Día
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid de Clientes */}
            <div className="flex-1 p-4 md:p-6 lg:p-8">
                {loading ? (
                    <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : filteredClients.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="text-slate-400" size={24} />
                        </div>
                        <p className="font-bold text-slate-500 dark:text-slate-400">No se encontraron clientes.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredClients.map(client => {
                            const hasDebt = client.current_balance > 0.05;
                            return (
                                <div key={client.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col hover:border-primary-300 dark:hover:border-primary-700 transition-colors shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg tracking-widest shrink-0">
                                                    #{String(client.code || '?').padStart(3, '0')}
                                                </span>
                                                <h3 className="font-bold text-slate-900 dark:text-white truncate text-base">{client.name}</h3>
                                            </div>
                                            {client.nickname && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-1 truncate">"{client.nickname}"</p>
                                            )}
                                        </div>
                                    </div>

                                    {client.phone && (
                                        <div className="flex items-center gap-2 mb-4">
                                            <a 
                                                href={`https://wa.me/${client.phone.replace(/\D/g,'')}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 hover:scale-110 transition-transform"
                                            >
                                                <Phone size={14} />
                                            </a>
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{client.phone}</span>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                        <div className="flex items-center gap-2">
                                            {hasDebt ? (
                                                <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-xl flex-1">
                                                    <AlertCircle size={16} />
                                                    <span className="text-xs font-black">DEUDA: ${client.current_balance.toFixed(2)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl flex-1">
                                                    <CheckCircle2 size={16} />
                                                    <span className="text-xs font-black">AL DÍA</span>
                                                </div>
                                            )}
                                        </div>

                                        <Link 
                                            to={`/clients/${client.id}`}
                                            className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors active:scale-[0.98]"
                                        >
                                            Ver Estado de Cuenta
                                            <ChevronRight size={16} className="text-slate-400" />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Nuevo Cliente */}
            {isNewModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-8 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                            <div>
                                <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">Nuevo Cliente</h3>
                            </div>
                            <button onClick={() => setIsNewModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateClient} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo *</label>
                                <input required type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-bold" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Apodo (Opcional)</label>
                                <input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-bold" placeholder="Ej. Juan Mecánico" value={newClient.nickname} onChange={e => setNewClient({...newClient, nickname: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono (WhatsApp)</label>
                                <input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-bold" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Notas</label>
                                <textarea className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-medium resize-none h-24" value={newClient.notes} onChange={e => setNewClient({...newClient, notes: e.target.value})} />
                            </div>
                            
                            <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-4 bg-primary-600 hover:bg-primary-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-primary-500/20 active:scale-[0.98] transition-all">
                                {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;
