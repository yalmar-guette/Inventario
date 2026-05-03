import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    // Evita llamadas concurrentes a fetchUserData (AbortError)
    const fetchingRef = useRef(false);

    useEffect(() => {
        /**
         * onAuthStateChange con Supabase v2 dispara INITIAL_SESSION al registrarse,
         * por lo que NO necesitamos llamar getSession() por separado.
         * Llamarlos juntos causaba doble-fetch → AbortError en consola.
         */
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                setUserRole(null);
                setLoading(false);
                return;
            }

            if (session?.user) {
                await fetchUserData(session.user);
            } else {
                setCurrentUser(null);
                setUserRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    /**
     * Fuente de verdad: SIEMPRE la DB (no JWT metadata).
     * Esto evita que un empleado vea vista de OWNER por metadata desactualizada.
     * JWT metadata solo se usa como fallback si la DB falla por red.
     */
    const fetchUserData = async (authUser) => {
        // Si ya hay un fetch en curso, lo ignoramos para evitar AbortError
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            const { data: userData, error } = await supabase
                .from('users')
                .select('id, email, name, role, assigned_bodega_id')
                .eq('id', authUser.id)
                .single();

            if (!error && userData) {
                setCurrentUser({
                    uid: userData.id,
                    email: userData.email,
                    name: userData.name || authUser.email,
                    role: userData.role,
                    assigned_bodega_id: userData.assigned_bodega_id || null,
                });
                setUserRole(userData.role);
                return;
            }

            // Si la query devuelve error (ej: row not found), usamos metadata
            console.warn('DB user not found, using metadata fallback. Error:', error?.message);
        } catch (dbErr) {
            console.warn('DB fetch failed, using metadata fallback:', dbErr.message);
        } finally {
            // SIEMPRE desbloquear la UI y permitir siguiente fetch
            setLoading(false);
            fetchingRef.current = false;
        }

        // Fallback: JWT metadata (solo si la DB falló)
        const meta = authUser.user_metadata || {};
        setCurrentUser({
            uid: authUser.id,
            email: authUser.email,
            name: meta.name || authUser.email,
            role: meta.role || 'EMPLOYEE',
            assigned_bodega_id: meta.assigned_bodega_id || null,
        });
        setUserRole(meta.role || 'EMPLOYEE');
    };

    // Actualiza assigned_bodega_id en estado local SIN recargar página
    const updateAssignedBodega = (bodegaId) => {
        setCurrentUser(prev => prev ? { ...prev, assigned_bodega_id: bodegaId } : prev);
    };

    const login = async (email, password) => {
        // Al hacer login, permitir nuevo fetchUserData
        fetchingRef.current = false;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = {
        currentUser,
        userRole,
        login,
        logout,
        loading,
        updateAssignedBodega,
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950" />
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
