-- Migración: Agregar campo es_por_mayor a la tabla ventas
-- Fecha: 2024

-- Agregar columna es_por_mayor si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'es_por_mayor'
    ) THEN
        ALTER TABLE ventas ADD COLUMN es_por_mayor BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Columna es_por_mayor agregada a la tabla ventas.';
    END IF;
END $$;







