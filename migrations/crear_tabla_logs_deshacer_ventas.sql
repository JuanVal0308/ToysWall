-- ============================================
-- MIGRACIÓN: Crear tabla logs_deshacer_ventas
-- Registra quién deshace una venta y qué se revirtió
-- ============================================

CREATE TABLE IF NOT EXISTS logs_deshacer_ventas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_id INTEGER, -- usuario de la tabla usuarios que oprimió deshacer
    codigo_venta VARCHAR(100),
    codigo_vendedor VARCHAR(50), -- código del empleado
    empleado_id INTEGER, -- referencia a empleados.id (opcional)
    juguete_codigo VARCHAR(50),
    juguete_nombre VARCHAR(255),
    precio_venta NUMERIC(12,2) NOT NULL,
    cantidad INTEGER NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_deshacer_ventas_empresa_id 
    ON logs_deshacer_ventas(empresa_id);

CREATE INDEX IF NOT EXISTS idx_logs_deshacer_ventas_codigo_venta 
    ON logs_deshacer_ventas(codigo_venta);

-- RLS opcional (seguir mismo patrón abierto que otras tablas de soporte)
ALTER TABLE logs_deshacer_ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_deshacer_ventas_select" ON logs_deshacer_ventas;
CREATE POLICY "logs_deshacer_ventas_select"
    ON logs_deshacer_ventas FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "logs_deshacer_ventas_insert" ON logs_deshacer_ventas;
CREATE POLICY "logs_deshacer_ventas_insert"
    ON logs_deshacer_ventas FOR INSERT
    WITH CHECK (true);


