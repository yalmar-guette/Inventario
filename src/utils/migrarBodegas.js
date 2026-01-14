/**
 * SCRIPT DE MIGRACIÓN - EJECUTAR UNA SOLA VEZ
 * 
 * Este script consolidará todas las referencias de bodega a 'main'
 * y limpiará duplicados en la base de datos de Firebase.
 * 
 * INSTRUCCIONES:
 * 1. Importa este archivo en Settings.jsx temporalmente
 * 2. Agrega un botón que llame a migrarBodegas()
 * 3. Ejecuta una vez
 * 4. Elimina el botón y este archivo
 */

import { collection, getDocs, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function migrarBodegas() {
    console.log('🚀 Iniciando migración de bodegas...\n');

    try {
        // PASO 1: Asegurar que existe una bodega 'main'
        console.log('📦 Paso 1: Verificando bodega principal...');
        const bodegasSnap = await getDocs(collection(db, 'bodegas'));
        const bodegas = bodegasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const tieneMain = bodegas.some(b => b.id === 'main');

        if (!tieneMain) {
            console.log('   ➕ Creando bodega "main"...');
            await setDoc(doc(db, 'bodegas', 'main'), {
                name: 'Bodega Principal',
                location: 'Principal',
                createdAt: new Date(),
                active: true
            });
            console.log('   ✅ Bodega "main" creada');
        } else {
            console.log('   ✅ Bodega "main" ya existe');
        }

        // PASO 2: Actualizar todos los usuarios para usar 'main'
        console.log('\n👥 Paso 2: Actualizando usuarios...');
        const usersSnap = await getDocs(collection(db, 'users'));
        let usersActualizados = 0;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const bodegaActual = userData.assigned_bodega_id;

            // Si no tiene bodega asignada o tiene una diferente de 'main'
            if (!bodegaActual || (bodegaActual !== 'main' && bodegaActual !== null)) {
                await updateDoc(doc(db, 'users', userDoc.id), {
                    assigned_bodega_id: 'main'
                });
                console.log(`   ✏️  Usuario ${userData.name || userData.email}: "${bodegaActual}" → "main"`);
                usersActualizados++;
            }
        }

        console.log(`   ✅ ${usersActualizados} usuario(s) actualizado(s)`);

        // PASO 3: Actualizar todas las ventas para usar 'main'
        console.log('\n🛒 Paso 3: Actualizando ventas...');
        const salesSnap = await getDocs(collection(db, 'sales'));
        let ventasActualizadas = 0;

        for (const saleDoc of salesSnap.docs) {
            const saleData = saleDoc.data();
            const bodegaActual = saleData.bodega_id;

            // Si la venta no tiene bodega_id o tiene una diferente de 'main'
            if (!bodegaActual || (bodegaActual !== 'main')) {
                await updateDoc(doc(db, 'sales', saleDoc.id), {
                    bodega_id: 'main'
                });
                ventasActualizadas++;

                if (ventasActualizadas <= 5) {
                    console.log(`   ✏️  Venta ${saleDoc.id}: "${bodegaActual}" → "main"`);
                }
            }
        }

        console.log(`   ✅ ${ventasActualizadas} venta(s) actualizada(s)`);

        // PASO 4: OPCIONAL - Eliminar bodegas duplicadas
        console.log('\n🗑️  Paso 4: Listando bodegas a eliminar (MANUAL)...');
        const bodegasActualizadas = await getDocs(collection(db, 'bodegas'));
        const bodegasParaEliminar = bodegasActualizadas.docs.filter(d =>
            d.id !== 'main' && d.id !== 'bodega_1'
        );

        if (bodegasParaEliminar.length > 0) {
            console.log('   ⚠️  Las siguientes bodegas se pueden eliminar:');
            bodegasParaEliminar.forEach(b => {
                console.log(`      - ${b.id} (${b.data().name})`);
            });
            console.log('   💡 Puedes eliminarlas desde la interfaz de Configuración');
        } else {
            console.log('   ✅ No hay bodegas duplicadas para eliminar');
        }

        console.log('\n✨ ¡Migración completada exitosamente!');
        console.log('📊 Resumen:');
        console.log(`   - Usuarios actualizados: ${usersActualizados}`);
        console.log(`   - Ventas actualizadas: ${ventasActualizadas}`);
        console.log('\n🔄 Por favor recarga la página para ver los cambios.');

        return {
            success: true,
            usersActualizados,
            ventasActualizadas,
            bodegasEncontradas: bodegasActualizadas.size
        };

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        throw error;
    }
}

// Función auxiliar para solo actualizar usuarios
export async function actualizarSoloUsuarios() {
    console.log('👥 Actualizando solo usuarios a bodega "main"...');

    const usersSnap = await getDocs(collection(db, 'users'));
    let count = 0;

    for (const userDoc of usersSnap.docs) {
        await updateDoc(doc(db, 'users', userDoc.id), {
            assigned_bodega_id: 'main'
        });
        count++;
    }

    console.log(`✅ ${count} usuarios actualizados a "main"`);
    return count;
}
