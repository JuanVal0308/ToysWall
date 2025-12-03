-- ============================================
-- MIGRACIÓN: Limpiar estructura de movimientos y ventas
-- Eliminar juguete_id y asegurar que juguete_codigo sea NOT NULL
-- ============================================

-- ============================================
-- MOVIMIENTOS
-- ============================================

-- Paso 1: Asegurar que juguete_codigo existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movimientos' AND column_name = 'juguete_codigo'
    ) THEN
        ALTER TABLE movimientos ADD COLUMN juguete_codigo VARCHAR(50);
    END IF;
END $$;

-- Paso 2: Migrar datos de juguete_id a juguete_codigo si es necesario
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movimientos' AND column_name = 'juguete_id'
    ) THEN
        -- Migrar datos existentes
        UPDATE movimientos m
        SET juguete_codigo = j.codigo
        FROM juguetes j
        WHERE m.juguete_id = j.id
        AND (m.juguete_codigo IS NULL OR m.juguete_codigo = '')
        AND j.codigo IS NOT NULL;
        
        -- Eliminar movimientos huérfanos (sin juguete válido)
        DELETE FROM movimientos 
        WHERE juguete_codigo IS NULL OR juguete_codigo = '';
        
        -- Eliminar columna juguete_id
        ALTER TABLE movimientos DROP COLUMN juguete_id;
    END IF;
END $$;

-- Paso 3: Asegurar que juguete_codigo sea NOT NULL
DO $$
BEGIN
    -- Primero eliminar cualquier NULL restante
    DELETE FROM movimientos WHERE juguete_codigo IS NULL OR juguete_codigo = '';
    
    -- Luego cambiar a NOT NULL si no lo es ya
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movimientos' 
        AND column_name = 'juguete_codigo' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE movimientos ALTER COLUMN juguete_codigo SET NOT NULL;
    END IF;
END $$;

-- ============================================
-- VENTAS
-- ============================================

-- Paso 1: Asegurar que juguete_codigo existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'juguete_codigo'
    ) THEN
        ALTER TABLE ventas ADD COLUMN juguete_codigo VARCHAR(50);
    END IF;
END $$;

-- Paso 2: Migrar datos de juguete_id a juguete_codigo si es necesario
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'juguete_id'
    ) THEN
        -- Migrar datos existentes
        UPDATE ventas v
        SET juguete_codigo = j.codigo
        FROM juguetes j
        WHERE v.juguete_id = j.id
        AND (v.juguete_codigo IS NULL OR v.juguete_codigo = '')
        AND j.codigo IS NOT NULL;
        
        -- Eliminar ventas huérfanas (sin juguete válido)
        DELETE FROM ventas 
        WHERE juguete_codigo IS NULL OR juguete_codigo = '';
        
        -- Eliminar columna juguete_id
        ALTER TABLE ventas DROP COLUMN juguete_id;
    END IF;
END $$;

-- Paso 3: Asegurar que juguete_codigo sea NOT NULL
DO $$
BEGIN
    -- Primero eliminar cualquier NULL restante
    DELETE FROM ventas WHERE juguete_codigo IS NULL OR juguete_codigo = '';
    
    -- Luego cambiar a NOT NULL si no lo es ya
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' 
        AND column_name = 'juguete_codigo' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE ventas ALTER COLUMN juguete_codigo SET NOT NULL;
    END IF;
END $$;

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

DO $$
DECLARE
    movimientos_con_juguete_id INTEGER;
    ventas_con_juguete_id INTEGER;
    movimientos_null INTEGER;
    ventas_null INTEGER;
BEGIN
    -- Verificar si todavía existe juguete_id
    SELECT COUNT(*) INTO movimientos_con_juguete_id
    FROM information_schema.columns 
    WHERE table_name = 'movimientos' AND column_name = 'juguete_id';
    
    SELECT COUNT(*) INTO ventas_con_juguete_id
    FROM information_schema.columns 
    WHERE table_name = 'ventas' AND column_name = 'juguete_id';
    
    -- Verificar NULLs
    SELECT COUNT(*) INTO movimientos_null
    FROM movimientos 
    WHERE juguete_codigo IS NULL OR juguete_codigo = '';
    
    SELECT COUNT(*) INTO ventas_null
    FROM ventas 
    WHERE juguete_codigo IS NULL OR juguete_codigo = '';
    
    -- Reportar resultados
    IF movimientos_con_juguete_id > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: La columna juguete_id todavía existe en movimientos';
    ELSE
        RAISE NOTICE 'OK: La columna juguete_id fue eliminada de movimientos';
    END IF;
    
    IF ventas_con_juguete_id > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: La columna juguete_id todavía existe en ventas';
    ELSE
        RAISE NOTICE 'OK: La columna juguete_id fue eliminada de ventas';
    END IF;
    
    IF movimientos_null > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: Hay % movimientos con juguete_codigo NULL', movimientos_null;
    ELSE
        RAISE NOTICE 'OK: Todos los movimientos tienen juguete_codigo válido';
    END IF;
    
    IF ventas_null > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: Hay % ventas con juguete_codigo NULL', ventas_null;
    ELSE
        RAISE NOTICE 'OK: Todas las ventas tienen juguete_codigo válido';
    END IF;
END $$;


