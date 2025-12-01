-- ============================================
-- MIGRACIÓN: Crear tabla planes_movimiento
-- Toys Walls - Sistema de Inventario
-- ============================================

-- Tabla: planes_movimiento
CREATE TABLE IF NOT EXISTS planes_movimiento (
    id SERIAL PRIMARY KEY,
    codigo_plan VARCHAR(50) NOT NULL UNIQUE,
    tipo_origen VARCHAR(20) NOT NULL CHECK (tipo_origen IN ('bodega', 'tienda')),
    origen_id INTEGER NOT NULL,
    origen_nombre VARCHAR(100) NOT NULL,
    tipo_destino VARCHAR(20) NOT NULL CHECK (tipo_destino IN ('bodega', 'tienda')),
    destino_id INTEGER NOT NULL,
    destino_nombre VARCHAR(100) NOT NULL,
    items JSONB NOT NULL, -- Array de {juguete_id, nombre, codigo, cantidad}
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'ejecutado', 'cancelado')),
    total_items INTEGER NOT NULL DEFAULT 0,
    total_unidades INTEGER NOT NULL DEFAULT 0,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    creado_por VARCHAR(100),
    ejecutado_por VARCHAR(100),
    ejecutado_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_planes_movimiento_empresa_id ON planes_movimiento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_planes_movimiento_estado ON planes_movimiento(estado);
CREATE INDEX IF NOT EXISTS idx_planes_movimiento_created_at ON planes_movimiento(created_at DESC);

-- Habilitar RLS
ALTER TABLE planes_movimiento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "planes_movimiento_select_policy" ON planes_movimiento;
CREATE POLICY "planes_movimiento_select_policy"
    ON planes_movimiento FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "planes_movimiento_insert_policy" ON planes_movimiento;
CREATE POLICY "planes_movimiento_insert_policy"
    ON planes_movimiento FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "planes_movimiento_update_policy" ON planes_movimiento;
CREATE POLICY "planes_movimiento_update_policy"
    ON planes_movimiento FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "planes_movimiento_delete_policy" ON planes_movimiento;
CREATE POLICY "planes_movimiento_delete_policy"
    ON planes_movimiento FOR DELETE
    USING (true);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_planes_movimiento_updated_at ON planes_movimiento;
CREATE TRIGGER update_planes_movimiento_updated_at
    BEFORE UPDATE ON planes_movimiento
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================









