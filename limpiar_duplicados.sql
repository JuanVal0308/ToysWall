-- ============================================
-- SCRIPT PARA LIMPIAR JUGUETES DUPLICADOS
-- ============================================
-- Este script consolida juguetes duplicados (mismo código, misma ubicación)
-- y elimina los registros duplicados, manteniendo solo uno con la suma de cantidades
-- NOTA: Los juguetes con el mismo código pero en diferentes ubicaciones NO se consolidan
-- ============================================

-- Paso 1: Crear tabla temporal con juguetes consolidados
-- Solo consolida si tienen el mismo código, nombre Y la misma ubicación (bodega_id o tienda_id)
CREATE TEMP TABLE IF NOT EXISTS juguetes_consolidados AS
SELECT 
    empresa_id,
    codigo,
    nombre,
    bodega_id,
    tienda_id,
    foto_url,
    SUM(cantidad) as cantidad_total,
    MIN(id) as id_principal,
    MIN(created_at) as created_at_original,
    MAX(updated_at) as updated_at_latest
FROM juguetes
GROUP BY empresa_id, codigo, nombre, bodega_id, tienda_id, foto_url
HAVING COUNT(*) > 1;

-- Paso 2: Actualizar el registro principal con la cantidad total
UPDATE juguetes j
SET 
    cantidad = jc.cantidad_total,
    updated_at = jc.updated_at_latest
FROM juguetes_consolidados jc
WHERE j.id = jc.id_principal
  AND j.empresa_id = jc.empresa_id
  AND j.codigo = jc.codigo
  AND COALESCE(j.bodega_id, 0) = COALESCE(jc.bodega_id, 0)
  AND COALESCE(j.tienda_id, 0) = COALESCE(jc.tienda_id, 0);

-- Paso 3: Eliminar los registros duplicados (mantener solo el principal)
DELETE FROM juguetes
WHERE id IN (
    SELECT j.id
    FROM juguetes j
    INNER JOIN juguetes_consolidados jc ON
        j.empresa_id = jc.empresa_id
        AND j.codigo = jc.codigo
        AND COALESCE(j.bodega_id, 0) = COALESCE(jc.bodega_id, 0)
        AND COALESCE(j.tienda_id, 0) = COALESCE(jc.tienda_id, 0)
    WHERE j.id != jc.id_principal
);

-- Paso 4: Limpiar tabla temporal
DROP TABLE IF EXISTS juguetes_consolidados;

-- Verificar resultados (debe verificar código Y nombre)
SELECT 
    codigo,
    nombre,
    CASE 
        WHEN bodega_id IS NOT NULL THEN 'Bodega: ' || bodega_id
        WHEN tienda_id IS NOT NULL THEN 'Tienda: ' || tienda_id
        ELSE 'Sin ubicación'
    END as ubicacion,
    COUNT(*) as registros_duplicados,
    SUM(cantidad) as cantidad_total
FROM juguetes
GROUP BY codigo, nombre, bodega_id, tienda_id
HAVING COUNT(*) > 1;

-- Si la consulta anterior no devuelve resultados, significa que se limpiaron todos los duplicados

