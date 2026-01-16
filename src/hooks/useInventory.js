import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useInventory(bodegaId) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Fetch inicial de productos
        fetchProducts();

        // Suscribirse a cambios en tiempo real
        const subscription = supabase
            .channel('products-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                (payload) => {
                    console.log('Product change detected:', payload);
                    // Refetch cuando hay cambios
                    fetchProducts();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [bodegaId]);

    const fetchProducts = async () => {
        try {
            // Timeout de seguridad: Si tarda más de 10s, cancelar
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tiempo de espera agotado (Timeout)')), 10000)
            );

            const fetchPromise = supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            const { data, error: fetchError } = await Promise.race([fetchPromise, timeoutPromise]);

            if (fetchError) throw fetchError;

            setProducts(data || []);
            setError(null);
        } catch (err) {
            console.error("Error fetching inventory:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const addProduct = async (productData) => {
        try {
            const { initialStock, ...restData } = productData;

            // VALIDACIÓN: Verificar que no exista un producto con el mismo nombre
            const productName = restData.name?.trim();
            if (!productName) {
                throw new Error('El nombre del producto es requerido');
            }

            const { data: existingProducts, error: checkError } = await supabase
                .from('products')
                .select('id, name')
                .ilike('name', productName); // Case-insensitive match

            if (checkError) throw checkError;

            if (existingProducts && existingProducts.length > 0) {
                throw new Error(`Ya existe un producto con el nombre "${productName}". Por favor usa un nombre diferente.`);
            }

            // Inicializar mapa de stock con la bodega actual
            const stockMap = {};
            if (bodegaId && initialStock) {
                stockMap[bodegaId] = parseInt(initialStock) || 0;
            }

            const { data, error: insertError } = await supabase
                .from('products')
                .insert([{
                    ...restData,
                    name: productName, // Usar nombre limpio (trimmed)
                    stock: stockMap,
                    sales_count: 0
                }])
                .select();

            if (insertError) throw insertError;

            // Refrescar lista manualmente por si falla Realtime
            await fetchProducts();

            return data;
        } catch (err) {
            console.error("Error adding product:", err);
            throw err;
        }
    };

    const updateProduct = async (id, data) => {
        try {
            const { initialStock, ...restData } = data;

            // VALIDACIÓN: Verificar que no exista otro producto con el mismo nombre
            if (restData.name) {
                const productName = restData.name.trim();

                const { data: existingProducts, error: checkError } = await supabase
                    .from('products')
                    .select('id, name')
                    .ilike('name', productName)
                    .neq('id', id); // Excluir el producto actual

                if (checkError) throw checkError;

                if (existingProducts && existingProducts.length > 0) {
                    throw new Error(`Ya existe otro producto con el nombre "${productName}". Por favor usa un nombre diferente.`);
                }

                restData.name = productName; // Usar nombre limpio (trimmed)
            }

            // Preparar datos de actualización
            const updateData = { ...restData };

            // Si se actualiza el stock, necesitamos obtener el stock actual primero
            if (initialStock !== undefined && bodegaId) {
                const { data: currentProduct } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', id)
                    .single();

                const currentStock = currentProduct?.stock || {};
                updateData.stock = {
                    ...currentStock,
                    [bodegaId]: parseInt(initialStock) || 0
                };
            }

            const { error: updateError } = await supabase
                .from('products')
                .update(updateData)
                .eq('id', id);

            if (updateError) throw updateError;

            // Refrescar la lista inmediatamente después de actualizar
            await fetchProducts();
        } catch (err) {
            console.error("Error updating product:", err);
            throw err;
        }
    };

    const deleteProduct = async (id) => {
        try {
            const { error: deleteError } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            // Refrescar la lista inmediatamente después de eliminar
            await fetchProducts();
        } catch (err) {
            console.error("Error deleting product:", err);
            throw err;
        }
    };

    return { products, loading, error, addProduct, updateProduct, deleteProduct, fetchProducts };
}
