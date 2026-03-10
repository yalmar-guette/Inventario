import React, { useState, useEffect } from 'react';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { RefreshCw, DollarSign, UserPlus, Loader2, Store, Plus, Trash2, Users, Database, Edit } from 'lucide-react';
import { supabase } from '../supabase';
import ConfirmModal from '../components/ConfirmModal';

const Settings = () => {
    const { userRole, currentUser } = useAuth();
    const { rate, updateRate, loading: configLoading } = useSystemConfig();
    const [newRate, setNewRate] = useState('');
    const [autoSyncType, setAutoSyncType] = useState('none'); // 'none', 'bcv', 'euro'
    const [savingSync, setSavingSync] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'EMPLOYEE', bodega_id: '' });
    const [editingUser, setEditingUser] = useState(null);
    const [creatingUser, setCreatingUser] = useState(false);
    const [fetchingApi, setFetchingApi] = useState({ bcv: false, euro: false });

    // Otros estados
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    // Estado para modal de confirmación de cambio de bodega
    const [confirmBodega, setConfirmBodega] = useState({
        isOpen: false,
        bodegaId: null,
        bodegaName: ''
    });
    // Bodegas state
    const [bodegas, setBodegas] = useState([]);
    const [showBodegaForm, setShowBodegaForm] = useState(false);
    const [newBodega, setNewBodega] = useState({ name: '', location: '' });
    const [creatingBodega, setCreatingBodega] = useState(false);

    // User Mgmt State
    const [usersList, setUsersList] = useState([]);

    const toast = useToast();

    useEffect(() => {
        if (userRole === 'OWNER') {
            fetchBodegas();
            fetchUsers();
            fetchSyncConfig();
        }
    }, [userRole]);

    const fetchSyncConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('system_config')
                .select('auto_sync_type')
                .eq('id', 'global')
                .maybeSingle();

            if (!error && data?.auto_sync_type) {
                setAutoSyncType(data.auto_sync_type);
            }
        } catch (err) {
            console.error("Error fetching sync config:", err);
        }
    };

    const fetchBodegas = async () => {
        try {
            const { data, error } = await supabase
                .from('bodegas')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;

            setBodegas(data || []);

            // Auto-seleccionar la primera bodega para nuevos usuarios
            if (data && data.length > 0 && !newUser.bodega_id) {
                setNewUser(prev => ({ ...prev, bodega_id: data[0].id }));
            }
        } catch (error) {
            console.error("Error loading bodegas:", error);
            setBodegas([]);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            setUsersList(data || []);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const handleDeleteUser = async (userId, userEmail) => {
        if (!window.confirm(`¿Estás seguro de eliminar a ${userEmail}? Su entrada al sistema será revocada.`)) return;

        try {
            // 1. Verificar existencia tabla users
            const { error, count } = await supabase
                .from('users')
                .delete({ count: 'exact' })
                .eq('id', userId);

            if (count === 0) {
                console.error("Error Supabase Delete:", error);
                alert(`ERROR AL ELIMINAR:\nMensaje: ${error.message}\nDetalle: ${error.details || 'N/A'}\nHint: ${error.hint || 'N/A'}`);
                return;
            }

            if (count === 0) {
                alert("ALERTA: La base de datos respondió 'Éxito' pero no borró ninguna fila.\nPosibles causas:\n1. El usuario ya no existe.\n2. La política RLS (Seguridad) bloqueó la operación silenciosamente.");
                return;
            }

            alert(`✅ ÉXITO: Usuario ${userEmail} eliminado correctamente.`);
            await fetchUsers();

        } catch (error) {
            console.error("Catch Delete Error:", error);
            alert("ERROR CRÍTICO DEL SISTEMA:\n" + (error.message || 'Desconocido'));
        }
    };

    const handleCreateBodega = async (e) => {
        e.preventDefault();
        setCreatingBodega(true);
        try {
            const finalId = newBodega.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000);

            const { error } = await supabase
                .from('bodegas')
                .insert([{
                    id: finalId,
                    name: newBodega.name,
                    location: newBodega.location,
                    active: true
                }]);

            if (error) throw error;

            toast.success('Bodega creada exitosamente');
            setNewBodega({ name: '', location: '' });
            setShowBodegaForm(false);
            fetchBodegas();
        } catch (error) {
            console.error(error);
            toast.error('Error al crear bodega');
        } finally {
            setCreatingBodega(false);
        }
    };

    const handleDeleteBodega = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de eliminar la bodega "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const { error } = await supabase
                .from('bodegas')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Bodega eliminada correctamente');
            fetchBodegas();
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar bodega');
        }
    };

    const handleSelectBodega = (bodegaId) => {
        if (!currentUser) return;

        const bodegaName = bodegas.find(b => b.id === bodegaId)?.name || 'esta bodega';

        // Abrir modal de confirmación
        setConfirmBodega({
            isOpen: true,
            bodegaId: bodegaId,
            bodegaName: bodegaName
        });
    };

    const executeSelectBodega = async () => {
        const { bodegaId, bodegaName } = confirmBodega;

        // Cerrar modal
        setConfirmBodega({ isOpen: false, bodegaId: null, bodegaName: '' });

        // 1. Feedback inmediato
        toast.info(`⏳ Cambiando a "${bodegaName}"...`, { duration: 1500 });

        try {
            // 2. Ejecutar cambio directamente
            // Actualizar en tabla users
            const { error } = await supabase
                .from('users')
                .update({ assigned_bodega_id: bodegaId })
                .eq('id', currentUser.uid);

            if (error) {
                console.error("Error updating bodega:", error);
                toast.error(`❌ Error: No se pudo cambiar de bodega`);
                return;
            }

            // Actualizar metadata de auth
            const { error: metadataError } = await supabase.auth.updateUser({
                data: {
                    assigned_bodega_id: bodegaId,
                    role: currentUser.role,
                    name: currentUser.name
                }
            });

            if (metadataError) console.error("Error updating metadata:", metadataError);

            // 3. Feedback de éxito claro
            toast.success(`✓ Ahora estás en: ${bodegaName}`, { duration: 2000 });

            // 4. Recargar brevemente después
            setTimeout(() => window.location.reload(), 1000);

        } catch (error) {
            toast.error(`❌ Error al cambiar de bodega`);
        }
    };

    if (userRole !== 'OWNER') {
        return <div className="text-slate-900 dark:text-slate-100 text-center mt-20 font-medium">Acceso Restringido</div>;
    }

    const handleUpdateRate = async (e) => {
        e.preventDefault();
        if (!newRate) return;
        try {
            const roundedRate = parseFloat(newRate).toFixed(2);
            await updateRate(roundedRate);
            setNewRate('');
            toast.success('Tasa actualizada correctamente');
        } catch (error) {
            toast.error('Error al actualizar tasa');
        }
    };

    const handleFetchRate = async (type) => {
        setFetchingApi(prev => ({ ...prev, [type]: true }));
        try {
            const endpoint = type === 'bcv'
                ? 'https://ve.dolarapi.com/v1/dolares/oficial'
                : 'https://ve.dolarapi.com/v1/euros';

            const response = await fetch(endpoint);
            if (!response.ok) throw new Error('Error al obtener tasa');

            const data = await response.json();
            let rateValue;

            if (type === 'euro' && Array.isArray(data)) {
                // Seleccionar la fuente 'oficial' si está presente, sino la primera
                const oficialEuro = data.find(e => e.fuente === 'oficial') || data[0];
                rateValue = oficialEuro?.promedio;
            } else {
                rateValue = data?.promedio;
            }

            if (typeof rateValue === 'number') {
                setNewRate(rateValue.toFixed(2));
                toast.success(`Tasa ${type.toUpperCase()} obtenida: ${rateValue.toFixed(2)}`);
            } else {
                throw new Error('Datos de tasa inválidos');
            }
        } catch (error) {
            console.error(`Error fetching ${type} rate:`, error);
            toast.error(`No se pudo obtener la tasa ${type.toUpperCase()}`);
        } finally {
            setFetchingApi(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleSaveSyncConfig = async () => {
        setSavingSync(true);
        try {
            // Actualizamos la DB. Al usar upsert falso (update directo), si la columna no existe 
            // fallará, pero en Supabase podemos crearla luego usando la UI asumiendo que el request va bien.
            // Para ser robustos en producción, esto asume que la migración SQL ya se corrió.
            const { error } = await supabase
                .from('system_config')
                .update({ auto_sync_type: autoSyncType })
                .eq('id', 'global');

            if (error) throw error;
            toast.success('Configuración de auto-sincronización guardada');
        } catch (error) {
            console.error("Error saving sync config:", error);
            toast.error('Error al guardar configuración automática');
        } finally {
            setSavingSync(false);
        }
    };

    // Helper robusto para generar UUIDs (funciona en http/https y navegadores viejos)
    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // Importar createClient para la instancia temporal necesita estar arriba, pero lo haremos con require o asumiendo que ya está disponible
    // Mejor modificamos los imports arriba en otro paso si es necesario, pero aquí usaremos las variables globales.

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setCreatingUser(true);

        console.log('🔵 Iniciando gestión de usuario...');

        try {
            if (editingUser) {
                // --- EDICIÓN (Solo actualiza perfil público) ---
                console.log('✏️ Actualizando usuario existente:', editingUser.id);

                // 1. Actualizar tabla pública users
                const { error } = await supabase
                    .from('users')
                    .update({
                        name: newUser.name,
                        email: newUser.email,
                        role: newUser.role,
                        assigned_bodega_id: newUser.bodega_id
                    })
                    .eq('id', editingUser.id);

                if (error) throw error;

                // Nota: No podemos cambiar el email o password de Auth desde aquí sin loguearnos como ese usuario
                // o usar funciones administrativas. Por ahora solo actualizamos el perfil.

                toast.success('Perfil de usuario actualizado correctamente');

            } else {
                // --- CREACIÓN (Auth + Perfil) ---
                console.log('🆕 Creando NUEVO usuario en sistema de autenticación...');

                // 1. Configurar cliente temporal para no cerrar sesión del admin
                // Necesitamos importar createClient. Como no puedo agregar imports fácilmente en este bloque,
                // usaré la instancia global supabase.auth.signUp, PERO esto cerraría sesión.
                // SOLUCIÓN: Usaremos la API REST de Supabase directamente para signUp si no podemos instanciar,
                // O mejor, asumimos que podemos importar createClient arriba. 
                // Dado que no puedo editar todo el archivo de una vez, haré un truco:
                // Instanciaré usando el constructor de la clase del cliente existente si es posible, 
                // pero lo más seguro es usar fetch a la API de Auth de Supabase.

                // URL de Auth
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                if (!newUser.password || newUser.password.length < 6) {
                    throw new Error("La contraseña debe tener al menos 6 caracteres");
                }

                // Usamos fetch directo a la API de GoTrue para evitar conflictos de sesión
                const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseAnonKey,
                        'Authorization': `Bearer ${supabaseAnonKey}`
                    },
                    body: JSON.stringify({
                        email: newUser.email,
                        password: newUser.password,
                        data: {
                            name: newUser.name,
                            role: newUser.role,
                            assigned_bodega_id: newUser.bodega_id
                        }
                    })
                });

                const authData = await response.json();

                if (!response.ok) {
                    throw new Error(authData.msg || authData.message || authData.error_description || "Error al registrar en Auth");
                }

                const newUserId = authData.user?.id || authData.id;

                if (!newUserId) {
                    throw new Error("No se recibió ID de usuario del sistema de autenticación");
                }

                console.log('✅ Usuario registrado en Auth con ID:', newUserId);

                // 2. Insertar en tabla pública 'users'
                // Primero verificamos si ya existe para evitar duplicados (por si el trigger falló o funcionó a medias)
                const { data: existingUser } = await supabase.from('users').select('id').eq('id', newUserId).single();

                if (!existingUser) {
                    console.log('📥 Insertando perfil público...');
                    const { error: insertError } = await supabase
                        .from('users')
                        .insert([{
                            id: newUserId,
                            email: newUser.email,
                            name: newUser.name,
                            role: newUser.role,
                            assigned_bodega_id: newUser.bodega_id
                        }]);

                    if (insertError) throw insertError;
                } else {
                    console.log('⚠️ El perfil público ya existía, actualizando...');
                    await supabase.from('users').update({
                        name: newUser.name,
                        role: newUser.role,
                        assigned_bodega_id: newUser.bodega_id
                    }).eq('id', newUserId);
                }

                toast.success(`Usuario ${newUser.email} registrado y activado correctamente`);
            }

            // Reset formulario
            setNewUser({
                email: '',
                password: '',
                name: '',
                role: 'EMPLOYEE',
                bodega_id: bodegas[0]?.id || ''
            });
            setEditingUser(null);

            await fetchUsers();

        } catch (error) {
            console.error('COMBO ERROR:', error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setCreatingUser(false);
        }
    };

    const startEditUser = (user) => {
        setEditingUser(user);
        setNewUser({
            name: user.name,
            email: user.email,
            role: user.role,
            bodega_id: user.assigned_bodega_id || '',
            password: '' // Password irrelevant for manual/update
        });
        // Scroll to form
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingUser(null);
        setNewUser({ email: '', password: '', name: '', role: 'EMPLOYEE', bodega_id: bodegas[0]?.id || '' });
    };

    const handleUpdateUserRole = async (userId, newRole) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            toast.success('Rol actualizado');
            fetchUsers();
        } catch (error) {
            toast.error('Error al actualizar rol');
        }
    };

    const handleUpdateUserBodega = async (userId, newBodegaId) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ assigned_bodega_id: newBodegaId })
                .eq('id', userId);

            if (error) throw error;

            toast.success('Bodega asignada actualizada');
            fetchUsers();
        } catch (error) {
            toast.error('Error al reasignar bodega');
        }
    };

    const handleClearCache = () => {
        if (window.confirm('¿Estás seguro de limpiar el caché? Esto recargará la página y puede ayudar a resolver problemas de datos desactualizados.')) {
            // Limpiar localStorage (excepto el tema)
            const theme = localStorage.getItem('theme');
            localStorage.clear();
            if (theme) localStorage.setItem('theme', theme);

            // Limpiar sessionStorage
            sessionStorage.clear();

            toast.success('Caché limpiado. Recargando...');

            // Recargar después de 1 segundo
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header - Centered */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white transition-colors">Configuración</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Ajustes generales y gestión de personal</p>
                </div>

                {/* Bodegas Section - Full Width */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 transition-colors">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800">
                                <Store size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gestionar Bodegas / Sucursales</h2>
                                <p className="text-slate-500 dark:text-slate-500 text-sm">Crea y administra múltiples inventarios</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowBodegaForm(!showBodegaForm)}
                            className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-primary-700 dark:hover:bg-primary-600 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-primary-200 dark:shadow-none"
                        >
                            <Plus size={20} />
                            Nueva Bodega
                        </button>
                    </div>

                    {showBodegaForm && (
                        <form onSubmit={handleCreateBodega} className="mb-6 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nombre de la Bodega</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                                        placeholder="Ej: Bodega Centro, Sucursal Norte"
                                        value={newBodega.name}
                                        onChange={e => setNewBodega({ ...newBodega, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ubicación</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                                        placeholder="Ej: Av. Principal, Caracas"
                                        value={newBodega.location}
                                        onChange={e => setNewBodega({ ...newBodega, location: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="submit"
                                    disabled={creatingBodega}
                                    className="px-6 py-2.5 bg-primary-600 dark:bg-primary-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-primary-700 dark:hover:bg-primary-600 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {creatingBodega ? <Loader2 className="animate-spin" size={16} /> : <Store size={16} />}
                                    Crear Bodega
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBodegaForm(false)}
                                    className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-[0.98] transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Lista de Bodegas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {bodegas.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                                No hay bodegas registradas. Crea la primera.
                            </div>
                        ) : (
                            bodegas.map(bodega => {
                                const isCurrent = currentUser?.assigned_bodega_id === bodega.id;
                                return (
                                    <div key={bodega.id} className={`p-5 rounded-2xl border transition-all group relative overflow-hidden ${isCurrent
                                        ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800'
                                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-700'
                                        }`}>
                                        <div className="flex items-start justify-between relative z-10">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-11 h-11 rounded-[1.25rem] flex items-center justify-center transition-colors ${isCurrent
                                                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-200 dark:shadow-none'
                                                    : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                                                    }`}>
                                                    <Store size={22} />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className={`font-black text-sm uppercase tracking-tight ${isCurrent ? 'text-primary-700 dark:text-primary-400' : 'text-slate-900 dark:text-white'}`}>{bodega.name}</h3>
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{bodega.location}</p>

                                                    {isCurrent ? (
                                                        <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-primary-200 dark:border-primary-800">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-400 animate-pulse" />
                                                            Bodega Actual
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleSelectBodega(bodega.id)}
                                                            className="mt-4 px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-200 dark:hover:border-primary-800 transition-all shadow-sm"
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {bodega.id !== 'main' && bodega.id !== 'bodega_1' && (
                                                <button
                                                    onClick={() => handleDeleteBodega(bodega.id, bodega.name)}
                                                    className="p-2 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                                                    title="Eliminar bodega"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                        {isCurrent && (
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 dark:bg-primary-400/5 -mr-8 -mt-8 rounded-full blur-2xl pointer-events-none" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Exchange Rate Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 transition-colors">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tasa de Cambio</h2>
                                <p className="text-slate-500 dark:text-slate-500 text-sm">BCV / Paralelo</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 mb-8 transition-colors">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tasa Actual</span>
                                <span className="text-3xl font-black text-slate-900 dark:text-white">{configLoading ? '...' : rate.toFixed(2)} BS/$</span>
                            </div>
                            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
                                <RefreshCw className={`w-6 h-6 text-emerald-500 ${configLoading ? 'animate-spin' : ''}`} />
                            </div>
                        </div>

                        <form onSubmit={handleUpdateRate} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nueva Tasa</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-black text-2xl"
                                    value={newRate}
                                    onChange={(e) => setNewRate(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <button
                                    type="button"
                                    disabled={fetchingApi.bcv}
                                    onClick={() => handleFetchRate('bcv')}
                                    className="py-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-widest rounded-xl border border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-[0.98] transition-all flex items-center gap-2 justify-center disabled:opacity-50"
                                >
                                    {fetchingApi.bcv ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Tasa BCV
                                </button>
                                <button
                                    type="button"
                                    disabled={fetchingApi.euro}
                                    onClick={() => handleFetchRate('euro')}
                                    className="py-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase tracking-widest rounded-xl border border-blue-100 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/30 active:scale-[0.98] transition-all flex items-center gap-2 justify-center disabled:opacity-50"
                                >
                                    {fetchingApi.euro ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Tasa Euro
                                </button>
                            </div>

                            <button type="submit" className="w-full py-4 bg-primary-600 dark:bg-primary-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-primary-700 dark:hover:bg-primary-600 active:scale-[0.98] transition-all flex items-center gap-3 justify-center shadow-lg shadow-primary-200 dark:shadow-none">
                                <RefreshCw size={20} />
                                Actualizar BS/$
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 transition-colors">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Actualización Automática Diaria</h3>
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Selecciona si deseas que el sistema actualice automáticamente la tasa todos los días al iniciar.
                                    La tasa será obtenida automáticamente.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <select
                                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white transition-all font-bold text-sm"
                                        value={autoSyncType}
                                        onChange={(e) => setAutoSyncType(e.target.value)}
                                    >
                                        <option value="none">Ninguna (Manual)</option>
                                        <option value="bcv">Tasa BCV</option>
                                        <option value="euro">Tasa Euro</option>
                                    </select>
                                    <button
                                        onClick={handleSaveSyncConfig}
                                        disabled={savingSync}
                                        className="px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
                                    >
                                        {savingSync ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* System Maintenance Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 transition-colors">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-orange-50 dark:bg-orange-950/30 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/40">
                                <Database size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mantenimiento</h2>
                                <p className="text-slate-500 dark:text-slate-500 text-sm">Optimización del sistema</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-5 bg-orange-50/50 dark:bg-orange-950/10 rounded-2xl border border-orange-100 dark:border-orange-900/30 transition-colors">
                                <h3 className="text-sm font-bold text-orange-900 dark:text-orange-300 mb-2">Limpiar Caché del Navegador</h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                                    Si experimentas datos desactualizados o problemas de rendimiento, limpiar el caché puede ayudar.
                                    Esta acción eliminará los datos temporales almacenados localmente y recargará la aplicación.
                                </p>
                                <button
                                    onClick={handleClearCache}
                                    className="w-full py-3 bg-orange-600 dark:bg-orange-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-orange-700 dark:hover:bg-orange-600 active:scale-[0.98] transition-all flex items-center gap-2 justify-center shadow-lg shadow-orange-200 dark:shadow-none"
                                >
                                    <RefreshCw size={18} />
                                    Limpiar Caché
                                </button>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">
                                    💡 Nota: Tu preferencia de tema (claro/oscuro) se mantendrá después de limpiar el caché.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* User Mgmt Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 transition-colors">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingUser ? 'Editar Empleado' : 'Registrar Empleado'}</h2>
                                <p className="text-slate-500 dark:text-slate-500 text-sm">{editingUser ? 'Modificar datos de acceso' : 'Crear acceso para cajeros'}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveUser} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nombre</label>
                                    <input
                                        required
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                                        placeholder="Nombre completo"
                                        value={newUser.name}
                                        onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                                        placeholder="empleado@bodega.com"
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all font-bold"
                                    placeholder="******"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Rol</label>
                                    <select
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white transition-all font-bold"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="EMPLOYEE">Empleado / Cajero</option>
                                        <option value="OWNER">Dueño / Admin</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Asignar a Bodega</label>
                                    <select
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white transition-all font-bold"
                                        value={newUser.bodega_id}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewUser(prev => ({ ...prev, bodega_id: val }));
                                        }}
                                    >
                                        {bodegas.length === 0 && <option value="">No hay bodegas</option>}
                                        {bodegas.map(bod => (
                                            <option key={bod.id} value={bod.id}>
                                                {bod.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button type="submit" disabled={creatingUser} className="flex-1 py-4 bg-primary-600 dark:bg-primary-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-primary-700 dark:hover:bg-primary-600 active:scale-[0.98] transition-all flex items-center gap-3 justify-center disabled:opacity-50 shadow-lg shadow-primary-200 dark:shadow-none mt-2">
                                    {creatingUser ? <Loader2 className="animate-spin" size={18} /> : (editingUser ? <RefreshCw size={18} /> : <UserPlus size={18} />)}
                                    {editingUser ? 'Guardar Cambios' : 'Registrar Empleado'}
                                </button>
                                {editingUser && (
                                    <button type="button" onClick={cancelEdit} className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all mt-2">
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Users List Section */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors mt-8">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Usuarios del Sistema</h2>
                            <p className="text-slate-500 dark:text-slate-500 text-sm">Lista de empleados y permisos</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/30">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Personal</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Acceso</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nivel de Permiso</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sede Asignada</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {usersList.map(u => {
                                    const assignedBodega = bodegas.find(b => b.id === u.assigned_bodega_id);
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                        {u.name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <span className="font-bold text-slate-900 dark:text-white">{u.name || 'Sin nombre'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-slate-500 dark:text-slate-400 font-medium">{u.email}</td>
                                            <td className="px-8 py-6">
                                                <select
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer outline-none ${u.role === 'OWNER'
                                                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    value={u.role}
                                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                                >
                                                    <option value="EMPLOYEE">Empleado</option>
                                                    <option value="OWNER">Dueño</option>
                                                </select>
                                            </td>
                                            <td className="px-8 py-6">
                                                <select
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none text-xs font-bold text-slate-600 dark:text-slate-400 py-2 transition-all cursor-pointer"
                                                    value={u.assigned_bodega_id || ''}
                                                    onChange={(e) => handleUpdateUserBodega(u.id, e.target.value)}
                                                >
                                                    <option value="" disabled>Seleccionar sede...</option>
                                                    {bodegas.map(b => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {assignedBodega && <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 uppercase tracking-widest font-medium">{assignedBodega.location}</div>}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {u.role !== 'OWNER' && u.email !== 'dueno@bodega.com' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => startEditUser(u)}
                                                            className="p-2 text-slate-400 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl transition-all"
                                                            title="Editar usuario"
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id, u.email)}
                                                            className="p-2 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                                                            title="Eliminar usuario"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {usersList.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-16 text-center text-slate-400 dark:text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                                            No se encontraron usuarios activos.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Sede/Bodega Management Table Section */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors mt-8">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900/40">
                            <Store size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Listado de Sedes</h2>
                            <p className="text-slate-500 dark:text-slate-500 text-sm">Registro técnico de locales</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/30">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nombre del Local</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Dirección / Ubicación</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Código de Sistema</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Panel de Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {bodegas.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                                        <td className="px-8 py-6 font-bold text-slate-900 dark:text-white">{b.name}</td>
                                        <td className="px-8 py-6 text-slate-500 dark:text-slate-400 font-medium">{b.location}</td>
                                        <td className="px-8 py-6">
                                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-mono text-xs rounded-lg border border-slate-200 dark:border-slate-700">
                                                {b.id}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            {b.id !== 'main' && b.id !== 'bodega_1' && (
                                                <button
                                                    onClick={() => handleDeleteBodega(b.id, b.name)}
                                                    className="p-3 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                                                    title="Eliminar bodega"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmBodega.isOpen}
                onClose={() => setConfirmBodega({ isOpen: false, bodegaId: null, bodegaName: '' })}
                onConfirm={executeSelectBodega}
                title="Confirmar Cambio de Bodega"
                message={`¿Desea cambiar a la bodega "${confirmBodega.bodegaName}"?\n\nLa página se recargará para aplicar los cambios.`}
                confirmText="Cambiar"
                cancelText="Cancelar"
                variant="warning"
            />
        </div>
    );
};

export default Settings;
