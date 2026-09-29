-- ============================================
-- MIGRACIÓN SIMPLIFICADA: INVENTARIO POR UBICACIÓN
-- Sistema de Inventario - Toys Walls
-- ============================================
-- Esta migración aprovecha el modelo EXISTENTE donde cada fila de
-- juguetes YA tiene bodega_id o tienda_id (una fila por ubicación).
-- Solo agrega tablas auxiliares para facilitar consultas y UI.
-- ============================================
-- IMPORTANTE: Esta migración es IDEMPOTENTE (puede ejecutarse múltiples veces)
-- ============================================

-- ============================================
-- 1. CREAR TABLA AUXILIAR DE UBICACIONES
-- ============================================
-- Tabla opcional que cataloga ubicaciones para facilitar filtros en UI
-- NO es required para el funcionamiento del inventario

CREATE TABLE IF NOT EXISTS ubicaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tienda', 'bodega')),
    direccion TEXT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    -- Referencias a las tablas reales
    tienda_id INTEGER UNIQUE REFERENCES tiendas(id) ON DELETE CASCADE,
    bodega_id INTEGER UNIQUE REFERENCES bodegas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Asegurar que cada tienda/bodega tenga solo una entrada en ubicaciones
    CONSTRAINT ubicacion_unica CHECK (
        (tienda_id IS NOT NULL AND bodega_id IS NULL) OR
        (tienda_id IS NULL AND bodega_id IS NOT NULL)
    )
);

COMMENT ON TABLE ubicaciones IS 'Catálogo de ubicaciones (tiendas y bodegas) para facilitar filtros en UI';

-- ============================================
-- 2. POBLAR TABLA UBICACIONES DESDE DATOS EXISTENTES
-- ============================================
-- Insertar tiendas existentes (idempotente - solo si no existen)
INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, tienda_id, activo, created_at, updated_at)
SELECT 
    t.nombre,
    'tienda'::VARCHAR(20),
    t.direccion,
    t.empresa_id,
    t.id,
    TRUE,
    t.created_at,
    t.updated_at
FROM tiendas t
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones u WHERE u.tienda_id = t.id
)
ON CONFLICT (tienda_id) DO NOTHING;

-- Insertar bodegas existentes (idempotente - solo si no existen)
INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, bodega_id, activo, created_at, updated_at)
SELECT 
    b.nombre,
    'bodega'::VARCHAR(20),
    b.direccion,
    b.empresa_id,
    b.id,
    TRUE,
    b.created_at,
    b.updated_at
FROM bodegas b
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones u WHERE u.bodega_id = b.id
)
ON CONFLICT (bodega_id) DO NOTHING;

-- ============================================
-- 3. CREAR VISTA PARA INVENTARIO CONSOLIDADO
-- ============================================
-- Vista que agrupa el inventario por código mostrando todas las ubicaciones

CREATE OR REPLACE VIEW vista_inventario_por_ubicacion AS
SELECT 
    j.id as juguete_fila_id,
    j.codigo,
    j.nombre,
    j.item,
    j.cantidad,
    j.foto_url,
    j.precio_min,
    j.precio_por_mayor,
    j.numero_bultos,
    j.cantidad_por_bulto,
    j.empresa_id,
    CASE 
        WHEN j.bodega_id IS NOT NULL THEN 'bodega'
        WHEN j.tienda_id IS NOT NULL THEN 'tienda'
        ELSE 'sin_ubicacion'
    END as tipo_ubicacion,
    COALESCE(t.nombre, b.nombre, 'Sin ubicación') as ubicacion_nombre,
    COALESCE(t.id, b.id) as ubicacion_referencia_id,
    j.bodega_id,
    j.tienda_id,
    j.created_at,
    j.updated_at
FROM juguetes j
LEFT JOIN tiendas t ON t.id = j.tienda_id
LEFT JOIN bodegas b ON b.id = j.bodega_id;

COMMENT ON VIEW vista_inventario_por_ubicacion IS 'Vista del inventario mostrando cada fila con su ubicación';

-- Vista consolidada por código (suma todas las ubicaciones)
CREATE OR REPLACE VIEW vista_inventario_consolidado AS
SELECT 
    MIN(j.id) as id_referencia,
    j.codigo,
    MIN(j.nombre) as nombre,
    MIN(j.item) as item,
    MIN(j.foto_url) as foto_url,
    MIN(j.precio_min) as precio_min,
    MIN(j.precio_por_mayor) as precio_por_mayor,
    SUM(j.cantidad) as cantidad_total,
    COUNT(*) as numero_ubicaciones,
    j.empresa_id,
    json_agg(
        json_build_object(
            'fila_id', j.id,
            'cantidad', j.cantidad,
            'ubicacion_tipo', CASE 
                WHEN j.bodega_id IS NOT NULL THEN 'bodega'
                WHEN j.tienda_id IS NOT NULL THEN 'tienda'
                ELSE 'sin_ubicacion'
            END,
            'ubicacion_nombre', COALESCE(t.nombre, b.nombre, 'Sin ubicación'),
            'bodega_id', j.bodega_id,
            'tienda_id', j.tienda_id,
            'numero_bultos', j.numero_bultos,
            'cantidad_por_bulto', j.cantidad_por_bulto
        ) ORDER BY j.id
    ) as ubicaciones_detalle
FROM juguetes j
LEFT JOIN tiendas t ON t.id = j.tienda_id
LEFT JOIN bodegas b ON b.id = j.bodega_id
GROUP BY j.codigo, j.empresa_id;

COMMENT ON VIEW vista_inventario_consolidado IS 'Inventario consolidado por código sumando todas las ubicaciones';

-- ============================================
-- 4. ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================

-- Índices en ubicaciones
CREATE INDEX IF NOT EXISTS idx_ubicaciones_empresa ON ubicaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_tipo ON ubicaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_tienda ON ubicaciones(tienda_id) WHERE tienda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ubicaciones_bodega ON ubicaciones(bodega_id) WHERE bodega_id IS NOT NULL;

-- Índices en juguetes (si no existen)
CREATE INDEX IF NOT EXISTS idx_juguetes_codigo ON juguetes(codigo);
CREATE INDEX IF NOT EXISTS idx_juguetes_codigo_empresa ON juguetes(codigo, empresa_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_bodega ON juguetes(bodega_id) WHERE bodega_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_juguetes_tienda ON juguetes(tienda_id) WHERE tienda_id IS NOT NULL;

-- ============================================
-- 5. POLÍTICAS RLS PARA UBICACIONES
-- ============================================

ALTER TABLE ubicaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ubicaciones_select_policy" ON ubicaciones;
CREATE POLICY "ubicaciones_select_policy"
    ON ubicaciones FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "ubicaciones_insert_policy" ON ubicaciones;
CREATE POLICY "ubicaciones_insert_policy"
    ON ubicaciones FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "ubicaciones_update_policy" ON ubicaciones;
CREATE POLICY "ubicaciones_update_policy"
    ON ubicaciones FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "ubicaciones_delete_policy" ON ubicaciones;
CREATE POLICY "ubicaciones_delete_policy"
    ON ubicaciones FOR DELETE
    USING (true);

-- ============================================
-- 6. TRIGGERS PARA MANTENER UPDATED_AT
-- ============================================

DROP TRIGGER IF EXISTS update_ubicaciones_updated_at ON ubicaciones;
CREATE TRIGGER update_ubicaciones_updated_at
    BEFORE UPDATE ON ubicaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. FUNCIONES AUXILIARES
-- ============================================

-- Función para sincronizar ubicaciones desde tiendas/bodegas
-- Útil si se agregan nuevas tiendas/bodegas después de la migración
CREATE OR REPLACE FUNCTION sincronizar_ubicaciones()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insertar tiendas nuevas
    INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, tienda_id, activo)
    SELECT t.nombre, 'tienda', t.direccion, t.empresa_id, t.id, TRUE
    FROM tiendas t
    WHERE NOT EXISTS (
        SELECT 1 FROM ubicaciones u WHERE u.tienda_id = t.id
    )
    ON CONFLICT (tienda_id) DO NOTHING;

    -- Insertar bodegas nuevas
    INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, bodega_id, activo)
    SELECT b.nombre, 'bodega', b.direccion, b.empresa_id, b.id, TRUE
    FROM bodegas b
    WHERE NOT EXISTS (
        SELECT 1 FROM ubicaciones u WHERE u.bodega_id = b.id
    )
    ON CONFLICT (bodega_id) DO NOTHING;
    
    RAISE NOTICE 'Ubicaciones sincronizadas correctamente';
END;
$$;

COMMENT ON FUNCTION sincronizar_ubicaciones IS 'Sincroniza la tabla ubicaciones con tiendas y bodegas nuevas';

-- Función para obtener inventario total por código
CREATE OR REPLACE FUNCTION obtener_inventario_total_codigo(p_codigo VARCHAR, p_empresa_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INTEGER;
BEGIN
    SELECT COALESCE(SUM(cantidad), 0)
    INTO v_total
    FROM juguetes
    WHERE codigo = p_codigo
    AND empresa_id = p_empresa_id;
    
    RETURN v_total;
END;
$$;

COMMENT ON FUNCTION obtener_inventario_total_codigo IS 'Retorna la cantidad total de un producto sumando todas las ubicaciones';

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Migración de inventario por ubicación completada exitosamente';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Resumen:';
    RAISE NOTICE '   - Tabla ubicaciones: creada y poblada desde tiendas/bodegas existentes';
    RAISE NOTICE '   - Vistas: vista_inventario_por_ubicacion, vista_inventario_consolidado';
    RAISE NOTICE '   - Índices: agregados para mejor rendimiento';
    RAISE NOTICE '   - Funciones: sincronizar_ubicaciones(), obtener_inventario_total_codigo()';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANTE:';
    RAISE NOTICE '   - El modelo EXISTENTE de juguetes (con bodega_id/tienda_id) sigue funcionando';
    RAISE NOTICE '   - La tabla ubicaciones es AUXILIAR para facilitar filtros en UI';
    RAISE NOTICE '   - NO se modificaron ni borraron datos existentes';
    RAISE NOTICE '   - Esta migración es IDEMPOTENTE (puede ejecutarse múltiples veces)';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Para verificar:';
    RAISE NOTICE '   SELECT * FROM ubicaciones;';
    RAISE NOTICE '   SELECT * FROM vista_inventario_consolidado LIMIT 5;';
END;
$$;
