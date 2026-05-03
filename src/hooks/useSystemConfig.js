import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useSystemConfig(bodegaId = null) {
    const [rate, setRate] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfig();

        // Suscribirse a cambios en tiempo real en system_config (tasa global)
        const globalSub = supabase
            .channel('system-config-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'system_config' },
                (payload) => {
                    // Solo actualizar con global si no hay tasa de bodega específica
                    if (payload.new && typeof payload.new.exchange_rate === 'number') {
                        // Re-fetch para respetar la lógica de bodega > global
                        fetchConfig();
                    }
                }
            )
            .subscribe();

        // Suscribirse a cambios en bodegas (tasa por sede)
        const bodegaSub = supabase
            .channel('bodegas-rate-channel')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'bodegas' },
                () => { fetchConfig(); }
            )
            .subscribe();

        return () => {
            globalSub.unsubscribe();
            bodegaSub.unsubscribe();
        };
    }, [bodegaId]);

    const fetchConfig = async () => {
        try {
            // 1. Si hay bodegaId, intentar leer tasa específica de esa bodega
            if (bodegaId) {
                const { data: bodegaData, error: bodegaError } = await supabase
                    .from('bodegas')
                    .select('exchange_rate')
                    .eq('id', bodegaId)
                    .maybeSingle();

                if (!bodegaError && bodegaData?.exchange_rate != null) {
                    setRate(bodegaData.exchange_rate);
                    setLoading(false);
                    return; // Tasa de bodega encontrada, no necesitamos la global
                }
            }

            // 2. Fallback: leer tasa global de system_config
            const { data, error } = await supabase
                .from('system_config')
                .select('*')
                .eq('id', 'global')
                .maybeSingle();

            if (error) {
                console.error("Error fetching system config:", error);
                setRate(40.00);
            } else if (data) {
                if (typeof data.exchange_rate === 'number') {
                    setRate(data.exchange_rate);
                }

                // --- Lógica de Sincronización Automática Diaria ---
                try {
                    if (data.auto_sync_type && data.auto_sync_type !== 'none') {
                        const today = new Date().toISOString().split('T')[0];

                        if (!data.last_sync_date || data.last_sync_date < today) {
                            console.log(`Auto-sync para ${data.auto_sync_type}. Sincronizando hoy: ${today}`);

                            const endpoint = data.auto_sync_type === 'bcv'
                                ? 'https://ve.dolarapi.com/v1/dolares/oficial'
                                : 'https://ve.dolarapi.com/v1/euros';

                            const response = await fetch(endpoint);
                            if (response.ok) {
                                const apiData = await response.json();
                                let apiRate;

                                if (data.auto_sync_type === 'euro' && Array.isArray(apiData)) {
                                    const oficialEuro = apiData.find(e => e.fuente === 'oficial') || apiData[0];
                                    apiRate = oficialEuro?.promedio;
                                } else {
                                    apiRate = apiData?.promedio;
                                }

                                if (typeof apiRate === 'number') {
                                    const roundedRate = parseFloat(apiRate).toFixed(2);
                                    const { error: syncError } = await supabase
                                        .from('system_config')
                                        .update({
                                            exchange_rate: parseFloat(roundedRate),
                                            last_sync_date: today
                                        })
                                        .eq('id', 'global');

                                    if (!syncError) {
                                        console.log(`✅ Auto-sync: ${roundedRate} BS/$`);
                                        setRate(parseFloat(roundedRate));
                                    }
                                }
                            }
                        }
                    }
                } catch (syncErr) {
                    console.error("Error en sincronización automática:", syncErr);
                }
            } else {
                setRate(40.00);
            }
        } catch (error) {
            console.error("Error in fetchConfig:", error);
            setRate(40.00);
        } finally {
            setLoading(false);
        }
    };

    const updateRate = async (newRate) => {
        const val = parseFloat(newRate);
        if (isNaN(val)) throw new Error("Tasa inválida");

        // Si hay bodegaId, actualizar tasa de esa bodega
        if (bodegaId) {
            const { error } = await supabase
                .from('bodegas')
                .update({ exchange_rate: val })
                .eq('id', bodegaId);
            if (error) throw error;
        } else {
            // Actualizar tasa global
            const { error } = await supabase
                .from('system_config')
                .update({ exchange_rate: val })
                .eq('id', 'global');
            if (error) throw error;
        }
    };

    return { rate, updateRate, loading };
}
