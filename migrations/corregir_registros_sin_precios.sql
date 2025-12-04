-- ============================================
-- MIGRACIÓN: Corregir registros sin precios
-- Fecha: 2025-12-04
-- ============================================
-- Este script corrige los registros de juguetes que tienen NULL en precio_min o precio_por_mayor
-- copiando los datos de otro registro con el mismo código y nombre en otra ubicación.
-- ============================================

DO $$
DECLARE
    registro_actual RECORD;
    registro_origen RECORD;
    registros_corregidos INTEGER := 0;
    registros_sin_origen INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Iniciando corrección de registros sin precios...';
    RAISE NOTICE '========================================';
    
    -- Iterar sobre todos los registros que tienen NULL en precio_min o precio_por_mayor
    FOR registro_actual IN 
        SELECT 
            j1.id,
            j1.codigo,
            j1.nombre,
            j1.precio_min,
            j1.precio_por_mayor,
            j1.item,
            j1.numero_bultos,
            j1.cantidad_por_bulto,
            j1.foto_url,
            j1.bodega_id,
            j1.tienda_id,
            j1.empresa_id
        FROM juguetes j1
        WHERE (j1.precio_min IS NULL OR j1.precio_por_mayor IS NULL)
            AND j1.empresa_id IS NOT NULL
    LOOP
        -- Buscar otro registro con el mismo código y nombre en otra ubicación que tenga precios
        SELECT 
            j2.id,
            j2.precio_min,
            j2.precio_por_mayor,
            j2.item,
            j2.numero_bultos,
            j2.cantidad_por_bulto,
            j2.foto_url
        INTO registro_origen
        FROM juguetes j2
        WHERE j2.codigo = registro_actual.codigo
            AND j2.nombre = registro_actual.nombre
            AND j2.empresa_id = registro_actual.empresa_id
            AND j2.id != registro_actual.id
            AND (
                -- Debe estar en una ubicación diferente
                (registro_actual.bodega_id IS NOT NULL AND j2.bodega_id IS NULL AND j2.tienda_id IS NOT NULL)
                OR (registro_actual.tienda_id IS NOT NULL AND j2.tienda_id IS NULL AND j2.bodega_id IS NOT NULL)
                OR (registro_actual.bodega_id IS NOT NULL AND j2.bodega_id IS NOT NULL AND j2.bodega_id != registro_actual.bodega_id)
                OR (registro_actual.tienda_id IS NOT NULL AND j2.tienda_id IS NOT NULL AND j2.tienda_id != registro_actual.tienda_id)
            )
            AND j2.precio_min IS NOT NULL  -- El registro origen debe tener precio_min
        ORDER BY 
            -- Priorizar registros con más datos completos
            CASE WHEN j2.precio_por_mayor IS NOT NULL THEN 1 ELSE 2 END,
            CASE WHEN j2.item IS NOT NULL THEN 1 ELSE 2 END,
            j2.id
        LIMIT 1;
        
        IF FOUND AND registro_origen.id IS NOT NULL THEN
            -- Actualizar el registro actual con los datos del registro origen
            UPDATE juguetes
            SET 
                precio_min = COALESCE(registro_actual.precio_min, registro_origen.precio_min),
                precio_por_mayor = COALESCE(registro_actual.precio_por_mayor, registro_origen.precio_por_mayor),
                item = COALESCE(registro_actual.item, registro_origen.item),
                numero_bultos = COALESCE(registro_actual.numero_bultos, registro_origen.numero_bultos),
                cantidad_por_bulto = COALESCE(registro_actual.cantidad_por_bulto, registro_origen.cantidad_por_bulto),
                foto_url = COALESCE(registro_actual.foto_url, registro_origen.foto_url),
                updated_at = NOW()
            WHERE id = registro_actual.id;
            
            registros_corregidos := registros_corregidos + 1;
            
            RAISE NOTICE 'Registro ID % (código: %, nombre: %) corregido desde registro ID %', 
                registro_actual.id, 
                registro_actual.codigo, 
                registro_actual.nombre,
                registro_origen.id;
        ELSE
            registros_sin_origen := registros_sin_origen + 1;
            RAISE NOTICE 'Registro ID % (código: %, nombre: %) no tiene origen con datos para copiar', 
                registro_actual.id, 
                registro_actual.codigo, 
                registro_actual.nombre;
        END IF;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Corrección completada:';
    RAISE NOTICE '  - Registros corregidos: %', registros_corregidos;
    RAISE NOTICE '  - Registros sin origen disponible: %', registros_sin_origen;
    RAISE NOTICE '========================================';
END $$;

-- Verificar resultados
SELECT 
    COUNT(*) as total_registros,
    COUNT(CASE WHEN precio_min IS NULL THEN 1 END) as sin_precio_min,
    COUNT(CASE WHEN precio_por_mayor IS NULL THEN 1 END) as sin_precio_por_mayor,
    COUNT(CASE WHEN precio_min IS NULL AND precio_por_mayor IS NULL THEN 1 END) as sin_ambos_precios
FROM juguetes
WHERE empresa_id IS NOT NULL;

