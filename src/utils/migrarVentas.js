import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Migrar todas las ventas de 'main' a 'bodega_1'
 */
export async function migrarVentasABodega1() {
    console.log('🔄 Iniciando migración de ventas...\n');

    try {
        const salesSnap = await getDocs(collection(db, 'sales'));
        let ventasActualizadas = 0;

        for (const saleDoc of salesSnap.docs) {
            const saleData = saleDoc.data();
            const bodegaActual = saleData.bodega_id;

            // Si la venta tiene bodega_id "main" o está vacía, cambiarla a "bodega_1"
            if (bodegaActual === 'main' || !bodegaActual) {
                await updateDoc(doc(db, 'sales', saleDoc.id), {
                    bodega_id: 'bodega_1'
                });
                console.log(`✅ Venta ${saleDoc.id}: "${bodegaActual}" → "bodega_1"`);
                ventasActualizadas++;
            }
        }

        console.log(`\n✅ ${ventasActualizadas} venta(s) actualizadas`);

        return {
            success: true,
            ventasActualizadas
        };

    } catch (error) {
        console.error('❌ Error al migrar ventas:', error);
        throw error;
    }
}
