import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

export function useSystemConfig() {
    const [rate, setRate] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "system_config", "global"),
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    // Only update if value is valid number
                    if (typeof data.exchange_rate_bs === 'number') {
                        setRate(data.exchange_rate_bs);
                    }
                } else {
                    console.warn("System config document 'global' not found. waiting for initialization.");
                    // Do NOT auto-create with 0 here to prevent overwriting if it's just a permission/latency issue
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error listening to system config:", error);
                setLoading(false);
                // Keep previous rate if possible, or 0
            }
        );

        return () => unsub();
    }, []);

    const updateRate = async (newRate) => {
        const val = parseFloat(newRate);
        if (isNaN(val)) {
            console.error("Invalid rate:", newRate);
            throw new Error("Tasa inválida");
        }
        await setDoc(doc(db, "system_config", "global"), {
            exchange_rate_bs: val
        }, { merge: true });
    };

    return { rate, updateRate, loading };
}
