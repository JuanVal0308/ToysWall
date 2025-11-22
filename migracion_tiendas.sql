-- ============================================
-- MIGRACIÓN: Actualizar columna ubicacion a direccion en tiendas
-- ============================================
-- Ejecuta este script si ya tienes la tabla tiendas con la columna 'ubicacion'
-- y necesitas cambiarla a 'direccion' para que coincida con el código

-- Verificar si existe la columna ubicacion
DO $$
BEGIN
    -- Si existe ubicacion pero no direccion, renombrar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tiendas' AND column_name = 'ubicacion'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tiendas' AND column_name = 'direccion'
    ) THEN
        ALTER TABLE tiendas RENAME COLUMN ubicacion TO direccion;
        RAISE NOTICE 'Columna ubicacion renombrada a direccion';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tiendas' AND column_name = 'direccion'
    ) THEN
        RAISE NOTICE 'La columna direccion ya existe';
    ELSE
        RAISE NOTICE 'La tabla tiendas no existe o no tiene la columna ubicacion';
    END IF;
END $$;

