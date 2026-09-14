-- ============================================
-- SCRIPT PARA AGREGAR LA COLUMNA DE DEVOLUCIONES
-- ============================================

-- 1. Agregar la columna 'returned' a la tabla de ventas (sales)
-- Esta columna será booleana (true/false) y por defecto estará en false
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS returned BOOLEAN DEFAULT false;

-- Opcional: Actualizar las ventas históricas para asegurarse de que todas tengan el valor 'false'
UPDATE public.sales SET returned = false WHERE returned IS NULL;
