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
        try {
            // Siempre consultar la DB para tener datos frescos (rol, bodega actualizada)
            const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (error) {
                // Solo usar metadata como último recurso si la DB falla
                console.warn("DB query failed, using metadata fallback:", error.message);
                const meta = authUser.user_metadata || {};
                setCurrentUser({
                    uid: authUser.id,
                    email: authUser.email,
                    name: meta.name || authUser.email,
                    role: meta.role || "EMPLOYEE",
                    assigned_bodega_id: meta.assigned_bodega_id || null,
                });
                setUserRole(meta.role || "EMPLOYEE");
            } else {
                setCurrentUser({
                    uid: userData.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role,
                    assigned_bodega_id: userData.assigned_bodega_id || null,
                });
                setUserRole(userData.role);
            }
        } catch (error) {
            console.error("Error in fetchUserData:", error);
            const meta = authUser.user_metadata || {};
            setCurrentUser({
                uid: authUser.id,
                email: authUser.email,
                role: meta.role || "EMPLOYEE",
                assigned_bodega_id: meta.assigned_bodega_id || null,
                ...meta
            });
            setUserRole(meta.role || "EMPLOYEE");
        } finally {
            setLoading(false);
        }
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
        loading
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
