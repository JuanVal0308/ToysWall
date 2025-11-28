-- ============================================
-- MIGRACIÓN: Agregar campos de precio a juguetes
-- ============================================
-- Agrega precio_min y precio_max a la tabla juguetes
-- para establecer un rango de precios válido para cada juguete

-- Agregar columnas de precio
ALTER TABLE juguetes 
ADD COLUMN IF NOT EXISTS precio_min DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS precio_max DECIMAL(10, 2);

-- Agregar comentarios a las columnas
COMMENT ON COLUMN juguetes.precio_min IS 'Precio mínimo permitido para la venta de este juguete';
COMMENT ON COLUMN juguetes.precio_max IS 'Precio máximo permitido para la venta de este juguete';

-- Crear índice para búsquedas por rango de precio (opcional, útil para reportes)
CREATE INDEX IF NOT EXISTS idx_juguetes_precio_rango ON juguetes(precio_min, precio_max) WHERE precio_min IS NOT NULL AND precio_max IS NOT NULL;

