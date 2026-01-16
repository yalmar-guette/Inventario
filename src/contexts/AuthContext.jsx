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
            // ESTRATEGIA DE VELOCIDAD:
            // 1. Si tenemos datos en los metadatos (JWT), usarlos DE INMEDIATO.
            // Esto elimina el tiempo de espera "Iniciando sesión..."
            const metadata = authUser.user_metadata || {};

            if (metadata.role) {
                setCurrentUser({
                    uid: authUser.id,
                    email: authUser.email,
                    name: metadata.name,
                    role: metadata.role,
                    assigned_bodega_id: metadata.assigned_bodega_id || 'bodega_1',
                    ...metadata
                });
                setUserRole(metadata.role);
                setLoading(false);
                return; // ¡Salimos ya! No esperamos a la DB.
            }

            // 2. Si NO hay metadatos, consultamos la DB (Lento, pero necesario la primera vez)
            // Timeout de seguridad de 5s para evitar bloqueo de login
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout fetching user data')), 5000)
            );

            // Obtener datos adicionales del usuario desde la tabla users
            const queryPromise = supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            const { data: userData, error } = await Promise.race([queryPromise, timeoutPromise]);

            if (error) {
                console.warn("Error fetching user details (using metadata fallback):", error.message);

                // FALLBACK ROBUSTO: Usar metadata del usuario (JWT)
                const metadataRole = authUser.user_metadata?.role;
                const metadataName = authUser.user_metadata?.name;

                setCurrentUser({
                    uid: authUser.id,
                    email: authUser.email,
                    name: metadataName,
                    role: metadataRole || "EMPLOYEE", // Usar rol del metadata o default
                    ...authUser.user_metadata
                });

                setUserRole(metadataRole || "EMPLOYEE");
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
            console.error("Error/Timeout in fetchUserData:", error);

            // FALLBACK EN CATCH
            const metadataRole = authUser.user_metadata?.role;

            setCurrentUser({
                uid: authUser.id,
                email: authUser.email,
                role: metadataRole || "EMPLOYEE",
                ...authUser.user_metadata
            });
            setUserRole(metadataRole || "EMPLOYEE");
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
                // Carga invisible (fondo blanco/oscuro) como pidió el usuario
                <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950" />
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
