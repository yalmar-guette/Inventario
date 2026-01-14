import React, { useState, useEffect } from 'react';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useAuth } from '../contexts/AuthContext';
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
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'EMPLOYEE', bodega_id: 'bodega_1' });
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
            alert('Usuario eliminado correctamente de la base de datos.');
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar usuario');
        }
    };

    const handleCreateBodega = async (e) => {
        e.preventDefault();
        setCreatingBodega(true);
        try {
            await addDoc(collection(db, 'bodegas'), {
                name: newBodega.name,
                location: newBodega.location,
                createdAt: new Date(),
                active: true
            });
            alert('Bodega creada exitosamente');
            setNewBodega({ name: '', location: '' });
            setShowBodegaForm(false);
            fetchBodegas();
        } catch (error) {
            console.error(error);
            alert('Error al crear bodega');
        } finally {
            setCreatingBodega(false);
        }
    };

    const handleDeleteBodega = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de eliminar la bodega "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            await deleteDoc(doc(db, 'bodegas', id));
            alert('Bodega eliminada correctamente');
            fetchBodegas();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar bodega');
        }
    };

    const handleDeleteBodega = async (bodegaId) => {
        if (!window.confirm('¿Estás seguro de eliminar esta bodega? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'bodegas', bodegaId));
            alert('Bodega eliminada exitosamente');
            fetchBodegas();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar bodega');
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

    const handleUpdateRate = async (e) => {
        e.preventDefault();
        if (!newRate) return;
        try {
            await updateRate(newRate);
            setNewRate('');
            alert('Tasa actualizada correctamente');
        } catch (error) {
            alert('Error al actualizar tasa');
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

            alert(`Usuario ${newUser.email} creado exitosamente.`);
            setNewUser({ email: '', password: '', name: '', role: 'EMPLOYEE', bodega_id: 'bodega_1' });
            await secondaryAuth.signOut();

        } catch (error) {
            console.error(error);
            alert("Error al crear usuario: " + error.message);
        } finally {
            setCreatingUser(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header - Centered */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Configuración</h1>
                    <p className="text-slate-500 mt-2 text-sm">Ajustes generales y gestión de personal</p>
                </div>

                {/* Bodegas Section - Full Width */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
                                <Store size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Gestionar Bodegas / Sucursales</h2>
                                <p className="text-slate-500 text-sm">Crea y administra múltiples inventarios</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowBodegaForm(!showBodegaForm)}
                            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Nueva Bodega
                        </button>
                    </div>

                    {showBodegaForm && (
                        <form onSubmit={handleCreateBodega} className="mb-6 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Nombre de la Bodega</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                                        placeholder="Ej: Bodega Centro, Sucursal Norte"
                                        value={newBodega.name}
                                        onChange={e => setNewBodega({ ...newBodega, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Ubicación</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                                        placeholder="Ej: Av. Principal, Caracas"
                                        value={newBodega.location}
                                        onChange={e => setNewBodega({ ...newBodega, location: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    type="submit"
                                    disabled={creatingBodega}
                                    className="px-4 py-2 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {creatingBodega ? <Loader2 className="animate-spin" size={20} /> : <Store size={20} />}
                                    Crear Bodega
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBodegaForm(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Lista de Bodegas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {bodegas.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-slate-500">
                                No hay bodegas registradas. Crea la primera.
                            </div>
                        ) : (
                            bodegas.map(bodega => {
                                const isCurrent = currentUser?.assigned_bodega_id === bodega.id;
                                return (
                                    <div key={bodega.id} className={`p-4 rounded-2xl border transition-all group ${isCurrent ? 'bg-primary-50 border-primary-200' : 'bg-slate-50 border-slate-200 hover:border-primary-300'
                                        }`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCurrent ? 'bg-primary-500 text-white' : 'bg-white text-slate-400 border border-slate-200'
                                                    }`}>
                                                    <Store size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className={`font-bold ${isCurrent ? 'text-primary-700' : 'text-slate-900'}`}>{bodega.name}</h3>
                                                    <p className="text-xs text-slate-500 mt-1">{bodega.location}</p>

                                                    {isCurrent ? (
                                                        <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-1 bg-primary-100 text-primary-700 text-xs font-bold rounded-full">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-pulse" />
                                                            Bodega Actual
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleSelectBodega(bodega.id)}
                                                            className="mt-3 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 transition-colors shadow-sm"
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {bodega.id !== 'bodega_1' && (
                                                <button
                                                    onClick={() => handleDeleteBodega(bodega.id)}
                                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Eliminar bodega"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Exchange Rate Section */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Tasa de Cambio</h2>
                                <p className="text-slate-500 text-sm">BCV / Paralelo</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-4">
                            <span className="text-slate-500">Actual</span>
                            <span className="text-2xl font-bold text-slate-900">{configLoading ? '...' : rate.toFixed(2)} Bs/$</span>
                        </div>

                        <form onSubmit={handleUpdateRate} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nueva Tasa</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                                    value={newRate}
                                    onChange={(e) => setNewRate(e.target.value)}
                                />
                            </div>

                            <button type="submit" className="w-full px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center gap-2 justify-center">
                                <RefreshCw size={20} />
                                Actualizar Tasa
                            </button>
                        </form>
                    </div>

                    {/* User Mgmt Section */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Registrar Empleado</h2>
                                <p className="text-slate-500 text-sm">Crear acceso para cajeros</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nombre</label>
                                <input
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                                    placeholder="Nombre completo"
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Correo electrónico (Inicio de sesión)</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                                    placeholder="empleado@bodega.com"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 placeholder:text-slate-400"
                                    placeholder="******"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Rol</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900"
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="EMPLOYEE">Empleado / Cajero</option>
                                    <option value="OWNER">Dueño / Admin</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Asignar a Bodega</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900"
                                    value={newUser.bodega_id}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setNewUser(prev => ({ ...prev, bodega_id: val }));
                                    }}
                                >
                                    {bodegas.length === 0 && <option value="bodega_1">Bodega Principal (bodega_1)</option>}
                                    {bodegas.map(bod => (
                                        <option key={bod.id} value={bod.id}>
                                            {bod.name} - {bod.location}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" disabled={creatingUser} className="w-full px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center gap-2 justify-center disabled:opacity-50">
                                {creatingUser ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                                Crear Usuario
                            </button>
                        </form>
                    </div>
                </div>

                {/* Users List Section */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Usuarios del Sistema</h2>
                            <p className="text-slate-500 text-sm">Lista de empleados y permisos</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Nombre</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Rol</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Bodega Asignada</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {usersList.map(u => {
                                    const assignedBodega = bodegas.find(b => b.id === u.assigned_bodega_id);
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900">{u.name || 'Sin nombre'}</td>
                                            <td className="px-6 py-4 text-slate-600">{u.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 text-sm">
                                                {assignedBodega ? `${assignedBodega.name} (${assignedBodega.location})` : u.assigned_bodega_id || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {u.role !== 'OWNER' && (
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id, u.email)}
                                                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar usuario"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {usersList.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                                            No se encontraron usuarios.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
