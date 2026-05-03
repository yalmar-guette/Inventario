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
        // getSession() para carga inicial → una sola llamada a fetchUserData
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchUserData(session.user);
            } else {
                setLoading(false);
            }
        }).catch(() => setLoading(false));

        // onAuthStateChange: SOLO reacciona a login nuevo y cierre de sesión.
        // Ignoramos INITIAL_SESSION y TOKEN_REFRESHED para evitar doble-fetch → AbortError.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                fetchUserData(session.user);
            } else if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                setUserRole(null);
                setLoading(false);
            }
            // TOKEN_REFRESHED e INITIAL_SESSION son ignorados intencionalmente
        });

        return () => subscription.unsubscribe();
    }, []);

    /**
     * La DB es siempre la fuente de verdad para el ROL.
     * Esto evita el flash EMPLOYEE→OWNER por metadata de JWT desactualizada.
     * El JWT metadata solo actúa como fallback si la DB no responde.
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
                setLoading(false);
                return;
            }
        } catch (dbErr) {
            console.warn('DB fetch failed, usando metadata como fallback:', dbErr.message);
        }

        // Fallback: JWT metadata (si la DB no respondió)
        const meta = authUser.user_metadata || {};
        setCurrentUser({
            uid: authUser.id,
            email: authUser.email,
            name: meta.name || authUser.email,
            role: meta.role || 'EMPLOYEE',
            assigned_bodega_id: meta.assigned_bodega_id || null,
        });
        setUserRole(meta.role || 'EMPLOYEE');
        setLoading(false);
    };

    // Actualiza assigned_bodega_id en estado local SIN recargar página
    const updateAssignedBodega = (bodegaId) => {
        setCurrentUser(prev => prev ? { ...prev, assigned_bodega_id: bodegaId } : prev);
    };

    const login = async (email, password) => {
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
