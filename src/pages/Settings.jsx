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
import { migrarBodegas } from '../utils/migrarBodegas';
import { migrarVentasABodega1 } from '../utils/migrarVentas';
import { DiagnosticoButton } from '../components/DiagnosticoButton';

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

    // Estado para migración
    const [migrating, setMigrating] = useState(false);
    const [migratingVentas, setMigratingVentas] = useState(false);

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

    const handleMigrarBodegas = async () => {
        if (!window.confirm('⚠️ Esta acción consolidará todas las bodegas y usuarios a usar "main" como bodega principal.\n\n¿Deseas continuar?')) return;

        setMigrating(true);
        try {
            const result = await migrarBodegas();
            toast.success(`✅ Migración completada: ${result.usersActualizados} usuarios y ${result.ventasActualizadas} ventas actualizadas`);

            // Recargar datos
            await fetchBodegas();
            await fetchUsers();

            // Mostrar mensaje para recargar
            setTimeout(() => {
                if (window.confirm('La migración fue exitosa. ¿Deseas recargar la página para ver los cambios?')) {
                    window.location.reload();
                }
            }, 2000);

        } catch (error) {
            console.error(error);
            toast.error('Error durante la migración: ' + error.message);
        } finally {
            setMigrating(false);
        }
    };

    const handleMigrarVentas = async () => {
        if (!window.confirm('⚠️ Esto actualizará todas las ventas con bodega_id "main" a "bodega_1".\n\n¿Continuar?')) return;

        setMigratingVentas(true);
        try {
            const result = await migrarVentasABodega1();
            toast.success(`✅ ${result.ventasActualizadas} venta(s) actualizadas correctamente`);

            // Mostrar mensaje para recargar
            setTimeout(() => {
                if (window.confirm('Migración completada. ¿Recargar la página para ver los cambios?')) {
                    window.location.reload();
                }
            }, 1500);

        } catch (error) {
            console.error(error);
            toast.error('Error al migrar ventas: ' + error.message);
        } finally {
            setMigratingVentas(false);
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

                {/* Alerta de Migración - Temporal */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                            <RefreshCw size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-amber-900 mb-2">🔧 Consolidación de Bodegas</h3>
                            <p className="text-amber-800 text-sm mb-4">
                                Si aparecen dos bodegas en los reportes cuando solo deberías tener una, ejecuta esta migración <strong>una sola vez</strong> para consolidar todas las referencias a la bodega principal.
                            </p>
                            <button
                                onClick={handleMigrarBodegas}
                                disabled={migrating}
                                className="px-5 py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                {migrating ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Migrando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        Ejecutar Migración
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Botón de Diagnóstico - Temporal */}
                <DiagnosticoButton />

                {/* Banner de Migración de Ventas */}
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                            <RefreshCw size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-emerald-900 mb-2">🛒 Migrar Ventas a Bodega Principal</h3>
                            <p className="text-emerald-800 text-sm mb-4">
                                Si eliminaste la bodega "main" y tus ventas no aparecen en los reportes, ejecuta esta migración <strong>una sola vez</strong> para actualizar todas las ventas a tu bodega actual.
                            </p>
                            <button
                                onClick={handleMigrarVentas}
                                disabled={migratingVentas}
                                className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                {migratingVentas ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Migrando Ventas...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        Migrar Ventas a bodega_1
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
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
                                            {bodega.id !== 'main' && bodega.id !== 'bodega_1' && (
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
                                    {bodegas.length === 0 && <option value="">No hay bodegas disponibles</option>}
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
                                                <select
                                                    className={`px-2 py-1 rounded-full text-xs font-bold border-none focus:ring-2 focus:ring-primary-500 cursor-pointer ${u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}
                                                    value={u.role}
                                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                                >
                                                    <option value="EMPLOYEE">Empleado</option>
                                                    <option value="OWNER">Dueño</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 text-sm">
                                                <select
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary-500 focus:outline-none text-sm py-1 transition-colors"
                                                    value={u.assigned_bodega_id || ''}
                                                    onChange={(e) => handleUpdateUserBodega(u.id, e.target.value)}
                                                >
                                                    <option value="" disabled>Seleccionar...</option>
                                                    {bodegas.map(b => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {assignedBodega && <div className="text-[10px] text-slate-400 mt-0.5">{assignedBodega.location}</div>}
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

                {/* Bodegas Management Section */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mt-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Store size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Gestión de Bodegas</h2>
                            <p className="text-slate-500 text-sm">Administra tus sucursales y ubicaciones</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Nombre</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Ubicación</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">ID Sistema</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bodegas.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{b.name}</td>
                                        <td className="px-6 py-4 text-slate-600">{b.location}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-400">{b.id}</td>
                                        <td className="px-6 py-4 text-right">
                                            {b.id !== 'main' && b.id !== 'bodega_1' && (
                                                <button
                                                    onClick={() => handleDeleteBodega(b.id, b.name)}
                                                    className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Eliminar bodega"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {bodegas.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                                            No se encontraron bodegas.
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
