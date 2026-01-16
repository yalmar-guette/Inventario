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
                .single();

            if (error) {
                console.error("Error fetching system config:", error);
            } else if (data && typeof data.exchange_rate === 'number') {
                setRate(data.exchange_rate);
            }
        } catch (error) {
            console.error("Error in fetchConfig:", error);
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
