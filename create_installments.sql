-- ============================================
-- TABLA DE CUOTAS / FECHAS TENTATIVAS DE PAGO
-- ============================================

CREATE TABLE IF NOT EXISTS public.payment_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debtor_id UUID NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_bs NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can read installments for their debtors" ON public.payment_installments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.debtors d
      JOIN public.users u ON u.id = auth.uid()
      WHERE d.id = payment_installments.debtor_id
      AND (u.role = 'OWNER' OR u.assigned_bodega_id = d.bodega_id)
    )
  );

CREATE POLICY "Users can insert installments" ON public.payment_installments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update installments" ON public.payment_installments
  FOR UPDATE USING (auth.uid() IS NOT NULL);
