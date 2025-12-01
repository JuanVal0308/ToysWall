-- ============================================
-- MIGRACIÓN: Agregar campo de precio mínimo a juguetes
-- ============================================
-- Agrega precio_min a la tabla juguetes
-- para establecer un precio mínimo válido para cada juguete

-- Agregar columna de precio mínimo
ALTER TABLE juguetes 
ADD COLUMN IF NOT EXISTS precio_min DECIMAL(10, 2);

-- Agregar comentario a la columna
COMMENT ON COLUMN juguetes.precio_min IS 'Precio mínimo permitido para la venta de este juguete';

-- Crear índice para búsquedas por precio mínimo (opcional, útil para reportes)
CREATE INDEX IF NOT EXISTS idx_juguetes_precio_min ON juguetes(precio_min) WHERE precio_min IS NOT NULL;

