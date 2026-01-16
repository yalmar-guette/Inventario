-- Script para crear usuarios manualmente en Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- IMPORTANTE: Este script crea usuarios directamente en Supabase Auth
-- Los usuarios podrán hacer login con sus contraseñas actuales

-- ============================================
-- PASO 1: Crear usuarios en Supabase Auth
-- ============================================

-- NOTA: Estos INSERT deben ejecutarse desde el Dashboard de Supabase
-- porque requieren acceso directo a la tabla auth.users

-- Usuario 1: Sarai (Empleado)
-- Email: sarai@bodega.com (o el email que uses)
-- Password: 36045210

-- Usuario 2: Dueño/Empleado
-- Email: dueno@bodega.com (o el email que uses)
-- Password: 1234567890

-- ============================================
-- PASO 2: Insertar en la tabla public.users
-- ============================================

-- Primero necesitas crear los usuarios en Auth desde el Dashboard:
-- 1. Ve a Supabase Dashboard → Authentication → Users
-- 2. Click en "Add user" → "Create new user"
-- 3. Ingresa el email y contraseña para cada usuario
-- 4. Copia el UUID que se genera

-- Luego ejecuta este SQL (reemplaza los UUIDs con los generados):

-- Ejemplo (REEMPLAZAR UUIDs):
/*
INSERT INTO public.users (id, email, name, role, assigned_bodega_id)
VALUES 
  ('uuid-de-sarai-aqui', 'sarai@bodega.com', 'Sarai', 'EMPLOYEE', 'bodega_1'),
  ('uuid-del-dueno-aqui', 'dueno@bodega.com', 'Dueño', 'OWNER', 'bodega_1');
*/

-- ============================================
-- INSTRUCCIONES COMPLETAS
-- ============================================

-- OPCIÓN A: Crear desde el Dashboard (MÁS FÁCIL)
-- 1. Ve a: https://supabase.com/dashboard
-- 2. Selecciona tu proyecto
-- 3. Authentication → Users → "Add user"
-- 4. Para Sarai:
--    - Email: sarai@bodega.com (o el que uses)
--    - Password: 36045210
--    - Auto Confirm User: ✅ (activar)
-- 5. Para Dueño:
--    - Email: dueno@bodega.com (o el que uses)
--    - Password: 1234567890
--    - Auto Confirm User: ✅ (activar)
-- 6. Copia los UUIDs generados
-- 7. Ejecuta el INSERT de arriba con los UUIDs correctos

-- OPCIÓN B: Usar la función de Supabase (DESDE SQL EDITOR)
-- Ejecuta esto directamente en el SQL Editor:

-- Para Sarai:
SELECT auth.users_create_user(
  'sarai@bodega.com'::text,
  '36045210'::text,
  'Sarai'::text,
  'EMPLOYEE'::text,
  'bodega_1'::text
);

-- Para Dueño:
SELECT auth.users_create_user(
  'dueno@bodega.com'::text,
  '1234567890'::text,
  'Dueño'::text,
  'OWNER'::text,
  'bodega_1'::text
);

-- NOTA: Si la función no existe, usa la Opción A (Dashboard)
