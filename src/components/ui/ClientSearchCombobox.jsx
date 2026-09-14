import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '../../supabase';

const ClientSearchCombobox = ({ onSelect, selectedClient, onClear, onSelectNew }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch data with debounce
    useEffect(() => {
        if (!searchTerm.trim()) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        // Si ya hay un cliente seleccionado, no buscamos (el input muestra su nombre)
        if (selectedClient && searchTerm === selectedClient.name) {
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const term = searchTerm.trim();
                const isCode = /^\d+$/.test(term);
                
                let query = supabase
                    .from('clients')
                    .select('*')
                    .order('code', { ascending: true })
                    .limit(8);
                
                if (isCode) {
                    query = query.eq('code', parseInt(term));
                } else {
                    query = query.ilike('name', `%${term}%`);
                }

                const { data, error } = await query;
                if (error) throw error;
                
                setResults(data || []);
                setIsOpen(true);
                setHighlightedIndex(-1);
            } catch (err) {
                console.error("Error searching clients:", err);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [searchTerm, selectedClient]);

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < results.length) {
                handleSelect(results[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSelect = (client) => {
        setSearchTerm(client.name);
        setIsOpen(false);
        onSelect(client);
    };

    const handleClear = () => {
        setSearchTerm('');
        setResults([]);
        setIsOpen(false);
        onClear();
    };

    // Si ya hay cliente seleccionado, mostramos solo la tarjeta seleccionada
    if (selectedClient) {
        return (
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-4 relative z-10 w-full shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg tracking-widest">
                            #{String(selectedClient.code || '?').padStart(3, '0')}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">{selectedClient.name}</span>
                    </div>
                    <p className="text-xs text-rose-500 font-bold">
                        Deuda actual: ${(parseFloat(selectedClient.total_debt_usd) || 0).toFixed(2)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    aria-label="Borrar selección"
                >
                    <X size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative w-full z-50" ref={wrapperRef}>
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                
                <input
                    type="text"
                    placeholder="Buscar por nombre o código (001)..."
                    className="w-full pl-10 pr-10 py-3.5 bg-white dark:bg-slate-800 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl focus:outline-none focus:border-amber-400 text-slate-900 dark:text-white font-bold transition-all shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onFocus={() => { if (searchTerm.trim() && results.length > 0) setIsOpen(true); }}
                    onKeyDown={handleKeyDown}
                />
                
                {isLoading ? (
                    <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 animate-spin" />
                ) : searchTerm ? (
                    <button 
                        onClick={() => { setSearchTerm(''); setIsOpen(false); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                ) : null}
            </div>

            {/* Dropdown flotante con position absolute */}
            {isOpen && (
                <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {results.length > 0 ? (
                        <div className="py-2">
                            {results.map((client, index) => {
                                const isHighlighted = index === highlightedIndex;
                                const debt = parseFloat(client.total_debt_usd) || 0;
                                const hasDebt = debt > 0;

                                return (
                                    <button
                                        key={client.id}
                                        type="button"
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        onClick={() => handleSelect(client)}
                                        className={`w-full flex items-center justify-between px-5 py-3 transition-colors text-left border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${
                                            isHighlighted ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg">
                                                #{String(client.code || '?').padStart(3, '0')}
                                            </span>
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white text-sm">{client.name}</p>
                                                {client.phone && <p className="text-[10px] text-slate-400 mt-0.5">{client.phone}</p>}
                                            </div>
                                        </div>
                                        {hasDebt ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Deuda activa</span>
                                                <span className="text-xs font-black text-rose-600 dark:text-rose-400">${debt.toFixed(2)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg uppercase">
                                                Al día
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => { setIsOpen(false); onSelectNew(); }}
                                className="w-full flex items-center gap-2 px-5 py-3 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors font-bold text-sm border-t border-slate-100 dark:border-slate-700 mt-1"
                            >
                                <UserPlus size={16} /> Registrar nuevo cliente
                            </button>
                        </div>
                    ) : (
                        <div className="px-5 py-6 text-center">
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-3">
                                No se encontraron clientes. ¿Es un cliente nuevo?
                            </p>
                            <button
                                type="button"
                                onClick={() => { setIsOpen(false); onSelectNew(); }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl font-bold text-sm hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                            >
                                <UserPlus size={16} /> Crear cliente
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {/* Si no hay resultados desplegados y escribimos algo, dar opción rápida */}
            {!isOpen && !selectedClient && (
                <button
                    type="button"
                    onClick={onSelectNew}
                    className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                    <UserPlus size={14} /> Registrar como cliente nuevo
                </button>
            )}
        </div>
    );
};

export default ClientSearchCombobox;
