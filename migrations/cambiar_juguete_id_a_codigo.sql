-- ============================================
-- MIGRACIÓN: Cambiar juguete_id a juguete_codigo
-- Toys Walls - Sistema de Inventario
-- ============================================
-- Esta migración cambia las referencias de juguete_id a juguete_codigo
-- en las tablas movimientos y ventas
-- ============================================

-- ============================================
-- PASO 1: Agregar nuevas columnas
-- ============================================

-- Agregar juguete_codigo a movimientos
ALTER TABLE movimientos 
ADD COLUMN IF NOT EXISTS juguete_codigo VARCHAR(50);

-- Agregar juguete_codigo a ventas
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS juguete_codigo VARCHAR(50);

-- ============================================
-- PASO 2: Migrar datos existentes
-- ============================================

-- Actualizar movimientos con los códigos de juguetes
-- Solo actualizar los que tienen un juguete válido
UPDATE movimientos m
SET juguete_codigo = j.codigo
FROM juguetes j
WHERE m.juguete_id = j.id
AND m.juguete_codigo IS NULL
AND j.codigo IS NOT NULL;

-- Actualizar ventas con los códigos de juguetes
-- Solo actualizar los que tienen un juguete válido
UPDATE ventas v
SET juguete_codigo = j.codigo
FROM juguetes j
WHERE v.juguete_id = j.id
AND v.juguete_codigo IS NULL
AND j.codigo IS NOT NULL;

-- Verificar cuántos registros no se pudieron actualizar
DO $$
DECLARE
    movimientos_sin_juguete INTEGER;
    ventas_sin_juguete INTEGER;
BEGIN
    SELECT COUNT(*) INTO movimientos_sin_juguete
    FROM movimientos
    WHERE juguete_codigo IS NULL AND juguete_id IS NOT NULL;
    
    SELECT COUNT(*) INTO ventas_sin_juguete
    FROM ventas
    WHERE juguete_codigo IS NULL AND juguete_id IS NOT NULL;
    
    IF movimientos_sin_juguete > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: % movimientos tienen juguete_id que no existe en juguetes. Se eliminarán.', movimientos_sin_juguete;
        -- Eliminar movimientos huérfanos
        DELETE FROM movimientos
        WHERE juguete_codigo IS NULL AND juguete_id IS NOT NULL;
    END IF;
    
    IF ventas_sin_juguete > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: % ventas tienen juguete_id que no existe en juguetes. Se eliminarán.', ventas_sin_juguete;
        -- Eliminar ventas huérfanas
        DELETE FROM ventas
        WHERE juguete_codigo IS NULL AND juguete_id IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- PASO 3: Eliminar restricciones de foreign key
-- ============================================

-- Eliminar foreign key de movimientos
ALTER TABLE movimientos 
DROP CONSTRAINT IF EXISTS movimientos_juguete_id_fkey;

-- Eliminar foreign key de ventas
ALTER TABLE ventas 
DROP CONSTRAINT IF EXISTS ventas_juguete_id_fkey;

-- ============================================
-- PASO 4: Eliminar columnas antiguas
-- ============================================

-- Eliminar columna juguete_id de movimientos
ALTER TABLE movimientos 
DROP COLUMN IF EXISTS juguete_id;

-- Eliminar columna juguete_id de ventas
ALTER TABLE ventas 
DROP COLUMN IF EXISTS juguete_id;

-- ============================================
-- PASO 5: Hacer juguete_codigo NOT NULL
-- ============================================
-- Primero verificar que no haya NULLs antes de hacer NOT NULL

DO $$
DECLARE
    movimientos_nulos INTEGER;
    ventas_nulas INTEGER;
BEGIN
    SELECT COUNT(*) INTO movimientos_nulos
    FROM movimientos
    WHERE juguete_codigo IS NULL;
    
    SELECT COUNT(*) INTO ventas_nulas
    FROM ventas
    WHERE juguete_codigo IS NULL;
    
    IF movimientos_nulos > 0 THEN
        RAISE EXCEPTION 'No se puede hacer NOT NULL: hay % movimientos con juguete_codigo NULL. Revisa los datos primero.', movimientos_nulos;
    END IF;
    
    IF ventas_nulas > 0 THEN
        RAISE EXCEPTION 'No se puede hacer NOT NULL: hay % ventas con juguete_codigo NULL. Revisa los datos primero.', ventas_nulas;
    END IF;
END $$;

-- Si llegamos aquí, todos los registros tienen código, podemos hacer NOT NULL
-- Hacer juguete_codigo NOT NULL en movimientos
ALTER TABLE movimientos 
ALTER COLUMN juguete_codigo SET NOT NULL;

-- Hacer juguete_codigo NOT NULL en ventas
ALTER TABLE ventas 
ALTER COLUMN juguete_codigo SET NOT NULL;

-- ============================================
-- PASO 6: Crear índices para mejorar rendimiento
-- ============================================

-- Índice en movimientos.juguete_codigo
CREATE INDEX IF NOT EXISTS idx_movimientos_juguete_codigo 
ON movimientos(juguete_codigo);

-- Índice en ventas.juguete_codigo
CREATE INDEX IF NOT EXISTS idx_ventas_juguete_codigo 
ON ventas(juguete_codigo);

-- ============================================
-- PASO 7: Actualizar planes_movimiento (items JSONB)
-- ============================================
-- Nota: Los planes_movimiento usan JSONB, así que necesitamos actualizar
-- los items que contienen juguete_id a juguete_codigo

DO $$
DECLARE
    plan_record RECORD;
    items_actualizados JSONB;
    item JSONB;
    juguete_codigo_val VARCHAR(50);
BEGIN
    FOR plan_record IN 
        SELECT id, items 
        FROM planes_movimiento
        WHERE items IS NOT NULL
    LOOP
        items_actualizados := '[]'::JSONB;
        
        -- Procesar cada item del plan
        FOR item IN SELECT * FROM jsonb_array_elements(plan_record.items)
        LOOP
            -- Si el item tiene juguete_id, buscar el código
            IF item ? 'juguete_id' THEN
                SELECT codigo INTO juguete_codigo_val
                FROM juguetes
                WHERE id = (item->>'juguete_id')::INTEGER
                LIMIT 1;
                
                IF juguete_codigo_val IS NOT NULL THEN
                    -- Crear nuevo item con código en lugar de id
                    item := item - 'juguete_id' || jsonb_build_object('juguete_codigo', juguete_codigo_val);
                END IF;
            END IF;
            
            items_actualizados := items_actualizados || item;
        END LOOP;
        
        -- Actualizar el plan con los items actualizados
        UPDATE planes_movimiento
        SET items = items_actualizados
        WHERE id = plan_record.id;
    END LOOP;
    
    RAISE NOTICE 'Planes de movimiento actualizados correctamente';
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que no haya movimientos sin código
SELECT COUNT(*) as movimientos_sin_codigo
FROM movimientos
WHERE juguete_codigo IS NULL;

-- Verificar que no haya ventas sin código
SELECT COUNT(*) as ventas_sin_codigo
FROM ventas
WHERE juguete_codigo IS NULL;

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Esta migración es irreversible - asegúrate de tener un backup
-- 2. Después de ejecutar, actualiza el código JavaScript para usar juguete_codigo
-- 3. Las facturas_items ya usan juguete_codigo, no necesitan cambios
-- 4. Los planes_movimiento se actualizan automáticamente
-- ============================================

