-- ============================================
-- SCHEMA DE BASE DE DATOS PARA SUPABASE
-- Sistema de Inventario Xioale
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: users
-- Extiende la tabla auth.users de Supabase
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'EMPLOYEE')),
  assigned_bodega_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: bodegas
-- Sucursales/locales del negocio
-- ============================================
CREATE TABLE IF NOT EXISTS public.bodegas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: products
-- Inventario global de productos
-- ============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  barcode TEXT,
  price_usd NUMERIC(10,2) NOT NULL,
  stock JSONB DEFAULT '{}',  -- Formato: {"bodega_1": 10, "bodega_2": 5}
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: sales
-- Registro de ventas realizadas
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  items JSONB NOT NULL,  -- Array de productos vendidos
  total_usd NUMERIC(10,2) NOT NULL,
  total_bs NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  payments JSONB,  -- Múltiples métodos de pago
  cashier_id UUID REFERENCES public.users(id),
  bodega_id TEXT REFERENCES public.bodegas(id),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: debtors
-- Clientes con deudas pendientes
-- ============================================
CREATE TABLE IF NOT EXISTS public.debtors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  total_debt_usd NUMERIC(10,2) NOT NULL,
  total_debt_bs NUMERIC(10,2) NOT NULL,
  sale_id UUID REFERENCES public.sales(id),
  bodega_id TEXT REFERENCES public.bodegas(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLA: system_config
-- Configuración global del sistema
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  exchange_rate NUMERIC(10,2) NOT NULL DEFAULT 40.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sales_bodega ON public.sales(bodega_id);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON public.sales(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON public.sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_debtors_bodega ON public.debtors(bodega_id);
CREATE INDEX IF NOT EXISTS idx_debtors_sale ON public.debtors(sale_id);
CREATE INDEX IF NOT EXISTS idx_users_bodega ON public.users(assigned_bodega_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS DE SEGURIDAD: users
-- ============================================

-- Los usuarios pueden leer su propia información
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Los OWNER pueden leer todos los usuarios
CREATE POLICY "Owners can read all users" ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede crear usuarios (esto se maneja en el backend)
CREATE POLICY "Owners can insert users" ON public.users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede actualizar usuarios
CREATE POLICY "Owners can update users" ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede eliminar usuarios
CREATE POLICY "Owners can delete users" ON public.users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- ============================================
-- POLÍTICAS DE SEGURIDAD: products
-- ============================================

-- Todos los usuarios autenticados pueden leer productos
CREATE POLICY "Authenticated users can read products" ON public.products
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo OWNER puede crear productos
CREATE POLICY "Only owners can insert products" ON public.products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede actualizar productos
CREATE POLICY "Only owners can update products" ON public.products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede eliminar productos
CREATE POLICY "Only owners can delete products" ON public.products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- ============================================
-- POLÍTICAS DE SEGURIDAD: sales
-- ============================================

-- Los usuarios pueden ver ventas de su bodega asignada
CREATE POLICY "Users can read sales from their bodega" ON public.sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'OWNER' OR assigned_bodega_id = sales.bodega_id)
    )
  );

-- Todos los usuarios autenticados pueden crear ventas
CREATE POLICY "Authenticated users can insert sales" ON public.sales
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Solo OWNER puede actualizar ventas
CREATE POLICY "Only owners can update sales" ON public.sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede eliminar ventas
CREATE POLICY "Only owners can delete sales" ON public.sales
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- ============================================
-- POLÍTICAS DE SEGURIDAD: debtors
-- ============================================

-- Los usuarios pueden ver deudores de su bodega
CREATE POLICY "Users can read debtors from their bodega" ON public.debtors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'OWNER' OR assigned_bodega_id = debtors.bodega_id)
    )
  );

-- Todos los usuarios autenticados pueden crear deudores
CREATE POLICY "Authenticated users can insert debtors" ON public.debtors
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios pueden actualizar deudores (para pagos)
CREATE POLICY "Authenticated users can update debtors" ON public.debtors
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Solo OWNER puede eliminar deudores
CREATE POLICY "Only owners can delete debtors" ON public.debtors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- ============================================
-- POLÍTICAS DE SEGURIDAD: bodegas
-- ============================================

-- Todos los usuarios autenticados pueden leer bodegas
CREATE POLICY "Authenticated users can read bodegas" ON public.bodegas
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo OWNER puede crear bodegas
CREATE POLICY "Only owners can insert bodegas" ON public.bodegas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede actualizar bodegas
CREATE POLICY "Only owners can update bodegas" ON public.bodegas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- Solo OWNER puede eliminar bodegas
CREATE POLICY "Only owners can delete bodegas" ON public.bodegas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- ============================================
-- POLÍTICAS DE SEGURIDAD: system_config
-- ============================================

-- Todos los usuarios autenticados pueden leer la configuración
CREATE POLICY "Authenticated users can read config" ON public.system_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo OWNER puede actualizar la configuración
CREATE POLICY "Only owners can update config" ON public.system_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'OWNER'
    )
  );

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Insertar bodega principal por defecto
INSERT INTO public.bodegas (id, name, location, active)
VALUES ('bodega_1', 'Principal', 'Sede Principal', true)
ON CONFLICT (id) DO NOTHING;

-- Insertar configuración inicial
INSERT INTO public.system_config (id, exchange_rate)
VALUES ('global', 40.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FUNCIONES ÚTILES
-- ============================================

-- Función para actualizar el timestamp de system_config
CREATE OR REPLACE FUNCTION update_system_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp automáticamente
DROP TRIGGER IF EXISTS system_config_updated_at ON public.system_config;
CREATE TRIGGER system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_system_config_timestamp();

-- ============================================
-- FINALIZADO
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- Dashboard → SQL Editor → New Query → Pega este código → Run
