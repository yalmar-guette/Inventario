import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Eye } from 'lucide-react';

/**
 * COMPONENTE TEMPORAL DE DIAGNÓSTICO
 * 
 * Agrega este componente a Settings.jsx justo después del banner de migración
 * para tener un botón que muestre el diagnóstico.
 */

export function DiagnosticoButton() {
    const [diagnosticando, setDiagnosticando] = useState(false);
    const [resultado, setResultado] = useState(null);

    const ejecutarDiagnostico = async () => {
        setDiagnosticando(true);

        try {
            const diagnostico = {
                bodegas: [],
                usuarios: [],
                ventas: [],
                resumen: {}
            };

            // 1. Bodegas
            const bodegasSnap = await getDocs(collection(db, 'bodegas'));
            diagnostico.bodegas = bodegasSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // 2. Usuarios
            const usersSnap = await getDocs(collection(db, 'users'));
            diagnostico.usuarios = usersSnap.docs.map(doc => ({
                id: doc.id,
                email: doc.data().email,
                name: doc.data().name,
                role: doc.data().role,
                assigned_bodega_id: doc.data().assigned_bodega_id
            }));

            // 3. Ventas (últimas 20)
            const salesSnap = await getDocs(collection(db, 'sales'));
            const allSales = salesSnap.docs.map(doc => ({
                id: doc.id,
                bodega_id: doc.data().bodega_id,
                totalUSD: doc.data().totalUSD,
                timestamp: doc.data().timestamp
            }));

            // Ordenar y tomar las más recientes
            allSales.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
            diagnostico.ventas = allSales.slice(0, 20);

            // 4. Resumen
            const bodegasEnDB = diagnostico.bodegas.map(b => b.id);
            const bodegasEnUsuarios = [...new Set(diagnostico.usuarios.map(u => u.assigned_bodega_id).filter(Boolean))];
            const bodegasEnVentas = [...new Set(diagnostico.ventas.map(v => v.bodega_id).filter(Boolean))];

            diagnostico.resumen = {
                totalBodegas: diagnostico.bodegas.length,
                totalUsuarios: diagnostico.usuarios.length,
                totalVentas: salesSnap.size,
                bodegasEnDB,
                bodegasEnUsuarios,
                bodegasEnVentas,
                bodegasHuerfanasEnUsuarios: bodegasEnUsuarios.filter(b => !bodegasEnDB.includes(b)),
                bodegasHuerfanasEnVentas: bodegasEnVentas.filter(b => !bodegasEnDB.includes(b))
            };

            // Mostrar en consola también
            console.log('=== DIAGNÓSTICO COMPLETO ===');
            console.log('Bodegas:', diagnostico.bodegas);
            console.log('Usuarios:', diagnostico.usuarios);
            console.log('Ventas (últimas 20):', diagnostico.ventas);
            console.log('Resumen:', diagnostico.resumen);
            console.log('=============================');

            setResultado(diagnostico);

        } catch (error) {
            console.error('Error en diagnóstico:', error);
            alert('Error al ejecutar diagnóstico: ' + error.message);
        } finally {
            setDiagnosticando(false);
        }
    };

    return (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    <Eye size={20} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-900 mb-2">👁️ Diagnóstico de Base de Datos</h3>
                    <p className="text-blue-800 text-sm mb-4">
                        Ejecuta este diagnóstico para ver el estado de bodegas, usuarios y ventas.
                        Los resultados aparecerán en la consola del navegador (F12).
                    </p>
                    <button
                        onClick={ejecutarDiagnostico}
                        disabled={diagnosticando}
                        className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {diagnosticando ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Diagnosticando...
                            </>
                        ) : (
                            <>
                                <Eye size={20} />
                                Ver Estado de Base de Datos
                            </>
                        )}
                    </button>

                    {resultado && (
                        <div className="mt-4 p-4 bg-white rounded-xl border border-blue-200">
                            <h4 className="font-bold text-blue-900 mb-2">✅ Diagnóstico Completado</h4>
                            <div className="text-sm space-y-1 text-slate-700">
                                <p>📦 Bodegas en Firebase: <strong>{resultado.resumen.totalBodegas}</strong> → {resultado.resumen.bodegasEnDB.map(id => `"${id}"`).join(', ')}</p>
                                <p>👥 Total Usuarios: <strong>{resultado.resumen.totalUsuarios}</strong></p>
                                <p>🛒 Total Ventas: <strong>{resultado.resumen.totalVentas}</strong></p>

                                {resultado.resumen.bodegasHuerfanasEnUsuarios.length > 0 && (
                                    <p className="text-red-600 font-bold mt-2">
                                        ⚠️ Usuarios asignados a bodegas inexistentes: {resultado.resumen.bodegasHuerfanasEnUsuarios.map(id => `"${id}"`).join(', ')}
                                    </p>
                                )}

                                {resultado.resumen.bodegasHuerfanasEnVentas.length > 0 && (
                                    <p className="text-red-600 font-bold">
                                        ⚠️ Ventas en bodegas inexistentes: {resultado.resumen.bodegasHuerfanasEnVentas.map(id => `"${id}"`).join(', ')}
                                    </p>
                                )}

                                <p className="mt-3 text-xs text-slate-500">
                                    💡 Abre la consola (F12) para ver los datos completos
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
