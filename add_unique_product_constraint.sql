-- ============================================
-- MIGRACIÓN: Agregar Constraint UNIQUE para Productos
-- ============================================
-- Fecha: 2026-01-16
-- Propósito: Prevenir productos duplicados con el mismo nombre
-- ============================================

-- NOTA: Este constraint solo es necesario si quieres evitar duplicados
-- a nivel de base de datos. La validación también se hace en frontend.

-- Agregar constraint UNIQUE para combinación nombre + bodega_id
-- Esto previene que se creen productos con el mismo nombre en la misma bodega

-- IMPORTANTE: Antes de ejecutar, verifica que no existan duplicados:
-- SELECT name, COUNT(*) 
-- FROM products 
-- GROUP BY name 
-- HAVING COUNT(*) > 1;

-- Si ya existen duplicados, deberás renombrarlos primero manualmente.

-- Una vez verificado que no hay duplicados, ejecuta:
-- (Descomenta la línea siguiente si deseas aplicar el constraint)

-- ALTER TABLE products ADD CONSTRAINT unique_product_name 
-- UNIQUE (name);

-- ============================================
-- ALTERNATIVA: Constraint por bodega
-- ============================================
-- Si el stock es por bodega y quieres permitir el mismo nombre
-- en bodegas diferentes, NO uses el constraint anterior.
-- En su lugar, la validación se manejará solo en frontend.

-- Para este proyecto usamos solo validación en frontend
-- porque los productos son globales (stock es JSONB por bodega)
-- ============================================
