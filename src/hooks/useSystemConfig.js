import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useSystemConfig() {
    const [rate, setRate] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch inicial
        fetchConfig();

        // Suscribirse a cambios en tiempo real
        const subscription = supabase
            .channel('system-config-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'system_config' },
                (payload) => {
                    console.log('Config change detected:', payload);
                    if (payload.new && typeof payload.new.exchange_rate === 'number') {
                        setRate(payload.new.exchange_rate);
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('system_config')
                .select('*') // Seleccionar todo para obtener auto_sync_type y last_sync_date
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
                    // Verificar si las columnas existen en data (para retrocompatibilidad si aún no se crean en DB)
                    if (data.auto_sync_type && data.auto_sync_type !== 'none') {
                        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD local (aprox)

                        // Si no hay last_sync_date o es anterior a hoy
                        if (!data.last_sync_date || data.last_sync_date < today) {
                            console.log(`Auto-sync detectado para ${data.auto_sync_type}. Última sinc: ${data.last_sync_date}. Sincronizando hoy: ${today}`);

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

                                    // Actualizar DB con nueva tasa y fecha
                                    const { error: syncError } = await supabase
                                        .from('system_config')
                                        .update({
                                            exchange_rate: parseFloat(roundedRate),
                                            last_sync_date: today
                                        })
                                        .eq('id', 'global');

                                    if (!syncError) {
                                        console.log(`✅ Sincronización automática exitosa: ${roundedRate} BS/$`);
                                        setRate(parseFloat(roundedRate)); // Actualizar estado local
                                    } else {
                                        console.error("Error guardando sinc automática en DB:", syncError);
                                    }
                                }
                            }
                        }
                    }
                } catch (syncErr) {
                    console.error("Error en sincronización automática de tasa:", syncErr);
                }
                // --------------------------------------------------

            } else {
                // Si no hay datos, usar valor por defecto
                console.warn("No se encontró configuración. Usando tasa por defecto: 40.00 Bs/$");
                setRate(40.00);
            }
        } catch (error) {
            console.error("Error in fetchConfig:", error);
            // En caso de error crítico, usar valor por defecto
            setRate(40.00);
        } finally {
            setLoading(false);
        }
    };

    const updateRate = async (newRate) => {
        const val = parseFloat(newRate);
        if (isNaN(val)) {
            console.error("Invalid rate:", newRate);
            throw new Error("Tasa inválida");
        }

        const { error } = await supabase
            .from('system_config')
            .update({ exchange_rate: val })
            .eq('id', 'global');

        if (error) throw error;
    };

    return { rate, updateRate, loading };
}
