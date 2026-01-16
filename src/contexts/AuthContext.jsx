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

    console.log("AuthProvider Initializing. Loading:", loading);

    useEffect(() => {
        // Obtener sesión actual al cargar
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchUserData(session.user);
            } else {
                setLoading(false);
            }
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
            // Obtener datos adicionales del usuario desde la tabla users
            const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (error) {
                console.error("Error fetching user data:", error);
                // Si no existe en la tabla users, usar datos básicos
                setCurrentUser({
                    uid: authUser.id,
                    email: authUser.email,
                    ...authUser.user_metadata
                });
                setUserRole("EMPLOYEE"); // Rol por defecto
            } else {
                // Combinar datos de auth con datos de la tabla users
                setCurrentUser({
                    uid: userData.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role,
                    assigned_bodega_id: userData.assigned_bodega_id
                });
                setUserRole(userData.role);
            }
        } catch (error) {
            console.error("Error in fetchUserData:", error);
            setCurrentUser({
                uid: authUser.id,
                email: authUser.email
            });
        } finally {
            console.log("fetchUserData Finished. User:", authUser.email);
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
                <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Iniciando sesión...</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
