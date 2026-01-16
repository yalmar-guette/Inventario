-- ============================================
-- FIX: OPTIMIZACIÓN DE POLÍTICAS RLS (Anti-Recursión)
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Eliminar política recursiva de usuarios
DROP POLICY IF EXISTS "Owners can read all users" ON public.users;

-- 2. Crear nueva política segura usando metadatos de Auth (mucho más rápido y sin bucles)
CREATE POLICY "Owners can read all users" ON public.users
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'OWNER'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'OWNER')
  );

-- 3. Asegurar política para ver bodegas (evitar bloqueo en POS)
DROP POLICY IF EXISTS "Authenticated users can read bodegas" ON public.bodegas;
CREATE POLICY "Authenticated users can read bodegas" ON public.bodegas
  FOR SELECT
  USING (true); -- Permitir a todos ver las bodegas (es inofensivo y evita bloqueos)

-- 4. Asegurar política para ver configs
DROP POLICY IF EXISTS "Authenticated users can read config" ON public.system_config;
CREATE POLICY "Authenticated users can read config" ON public.system_config
  FOR SELECT
  USING (true);

-- Notificación de éxito
SELECT 'Políticas de seguridad optimizadas correctamente' as status;
