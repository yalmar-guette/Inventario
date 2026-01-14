/**
 * SCRIPT DE DIAGNÓSTICO TEMPORAL
 * Corre este código en la consola del navegador cuando estés logueado en la app
 * para ver qué bodegas y usuarios tienes en Firebase
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export async function diagnosticarBodegas() {
    console.log('=== DIAGNÓSTICO DE BODEGAS ===\n');

    try {
        // 1. Ver todas las bodegas
        const bodegasSnap = await getDocs(collection(db, 'bodegas'));
        console.log(`📦 Total de Bodegas Encontradas: ${bodegasSnap.size}\n`);

        bodegasSnap.forEach((doc) => {
            console.log(`🏪 Bodega ID: "${doc.id}"`);
            console.log(`   Datos:`, doc.data());
            console.log('---');
        });

        // 2. Ver todos los usuarios y sus bodegas asignadas
        const usersSnap = await getDocs(collection(db, 'users'));
        console.log(`\n👥 Total de Usuarios: ${usersSnap.size}\n`);

        const bodegaCounts = {};
        usersSnap.forEach((doc) => {
            const user = doc.data();
            const bodegaId = user.assigned_bodega_id || 'SIN ASIGNAR';
            bodegaCounts[bodegaId] = (bodegaCounts[bodegaId] || 0) + 1;
            console.log(`👤 ${user.name || user.email}`);
            console.log(`   Bodega Asignada: "${bodegaId}"`);
            console.log(`   Rol: ${user.role}`);
            console.log('---');
        });

        // 3. Resumen de asignaciones
        console.log('\n📊 RESUMEN DE ASIGNACIONES DE BODEGA:');
        Object.entries(bodegaCounts).forEach(([bodegaId, count]) => {
            console.log(`   "${bodegaId}": ${count} usuario(s)`);
        });

        // 4. Ver algunas ventas recientes
        const salesSnap = await getDocs(collection(db, 'sales'));
        console.log(`\n🛒 Total de Ventas: ${salesSnap.size}`);

        const salesBodegaCounts = {};
        salesSnap.forEach((doc) => {
            const sale = doc.data();
            const bodegaId = sale.bodega_id || 'SIN BODEGA';
            salesBodegaCounts[bodegaId] = (salesBodegaCounts[bodegaId] || 0) + 1;
        });

        console.log('\n📊 VENTAS POR BODEGA:');
        Object.entries(salesBodegaCounts).forEach(([bodegaId, count]) => {
            console.log(`   "${bodegaId}": ${count} venta(s)`);
        });

        console.log('\n=== FIN DEL DIAGNÓSTICO ===');

        return {
            bodegas: bodegasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            usuarios: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            resumenBodegas: bodegaCounts,
            resumenVentas: salesBodegaCounts
        };

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
        throw error;
    }
}

// Para usar desde la consola del navegador:
// import { diagnosticarBodegas } from './utils/diagnosticoBodegas';
// diagnosticarBodegas();
