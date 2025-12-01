-- ============================================
-- Migración: Agregar campos de bultos a juguetes
-- ============================================
-- Agrega numero_bultos y cantidad_por_bulto a la tabla juguetes
-- Estos campos son opcionales y permiten especificar la cantidad exacta de bultos
-- y unidades por bulto para cada juguete

-- Agregar campos de bultos
ALTER TABLE juguetes 
ADD COLUMN IF NOT EXISTS numero_bultos INTEGER,
ADD COLUMN IF NOT EXISTS cantidad_por_bulto INTEGER;

-- Comentarios para documentación
COMMENT ON COLUMN juguetes.numero_bultos IS 'Número de bultos disponibles para este juguete (opcional)';
COMMENT ON COLUMN juguetes.cantidad_por_bulto IS 'Cantidad de unidades por bulto para este juguete (opcional, por defecto 12)';

-- Crear índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_juguetes_numero_bultos ON juguetes(numero_bultos) WHERE numero_bultos IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_juguetes_cantidad_por_bulto ON juguetes(cantidad_por_bulto) WHERE cantidad_por_bulto IS NOT NULL;


