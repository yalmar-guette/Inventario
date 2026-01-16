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
            {!loading && children}
        </AuthContext.Provider>
    );
}
