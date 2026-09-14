-- ============================================
-- TABLA: debt_payments
-- Registro de abonos a deudas de clientes
-- ============================================

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_bs NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_debt_payments_debtor ON public.debt_payments(debtor_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_created_at ON public.debt_payments(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ============================================

-- Los usuarios pueden leer pagos de los deudores a los que tienen acceso
-- (es decir, aquellos deudores que pertenecen a su bodega, o si el usuario es OWNER)
CREATE POLICY "Users can read payments from their bodega debtors" ON public.debt_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.debtors d
      JOIN public.users u ON u.id = auth.uid()
      WHERE d.id = debt_payments.debtor_id
      AND (u.role = 'OWNER' OR u.assigned_bodega_id = d.bodega_id)
    )
  );

-- Todos los usuarios autenticados pueden crear pagos (ya que pueden actualizar deudores)
CREATE POLICY "Authenticated users can insert payments" ON public.debt_payments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Solo OWNER puede actualizar pagos
CREATE POLICY "Only owners can update payments" ON public.debt_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede eliminar pagos
CREATE POLICY "Only owners can delete payments" ON public.debt_payments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );
