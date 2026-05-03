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

    const fetchUserData = async (authUser) => {
        const meta = authUser.user_metadata || {};

        // PASO 1: Mostrar de inmediato para evitar pantalla blanca
        if (meta.role) {
            setCurrentUser({
                uid: authUser.id,
                email: authUser.email,
                name: meta.name || authUser.email,
                role: meta.role,
                assigned_bodega_id: meta.assigned_bodega_id || null,
            });
            setUserRole(meta.role);
            setLoading(false);
        } else {
            // Sin metadata → desbloquear UI de inmediato con fallback
            setCurrentUser({
                uid: authUser.id,
                email: authUser.email,
                name: authUser.email,
                role: 'EMPLOYEE',
                assigned_bodega_id: null,
            });
            setUserRole('EMPLOYEE');
            setLoading(false);
        }

        // PASO 2: Refrescar desde DB en background (actualiza rol/bodega real)
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
                    name: userData.name,
                    role: userData.role,
                    assigned_bodega_id: userData.assigned_bodega_id || null,
                });
                setUserRole(userData.role);
            }
        } catch (dbErr) {
            console.warn('Background DB refresh failed:', dbErr.message);
        }
        // No se necesita finally aquí — loading ya está en false desde el paso 1
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
                // Carga invisible (fondo blanco/oscuro) como pidió el usuario
                <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950" />
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
