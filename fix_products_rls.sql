-- =================================================================
-- FIX: PERMISOS PARA GUARDAR PRODUCTOS
-- Ejecutar en Supabase SQL Editor
-- =================================================================

-- 1. Asegurar que todos puedan LEER productos
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Anyone can read products" ON public.products
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Permitir a usuarios autenticados CREAR/EDITAR/BORRAR productos
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
CREATE POLICY "Authenticated users can manage products" ON public.products
  FOR ALL
  USING (auth.role() = 'authenticated');

SELECT '✅ Permisos de Productos configurados correctamente' as result;
