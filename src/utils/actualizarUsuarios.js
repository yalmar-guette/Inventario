import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Actualizar todos los usuarios de 'main' a 'bodega_1'
 */
export async function actualizarUsuariosABodega1() {
    console.log('👥 Actualizando usuarios...\n');

    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let usuariosActualizados = 0;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const bodegaActual = userData.assigned_bodega_id;

            // Si el usuario tiene bodega "main" o vacía, cambiarla a "bodega_1"
            if (bodegaActual === 'main' || !bodegaActual) {
                await updateDoc(doc(db, 'users', userDoc.id), {
                    assigned_bodega_id: 'bodega_1'
                });
                console.log(`✅ Usuario ${userData.email}: "${bodegaActual}" → "bodega_1"`);
                usuariosActualizados++;
            }
        }

        console.log(`\n✅ ${usuariosActualizados} usuario(s) actualizados`);

        return {
            success: true,
            usuariosActualizados
        };

    } catch (error) {
        console.error('❌ Error al actualizar usuarios:', error);
        throw error;
    }
}
