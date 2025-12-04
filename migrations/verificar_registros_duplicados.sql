-- ============================================
-- VERIFICACIÓN: Detectar registros duplicados
-- Fecha: 2025-12-04
-- ============================================
-- Este script identifica si hay registros duplicados del mismo juguete
-- (mismo código y nombre) en la misma ubicación, lo cual no debería ocurrir
-- con la nueva lógica de movimientos.
-- ============================================

-- Buscar registros duplicados en la misma ubicación
SELECT 
    codigo,
    nombre,
    empresa_id,
    bodega_id,
    tienda_id,
    COUNT(*) as cantidad_registros,
    SUM(cantidad) as cantidad_total,
    STRING_AGG(id::text, ', ' ORDER BY id) as ids_registros
FROM juguetes
WHERE empresa_id IS NOT NULL
GROUP BY codigo, nombre, empresa_id, bodega_id, tienda_id
HAVING COUNT(*) > 1
ORDER BY cantidad_registros DESC, codigo;

-- Resumen de duplicados
SELECT 
    COUNT(DISTINCT codigo || '-' || COALESCE(bodega_id::text, 'B') || '-' || COALESCE(tienda_id::text, 'T')) as grupos_duplicados,
    SUM(cantidad_registros - 1) as registros_duplicados_totales
FROM (
    SELECT 
        codigo,
        bodega_id,
        tienda_id,
        COUNT(*) as cantidad_registros
    FROM juguetes
    WHERE empresa_id IS NOT NULL
    GROUP BY codigo, nombre, empresa_id, bodega_id, tienda_id
    HAVING COUNT(*) > 1
) duplicados;

