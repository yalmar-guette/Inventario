-- ============================================
-- MÓDULO DE CLIENTES Y CUENTAS POR COBRAR
-- ============================================

-- 1. Crear tabla clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code SERIAL,
  name TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  bodega_id TEXT REFERENCES public.bodegas(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear tabla client_payments
CREATE TABLE IF NOT EXISTS public.client_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_bs NUMERIC(12,2) NOT NULL,
  exchange_rate NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Actualizar tabla sales para vincular el cliente
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

-- 4. Función para obtener estado de cuenta del cliente
-- Calcula la deuda total (ventas a crédito no pagadas) y los abonos totales
CREATE OR REPLACE FUNCTION get_client_statement(client_id_param UUID)
RETURNS TABLE (
  total_fiado NUMERIC,
  total_abonado NUMERIC,
  saldo_actual NUMERIC
) AS $$
DECLARE
  fiado NUMERIC;
  abonado NUMERIC;
BEGIN
  -- Sumar todas las ventas asociadas a este cliente donde haya habido crédito
  -- Esto asume que en el JSON 'payments' guardaste algún método FIADO, 
  -- o calculamos desde la deuda inicial registrada (adaptar según lógica del POS).
  -- Por ahora, sumaremos las deudas activas en la tabla debtors heredada si decidimos migrarla,
  -- o calculamos dinámicamente si refactorizamos las ventas.
  
  -- Para este diseño, asumimos que total_fiado es la suma de los montos a crédito de la tabla sales 
  -- (requeriría extraer del JSON, por lo que usaremos una aproximación o la tabla debtors heredada).
  -- Como la tabla debtors existe, migrar sus datos a clients es lo ideal.
  
  -- Lógica simple: sumar `client_payments`
  SELECT COALESCE(SUM(amount_usd), 0) INTO abonado
  FROM public.client_payments
  WHERE client_id = client_id_param;
  
  -- Calcular fiado desde las ventas a crédito asociadas al cliente
  -- (Asumiendo que las ventas a crédito tienen un client_id asignado)
  SELECT COALESCE(SUM(
    (SELECT COALESCE(SUM((p->>'amount')::NUMERIC), 0)
     FROM jsonb_array_elements(payments) p
     WHERE p->>'method' = 'FIADO')
  ), 0) INTO fiado
  FROM public.sales
  WHERE client_id = client_id_param;
  
  -- Si el cliente viene de la tabla deudores antigua, deberíamos sumar eso también
  -- Pero para fines de este módulo nuevo, devolveremos el cálculo básico:
  RETURN QUERY SELECT 
    fiado, 
    abonado, 
    GREATEST(fiado - abonado, 0::NUMERIC);
END;
$$ LANGUAGE plpgsql;

-- 5. RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read clients from their bodega" ON public.clients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role = 'OWNER' OR u.assigned_bodega_id = clients.bodega_id))
  );

CREATE POLICY "Users can insert clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update clients" ON public.clients
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can read payments from their bodega clients" ON public.client_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.users u ON u.id = auth.uid()
      WHERE c.id = client_payments.client_id
      AND (u.role = 'OWNER' OR u.assigned_bodega_id = c.bodega_id)
    )
  );

CREATE POLICY "Users can insert payments" ON public.client_payments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
