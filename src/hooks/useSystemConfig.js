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
                .select('exchange_rate')
                .eq('id', 'global')
                .maybeSingle(); // Usar maybeSingle en lugar de single para evitar error si está vacía

            if (error) {
                console.error("Error fetching system config:", error);
                // Usar valor por defecto si hay error
                setRate(40.00);
            } else if (data && typeof data.exchange_rate === 'number') {
                setRate(data.exchange_rate);
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
