-- Migración: Agregar campos precio_por_mayor e item a la tabla juguetes
-- Fecha: 2024

-- Agregar columna item si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'juguetes' AND column_name = 'item'
    ) THEN
        ALTER TABLE juguetes ADD COLUMN item VARCHAR(50);
        RAISE NOTICE 'Columna item agregada a la tabla juguetes.';
    END IF;
END $$;

-- Agregar columna precio_por_mayor si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'juguetes' AND column_name = 'precio_por_mayor'
    ) THEN
        ALTER TABLE juguetes ADD COLUMN precio_por_mayor DECIMAL(10, 2);
        RAISE NOTICE 'Columna precio_por_mayor agregada a la tabla juguetes.';
    END IF;
END $$;

-- Crear índice para item si no existe
CREATE INDEX IF NOT EXISTS idx_juguetes_item ON juguetes(item) WHERE item IS NOT NULL;

-- Crear índice para precio_por_mayor si no existe
CREATE INDEX IF NOT EXISTS idx_juguetes_precio_por_mayor ON juguetes(precio_por_mayor) WHERE precio_por_mayor IS NOT NULL;






