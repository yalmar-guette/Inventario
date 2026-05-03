import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabase";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Obtener sesión actual al cargar
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchUserData(session.user);
            } else {
                setLoading(false);
            }
        }).catch((error) => {
            console.error("Error checking session:", error);
            setLoading(false);
        });

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
     * Fuente de verdad: SIEMPRE la DB.
     * JWT metadata solo se usa como fallback si la DB falla.
     * Esto evita el "flash" de rol incorrecto al recargar.
     */
    const fetchUserData = async (authUser) => {
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
        } catch (dbErr) {
            console.warn('DB fetch failed, using metadata fallback:', dbErr.message);
        }

        // Fallback: JWT metadata (si la DB falla por red u otro motivo)
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
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

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
                // Pantalla de carga invisible mientras se confirma el rol desde la DB
                <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950" />
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
