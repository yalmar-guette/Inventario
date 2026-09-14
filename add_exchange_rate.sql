-- ============================================
-- AGREGAR TASA DE CAMBIO A VENTAS HISTÓRICAS Y NUEVAS
-- ============================================

-- 1. Agregar columna exchange_rate a la tabla sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,2);

-- 2. Backfill (rellenar) los registros históricos
-- Dividimos el total en Bolívares entre el total en Dólares para obtener la tasa del momento
UPDATE public.sales 
SET exchange_rate = ROUND((total_bs / total_usd)::NUMERIC, 2)
WHERE exchange_rate IS NULL AND total_usd > 0;

-- Nota: Si usas la tabla 'debt_payments' (abonos a deudores) y quieres hacer lo mismo:
ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,2);
UPDATE public.debt_payments
SET exchange_rate = ROUND((amount_bs / amount_usd)::NUMERIC, 2)
WHERE exchange_rate IS NULL AND amount_usd > 0;
