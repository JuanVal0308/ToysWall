-- ============================================
-- MIGRACIÓN: Eliminar columna precio_max de juguetes
-- ============================================
-- Elimina la columna precio_max ya que solo usaremos precio_min
-- El precio mínimo es obligatorio, pero no hay límite máximo

-- Eliminar columna precio_max si existe
ALTER TABLE juguetes 
DROP COLUMN IF EXISTS precio_max;

-- Eliminar índice de rango de precios si existe
DROP INDEX IF EXISTS idx_juguetes_precio_rango;

-- Asegurar que el índice de precio_min existe
CREATE INDEX IF NOT EXISTS idx_juguetes_precio_min ON juguetes(precio_min) WHERE precio_min IS NOT NULL;











