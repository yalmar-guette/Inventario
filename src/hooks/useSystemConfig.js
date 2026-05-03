import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const API_ENDPOINTS = {
    bcv: 'https://ve.dolarapi.com/v1/dolares/oficial',
    euro: 'https://ve.dolarapi.com/v1/euros',
};

async function fetchRateFromApi(type) {
    const res = await fetch(API_ENDPOINTS[type]);
    if (!res.ok) throw new Error(`Error fetching ${type} rate`);
    const data = await res.json();
    if (type === 'euro' && Array.isArray(data)) {
        const oficial = data.find(e => e.fuente === 'oficial') || data[0];
        return parseFloat(oficial?.promedio);
    }
    return parseFloat(data?.promedio);
}

export function useSystemConfig(bodegaId = null) {
    const [rate, setRate] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfig();

        const globalSub = supabase
            .channel('system-config-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'system_config' },
                () => fetchConfig()
            )
            .subscribe();

        const bodegaSub = supabase
            .channel('bodegas-rate-channel')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'bodegas' },
                () => fetchConfig()
            )
            .subscribe();

        return () => {
            globalSub.unsubscribe();
            bodegaSub.unsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bodegaId]);

    const fetchConfig = async () => {
        try {
            // ── 1. Si hay bodegaId, leer configuración de esa bodega ──
            if (bodegaId) {
                const { data: bodega, error: bodegaError } = await supabase
                    .from('bodegas')
                    .select('exchange_rate, auto_sync_type')
                    .eq('id', bodegaId)
                    .maybeSingle();

                if (!bodegaError && bodega) {
                    const syncType = bodega.auto_sync_type ?? 'none';

                    if (syncType !== 'none') {
                        // ── Tasa automática por bodega ──
                        try {
                            const today = new Date().toISOString().split('T')[0];
                            // Sólo sincroniza una vez al día (usamos exchange_rate como caché)
                            // Para simplificar, siempre obtenemos la tasa fresca al cargar
                            const apiRate = await fetchRateFromApi(syncType);
                            if (!isNaN(apiRate) && apiRate > 0) {
                                const rounded = parseFloat(apiRate.toFixed(2));
                                setRate(rounded);
                                // Persistir en la bodega para offline
                                await supabase
                                    .from('bodegas')
                                    .update({ exchange_rate: rounded })
                                    .eq('id', bodegaId);
                                setLoading(false);
                                return;
                            }
                        } catch (apiErr) {
                            console.warn(`Auto-sync ${syncType} para bodega falló, usando caché:`, apiErr);
                        }
                        // Fallback al valor cacheado en exchange_rate
                        if (bodega.exchange_rate != null) {
                            setRate(bodega.exchange_rate);
                            setLoading(false);
                            return;
                        }
                    } else if (bodega.exchange_rate != null) {
                        // ── Tasa manual de la bodega ──
                        setRate(bodega.exchange_rate);
                        setLoading(false);
                        return;
                    }
                    // Si no hay nada en bodega, cae al global
                }
            }

            // ── 2. Fallback: tasa global de system_config ──
            const { data, error } = await supabase
                .from('system_config')
                .select('*')
                .eq('id', 'global')
                .maybeSingle();

            if (error) {
                console.error('Error fetching system config:', error);
                setRate(40.00);
            } else if (data) {
                if (typeof data.exchange_rate === 'number') {
                    setRate(data.exchange_rate);
                }

                // Sincronización automática global (una vez al día)
                try {
                    if (data.auto_sync_type && data.auto_sync_type !== 'none') {
                        const today = new Date().toISOString().split('T')[0];
                        if (!data.last_sync_date || data.last_sync_date < today) {
                            const apiRate = await fetchRateFromApi(data.auto_sync_type);
                            if (!isNaN(apiRate) && apiRate > 0) {
                                const rounded = parseFloat(apiRate.toFixed(2));
                                const { error: syncError } = await supabase
                                    .from('system_config')
                                    .update({ exchange_rate: rounded, last_sync_date: today })
                                    .eq('id', 'global');
                                if (!syncError) {
                                    setRate(rounded);
                                    console.log(`✅ Auto-sync global (${data.auto_sync_type}): ${rounded} BS/$`);
                                }
                            }
                        }
                    }
                } catch (syncErr) {
                    console.warn('Error en sincronización automática global:', syncErr);
                }
            } else {
                setRate(40.00);
            }
        } catch (err) {
            console.error('Error in fetchConfig:', err);
            setRate(40.00);
        } finally {
            setLoading(false);
        }
    };

    const updateRate = async (newRate) => {
        const val = parseFloat(newRate);
        if (isNaN(val)) throw new Error('Tasa inválida');

        if (bodegaId) {
            const { error } = await supabase
                .from('bodegas')
                .update({ exchange_rate: val })
                .eq('id', bodegaId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('system_config')
                .update({ exchange_rate: val })
                .eq('id', 'global');
            if (error) throw error;
        }
    };

    return { rate, updateRate, loading };
}
