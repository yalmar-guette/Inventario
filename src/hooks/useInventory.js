import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export function useInventory(bodegaId) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Suscribirse a la colección global de productos
        const unsubscribe = onSnapshot(collection(db, "products"),
            (snapshot) => {
                const productsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProducts(productsData);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching inventory:", err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [bodegaId]);

    const addProduct = async (productData) => {
        try {
            const { initialStock, ...restData } = productData;

            // Inicializar mapa de stock con la bodega actual
            const stockMap = {};
            if (bodegaId && initialStock) {
                stockMap[bodegaId] = parseInt(initialStock) || 0;
            }

            await addDoc(collection(db, "products"), {
                ...restData,
                createdAt: serverTimestamp(),
                stock: stockMap
            });
        } catch (err) {
            console.error("Error adding product:", err);
            throw err;
        }
    };

    const updateProduct = async (id, data) => {
        try {
            const { initialStock, ...restData } = data;
            const docRef = doc(db, "products", id);

            // Si se actualiza el stock, actualizar el mapa de stock
            const updateData = { ...restData };
            if (initialStock !== undefined && bodegaId) {
                updateData[`stock.${bodegaId}`] = parseInt(initialStock) || 0;
            }

            await updateDoc(docRef, updateData);
        } catch (err) {
            console.error("Error updating product:", err);
            throw err;
        }
    };

    const deleteProduct = async (id) => {
        try {
            await deleteDoc(doc(db, "products", id));
        } catch (err) {
            console.error("Error deleting product:", err);
            throw err;
        }
    };

    return { products, loading, error, addProduct, updateProduct, deleteProduct };
}
