-- ============================================
-- CORRECCIÓN DE POLÍTICAS RLS
-- Solución para Recursión Infinita
-- ============================================
-- Fecha: 2026-01-16
-- Problema: Las políticas RLS causan recursión infinita al verificar permisos
-- Solución: Usar función SECURITY DEFINER para evitar RLS en verificación
-- ============================================

-- ============================================
-- PASO 1: Crear Función is_admin() con SECURITY DEFINER
-- ============================================

-- Esta función se ejecuta con permisos del creador (superuser)
-- por lo que NO activa RLS, evitando la recursión
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::uuid
    AND role = 'OWNER'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PASO 2: Eliminar Políticas Antiguas (con recursión)
-- ============================================

-- Políticas de USERS
DROP POLICY IF EXISTS "Owners can insert users" ON public.users;
DROP POLICY IF EXISTS "Owners can update users" ON public.users;
DROP POLICY IF EXISTS "Owners can delete users" ON public.users;

-- Políticas de PRODUCTS
DROP POLICY IF EXISTS "Only owners can insert products" ON public.products;
DROP POLICY IF EXISTS "Only owners can update products" ON public.products;
DROP POLICY IF EXISTS "Only owners can delete products" ON public.products;

-- Políticas de BODEGAS
DROP POLICY IF EXISTS "Only owners can insert bodegas" ON public.bodegas;
DROP POLICY IF EXISTS "Only owners can update bodegas" ON public.bodegas;
DROP POLICY IF EXISTS "Only owners can delete bodegas" ON public.bodegas;

-- Políticas de SALES
DROP POLICY IF EXISTS "Only owners can update sales" ON public.sales;
DROP POLICY IF EXISTS "Only owners can delete sales" ON public.sales;

-- Políticas de DEBTORS
DROP POLICY IF EXISTS "Only owners can delete debtors" ON public.debtors;

-- Políticas de SYSTEM_CONFIG
DROP POLICY IF EXISTS "Only owners can update config" ON public.system_config;

-- ============================================
-- PASO 3: Crear Nuevas Políticas usando is_admin()
-- ============================================

-- ============================================
-- POLÍTICAS: users
-- ============================================

CREATE POLICY "Owners can insert users" ON public.users
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Owners can update users" ON public.users
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Owners can delete users" ON public.users
  FOR DELETE
  USING (is_admin());

-- ============================================
-- POLÍTICAS: products
-- ============================================

CREATE POLICY "Only owners can insert products" ON public.products
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Only owners can update products" ON public.products
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Only owners can delete products" ON public.products
  FOR DELETE
  USING (is_admin());

-- ============================================
-- POLÍTICAS: bodegas
-- ============================================

CREATE POLICY "Only owners can insert bodegas" ON public.bodegas
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Only owners can update bodegas" ON public.bodegas
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Only owners can delete bodegas" ON public.bodegas
  FOR DELETE
  USING (is_admin());

-- ============================================
-- POLÍTICAS: sales
-- ============================================

CREATE POLICY "Only owners can update sales" ON public.sales
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Only owners can delete sales" ON public.sales
  FOR DELETE
  USING (is_admin());

-- ============================================
-- POLÍTICAS: debtors
-- ============================================

CREATE POLICY "Only owners can delete debtors" ON public.debtors
  FOR DELETE
  USING (is_admin());

-- ============================================
-- POLÍTICAS: system_config
-- ============================================

CREATE POLICY "Only owners can update config" ON public.system_config
  FOR UPDATE
  USING (is_admin());

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Después de ejecutar este script, verifica:
-- 1. Intentar eliminar un producto como OWNER → Debe funcionar
-- 2. Intentar cambiar de bodega → Debe funcionar
-- 3. Como EMPLOYEE, no debes ver botones de eliminar
-- ============================================

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- ✅ Esta solución elimina la recursión infinita
-- ✅ Mantiene la seguridad (solo OWNER puede modificar datos)
-- ✅ Mejora el rendimiento (menos consultas recursivas)
-- ============================================
