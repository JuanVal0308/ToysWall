-- ============================================
-- MIGRACIÓN: INVENTARIO POR UBICACIÓN
-- Sistema de Inventario - Toys Walls
-- ============================================
-- Esta migración agrega soporte para inventario por ubicación
-- permitiendo que cada producto tenga stock en múltiples tiendas/bodegas
-- ============================================

-- ============================================
-- 1. CREAR TABLA DE UBICACIONES UNIFICADA
-- ============================================

-- Tabla: ubicaciones (unifica tiendas y bodegas en una sola entidad)
CREATE TABLE IF NOT EXISTS ubicaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tienda', 'bodega', 'general')),
    direccion TEXT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    descripcion TEXT,
    -- Referencias a las tablas legacy (para mantener compatibilidad)
    tienda_id INTEGER REFERENCES tiendas(id) ON DELETE SET NULL,
    bodega_id INTEGER REFERENCES bodegas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT ubicacion_unica UNIQUE (empresa_id, tienda_id, bodega_id)
);

COMMENT ON TABLE ubicaciones IS 'Ubicaciones unificadas (tiendas, bodegas y ubicación general) para el sistema de inventario por ubicación';
COMMENT ON COLUMN ubicaciones.tipo IS 'Tipo de ubicación: tienda, bodega, o general (inventario sin ubicación específica)';

-- ============================================
-- 2. CREAR TABLA DE INVENTARIO POR UBICACIÓN
-- ============================================

-- Tabla: inventario_por_ubicacion (cantidad de cada producto en cada ubicación)
CREATE TABLE IF NOT EXISTS inventario_por_ubicacion (
    id SERIAL PRIMARY KEY,
    juguete_codigo VARCHAR(50) NOT NULL,
    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    -- Información adicional por ubicación
    numero_bultos INTEGER,
    cantidad_por_bulto INTEGER,
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Asegurar que cada producto tenga un solo registro por ubicación por empresa
    CONSTRAINT inventario_unico_por_ubicacion UNIQUE (juguete_codigo, ubicacion_id, empresa_id)
);

COMMENT ON TABLE inventario_por_ubicacion IS 'Cantidad de cada producto (por código) en cada ubicación';
COMMENT ON COLUMN inventario_por_ubicacion.juguete_codigo IS 'Código del juguete (relación con juguetes.codigo)';
COMMENT ON COLUMN inventario_por_ubicacion.cantidad IS 'Cantidad disponible en esta ubicación';

-- ============================================
-- 3. CREAR ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================

-- Índices para ubicaciones
CREATE INDEX IF NOT EXISTS idx_ubicaciones_empresa ON ubicaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_tipo ON ubicaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_activo ON ubicaciones(activo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_tienda ON ubicaciones(tienda_id) WHERE tienda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ubicaciones_bodega ON ubicaciones(bodega_id) WHERE bodega_id IS NOT NULL;

-- Índices para inventario_por_ubicacion
CREATE INDEX IF NOT EXISTS idx_inventario_ubicacion_codigo ON inventario_por_ubicacion(juguete_codigo);
CREATE INDEX IF NOT EXISTS idx_inventario_ubicacion_ubicacion ON inventario_por_ubicacion(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_inventario_ubicacion_empresa ON inventario_por_ubicacion(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inventario_ubicacion_cantidad ON inventario_por_ubicacion(cantidad) WHERE cantidad > 0;

-- ============================================
-- 4. MIGRAR DATOS EXISTENTES
-- ============================================

-- 4.1. Migrar tiendas a ubicaciones
INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, activo, tienda_id, created_at, updated_at)
SELECT 
    t.nombre,
    'tienda'::VARCHAR(20),
    t.direccion,
    t.empresa_id,
    TRUE,
    t.id,
    t.created_at,
    t.updated_at
FROM tiendas t
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones u WHERE u.tienda_id = t.id
);

-- 4.2. Migrar bodegas a ubicaciones
INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, activo, bodega_id, created_at, updated_at)
SELECT 
    b.nombre,
    'bodega'::VARCHAR(20),
    b.direccion,
    b.empresa_id,
    TRUE,
    b.id,
    b.created_at,
    b.updated_at
FROM bodegas b
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones u WHERE u.bodega_id = b.id
);

-- 4.3. Crear ubicación "General" para cada empresa (para productos sin ubicación específica)
INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, activo, descripcion, created_at)
SELECT 
    'Inventario General',
    'general'::VARCHAR(20),
    'Ubicación por defecto',
    e.id,
    TRUE,
    'Ubicación por defecto para productos sin ubicación específica asignada',
    NOW()
FROM empresas e
WHERE NOT EXISTS (
    SELECT 1 FROM ubicaciones u 
    WHERE u.empresa_id = e.id 
    AND u.tipo = 'general'
    AND u.tienda_id IS NULL 
    AND u.bodega_id IS NULL
);

-- 4.4. Migrar inventario existente de juguetes a inventario_por_ubicacion
-- Migrar juguetes con bodega asignada
INSERT INTO inventario_por_ubicacion (juguete_codigo, ubicacion_id, cantidad, empresa_id, numero_bultos, cantidad_por_bulto, created_at, updated_at)
SELECT 
    j.codigo,
    u.id,
    COALESCE(j.cantidad, 0),
    j.empresa_id,
    j.numero_bultos,
    j.cantidad_por_bulto,
    j.created_at,
    j.updated_at
FROM juguetes j
INNER JOIN ubicaciones u ON u.bodega_id = j.bodega_id
WHERE j.bodega_id IS NOT NULL
ON CONFLICT (juguete_codigo, ubicacion_id, empresa_id) 
DO UPDATE SET 
    cantidad = inventario_por_ubicacion.cantidad + EXCLUDED.cantidad,
    updated_at = NOW();

-- Migrar juguetes con tienda asignada
INSERT INTO inventario_por_ubicacion (juguete_codigo, ubicacion_id, cantidad, empresa_id, numero_bultos, cantidad_por_bulto, created_at, updated_at)
SELECT 
    j.codigo,
    u.id,
    COALESCE(j.cantidad, 0),
    j.empresa_id,
    j.numero_bultos,
    j.cantidad_por_bulto,
    j.created_at,
    j.updated_at
FROM juguetes j
INNER JOIN ubicaciones u ON u.tienda_id = j.tienda_id
WHERE j.tienda_id IS NOT NULL
ON CONFLICT (juguete_codigo, ubicacion_id, empresa_id) 
DO UPDATE SET 
    cantidad = inventario_por_ubicacion.cantidad + EXCLUDED.cantidad,
    updated_at = NOW();

-- Migrar juguetes sin ubicación específica a ubicación "General"
INSERT INTO inventario_por_ubicacion (juguete_codigo, ubicacion_id, cantidad, empresa_id, numero_bultos, cantidad_por_bulto, created_at, updated_at)
SELECT 
    j.codigo,
    u.id,
    COALESCE(j.cantidad, 0),
    j.empresa_id,
    j.numero_bultos,
    j.cantidad_por_bulto,
    j.created_at,
    j.updated_at
FROM juguetes j
INNER JOIN ubicaciones u ON u.empresa_id = j.empresa_id AND u.tipo = 'general'
WHERE j.bodega_id IS NULL AND j.tienda_id IS NULL
ON CONFLICT (juguete_codigo, ubicacion_id, empresa_id) 
DO UPDATE SET 
    cantidad = inventario_por_ubicacion.cantidad + EXCLUDED.cantidad,
    updated_at = NOW();

-- ============================================
-- 5. CREAR VISTA PARA INVENTARIO CONSOLIDADO
-- ============================================

-- Vista: vista_inventario_consolidado (inventario total por producto)
CREATE OR REPLACE VIEW vista_inventario_consolidado AS
SELECT 
    j.id as juguete_id,
    j.codigo,
    j.nombre,
    j.item,
    j.foto_url,
    j.precio_min,
    j.precio_por_mayor,
    j.empresa_id,
    COALESCE(SUM(ipu.cantidad), 0) as cantidad_total,
    COUNT(DISTINCT ipu.ubicacion_id) as numero_ubicaciones,
    json_agg(
        json_build_object(
            'ubicacion_id', u.id,
            'ubicacion_nombre', u.nombre,
            'ubicacion_tipo', u.tipo,
            'cantidad', ipu.cantidad,
            'numero_bultos', ipu.numero_bultos,
            'cantidad_por_bulto', ipu.cantidad_por_bulto
        ) ORDER BY u.tipo, u.nombre
    ) FILTER (WHERE ipu.id IS NOT NULL) as ubicaciones_con_stock
FROM juguetes j
LEFT JOIN inventario_por_ubicacion ipu ON ipu.juguete_codigo = j.codigo AND ipu.empresa_id = j.empresa_id
LEFT JOIN ubicaciones u ON u.id = ipu.ubicacion_id
GROUP BY j.id, j.codigo, j.nombre, j.item, j.foto_url, j.precio_min, j.precio_por_mayor, j.empresa_id;

COMMENT ON VIEW vista_inventario_consolidado IS 'Vista consolidada del inventario mostrando el total por producto y el desglose por ubicación';

-- ============================================
-- 6. POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS en ubicaciones
ALTER TABLE ubicaciones ENABLE ROW LEVEL SECURITY;

-- Políticas para ubicaciones
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

-- Habilitar RLS en inventario_por_ubicacion
ALTER TABLE inventario_por_ubicacion ENABLE ROW LEVEL SECURITY;

-- Políticas para inventario_por_ubicacion
DROP POLICY IF EXISTS "inventario_ubicacion_select_policy" ON inventario_por_ubicacion;
CREATE POLICY "inventario_ubicacion_select_policy"
    ON inventario_por_ubicacion FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "inventario_ubicacion_insert_policy" ON inventario_por_ubicacion;
CREATE POLICY "inventario_ubicacion_insert_policy"
    ON inventario_por_ubicacion FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "inventario_ubicacion_update_policy" ON inventario_por_ubicacion;
CREATE POLICY "inventario_ubicacion_update_policy"
    ON inventario_por_ubicacion FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "inventario_ubicacion_delete_policy" ON inventario_por_ubicacion;
CREATE POLICY "inventario_ubicacion_delete_policy"
    ON inventario_por_ubicacion FOR DELETE
    USING (true);

-- ============================================
-- 7. TRIGGERS PARA MANTENER UPDATED_AT
-- ============================================

-- Trigger para ubicaciones
DROP TRIGGER IF EXISTS update_ubicaciones_updated_at ON ubicaciones;
CREATE TRIGGER update_ubicaciones_updated_at
    BEFORE UPDATE ON ubicaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para inventario_por_ubicacion
DROP TRIGGER IF EXISTS update_inventario_ubicacion_updated_at ON inventario_por_ubicacion;
CREATE TRIGGER update_inventario_ubicacion_updated_at
    BEFORE UPDATE ON inventario_por_ubicacion
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. FUNCIÓN PARA SINCRONIZAR INVENTARIO
-- ============================================

-- Función para sincronizar inventario desde juguetes a inventario_por_ubicacion
-- (útil para mantener compatibilidad con código legacy)
CREATE OR REPLACE FUNCTION sincronizar_inventario_desde_juguetes()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Actualizar inventario_por_ubicacion con datos de juguetes que tienen bodega_id
    UPDATE inventario_por_ubicacion ipu
    SET cantidad = j.cantidad,
        numero_bultos = j.numero_bultos,
        cantidad_por_bulto = j.cantidad_por_bulto,
        updated_at = NOW()
    FROM juguetes j
    INNER JOIN ubicaciones u ON u.bodega_id = j.bodega_id
    WHERE ipu.juguete_codigo = j.codigo
    AND ipu.ubicacion_id = u.id
    AND ipu.empresa_id = j.empresa_id
    AND j.bodega_id IS NOT NULL;

    -- Actualizar inventario_por_ubicacion con datos de juguetes que tienen tienda_id
    UPDATE inventario_por_ubicacion ipu
    SET cantidad = j.cantidad,
        numero_bultos = j.numero_bultos,
        cantidad_por_bulto = j.cantidad_por_bulto,
        updated_at = NOW()
    FROM juguetes j
    INNER JOIN ubicaciones u ON u.tienda_id = j.tienda_id
    WHERE ipu.juguete_codigo = j.codigo
    AND ipu.ubicacion_id = u.id
    AND ipu.empresa_id = j.empresa_id
    AND j.tienda_id IS NOT NULL;
    
    RAISE NOTICE 'Inventario sincronizado correctamente desde tabla juguetes';
END;
$$;

COMMENT ON FUNCTION sincronizar_inventario_desde_juguetes IS 'Sincroniza el inventario desde la tabla juguetes (legacy) hacia inventario_por_ubicacion';

-- ============================================
-- 9. FUNCIÓN PARA OBTENER INVENTARIO TOTAL POR CÓDIGO
-- ============================================

CREATE OR REPLACE FUNCTION obtener_inventario_total(p_codigo VARCHAR, p_empresa_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INTEGER;
BEGIN
    SELECT COALESCE(SUM(cantidad), 0)
    INTO v_total
    FROM inventario_por_ubicacion
    WHERE juguete_codigo = p_codigo
    AND empresa_id = p_empresa_id;
    
    RETURN v_total;
END;
$$;

COMMENT ON FUNCTION obtener_inventario_total IS 'Retorna la cantidad total disponible de un producto (por código) sumando todas las ubicaciones';

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Migración de inventario por ubicación completada exitosamente';
    RAISE NOTICE '📋 Tablas creadas: ubicaciones, inventario_por_ubicacion';
    RAISE NOTICE '📊 Vista creada: vista_inventario_consolidado';
    RAISE NOTICE '🔧 Funciones creadas: sincronizar_inventario_desde_juguetes, obtener_inventario_total';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANTE: Después de aplicar esta migración:';
    RAISE NOTICE '   1. Verifica que los datos se hayan migrado correctamente';
    RAISE NOTICE '   2. Actualiza el código de la aplicación para usar las nuevas tablas';
    RAISE NOTICE '   3. Una vez confirmado, considera deprecar bodega_id y tienda_id en juguetes';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Para ver el inventario consolidado: SELECT * FROM vista_inventario_consolidado;';
END;
$$;
