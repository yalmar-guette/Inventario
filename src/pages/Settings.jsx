import React, { useState, useEffect } from 'react';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { RefreshCw, DollarSign, UserPlus, Loader2, Store, Plus, Trash2, Users } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import app from '../firebase';

const secondaryApp = initializeApp(app.options, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

const Settings = () => {
    const { userRole, currentUser } = useAuth();
    const { rate, updateRate, loading: configLoading } = useSystemConfig();
    const [newRate, setNewRate] = useState('');
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'EMPLOYEE', bodega_id: '' });
    const [creatingUser, setCreatingUser] = useState(false);

    // Bodegas state
    const [bodegas, setBodegas] = useState([]);
    const [showBodegaForm, setShowBodegaForm] = useState(false);
    const [newBodega, setNewBodega] = useState({ name: '', location: '' });
    const [creatingBodega, setCreatingBodega] = useState(false);

    // User Mgmt State
    const [usersList, setUsersList] = useState([]);

    useEffect(() => {
        if (userRole === 'OWNER') {
            fetchBodegas();
            fetchUsers();
        }
    }, [userRole]);

    const fetchBodegas = async () => {
        try {
            const snap = await getDocs(collection(db, 'bodegas'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setBodegas(data || []);

            // Auto-seleccionar la primera bodega para nuevos usuarios
            if (data.length > 0 && !newUser.bodega_id) {
                setNewUser(prev => ({ ...prev, bodega_id: data[0].id }));
            }
        } catch (error) {
            console.error("Error loading bodegas:", error);
            setBodegas([]);
        }
    };

    const fetchUsers = async () => {
        try {
            const snap = await getDocs(collection(db, 'users'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsersList(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const handleDeleteUser = async (userId, userEmail) => {
        if (!window.confirm(`¿Estás seguro de eliminar a ${userEmail}? Su entrada al sistema será revocada.`)) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            toast.success('Usuario eliminado correctamente.');
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar usuario');
        }
    };

    const handleCreateBodega = async (e) => {
        e.preventDefault();
        setCreatingBodega(true);
        try {
            const finalId = newBodega.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000);

            // Using setDoc with custom ID strategy or addDoc is fine, but addDoc is safer for now.
            // Let's stick to addDoc but maybe we want readable IDs? 
            // The original used addDoc. Let's keep it but just add toast.
            await addDoc(collection(db, 'bodegas'), {
                name: newBodega.name,
                location: newBodega.location,
                createdAt: new Date(),
                active: true
            });
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
            await deleteDoc(doc(db, 'bodegas', id));
            toast.success('Bodega eliminada correctamente');
            fetchBodegas();
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar bodega');
        }
    };



    const handleSelectBodega = async (bodegaId) => {
        if (!currentUser) return;
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                assigned_bodega_id: bodegaId
            });
            // Force reload to update context and views
            window.location.reload();
        } catch (error) {
            console.error("Error updating bodega:", error);
            alert("Error al cambiar de bodega");
        }
    };

    if (userRole !== 'OWNER') {
        return <div className="text-slate-900 text-center mt-20 font-medium">Acceso Restringido</div>;
    }

    const toast = useToast();
    const handleUpdateRate = async (e) => {
        e.preventDefault();
        if (!newRate) return;
        try {
            await updateRate(newRate);
            setNewRate('');
            toast.success('Tasa actualizada correctamente');
        } catch (error) {
            toast.error('Error al actualizar tasa');
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreatingUser(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
                assigned_bodega_id: newUser.bodega_id,
                createdAt: new Date()
            });

            toast.success(`Usuario ${newUser.email} creado exitosamente.`);
            setNewUser({ email: '', password: '', name: '', role: 'EMPLOYEE', bodega_id: 'bodega_1' });
            await secondaryAuth.signOut();
            fetchUsers(); // Refresh list

        } catch (error) {
            console.error(error);
            toast.error("Error al crear usuario: " + error.message);
        } finally {
            setCreatingUser(false);
        }
    };

    // Placeholder for update user logic
    const handleUpdateUserRole = async (userId, newRole) => {
        try {
            await updateDoc(doc(db, 'users', userId), { role: newRole });
            toast.success('Rol actualizado');
            fetchUsers();
        } catch (error) {
            toast.error('Error al actualizar rol');
        }
    };

    const handleUpdateUserBodega = async (userId, newBodegaId) => {
        try {
            await updateDoc(doc(db, 'users', userId), { assigned_bodega_id: newBodegaId });
            toast.success('Bodega asignada actualizada');
            fetchUsers();
        } catch (error) {
            toast.error('Error al reasignar bodega');
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
                                                    className="p-2 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
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

                            <button type="submit" className="w-full py-4 bg-primary-600 dark:bg-primary-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-primary-700 dark:hover:bg-primary-600 active:scale-[0.98] transition-all flex items-center gap-3 justify-center shadow-lg shadow-primary-200 dark:shadow-none">
                                <RefreshCw size={20} />
                                Actualizar BS/$
                            </button>
                        </form>
                    </div>

                    {/* User Mgmt Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 transition-colors">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registrar Empleado</h2>
                                <p className="text-slate-500 dark:text-slate-500 text-sm">Crear acceso para cajeros</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-5">
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
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Contraseña temporal</label>
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

                            <button type="submit" disabled={creatingUser} className="w-full py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center gap-3 justify-center disabled:opacity-50 shadow-sm mt-2">
                                {creatingUser ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                                Registrar Empleado
                            </button>
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
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id, u.email)}
                                                        className="p-3 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                        title="Eliminar usuario"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
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
                                                    className="p-3 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
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
        </div>
    );
};

export default Settings;
