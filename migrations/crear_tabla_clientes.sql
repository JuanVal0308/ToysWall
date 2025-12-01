-- Migración: Crear tabla clientes y tabla pagos
-- Fecha: 2024

-- Tabla: clientes
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(255),
    direccion TEXT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: pagos (para pagos parciales de ventas a crédito)
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    monto DECIMAL(10, 2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL, -- 'efectivo', 'transferencia', 'credito'
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar cliente_id y abono a ventas si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'cliente_id'
    ) THEN
        ALTER TABLE ventas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;
        RAISE NOTICE 'Columna cliente_id agregada a la tabla ventas.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'abono'
    ) THEN
        ALTER TABLE ventas ADD COLUMN abono DECIMAL(10, 2) DEFAULT 0;
        RAISE NOTICE 'Columna abono agregada a la tabla ventas.';
    END IF;
END $$;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_correo ON clientes(correo);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_id ON pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id ON ventas(cliente_id);

-- Comentarios
COMMENT ON TABLE clientes IS 'Tabla de clientes para ventas al por mayor';
COMMENT ON TABLE pagos IS 'Tabla de pagos parciales para ventas a crédito';
COMMENT ON COLUMN ventas.cliente_id IS 'ID del cliente asociado a la venta (solo para ventas al por mayor)';
COMMENT ON COLUMN ventas.abono IS 'Monto abonado en esta venta (para pagos parciales)';

-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clientes
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
CREATE POLICY "clientes_select_policy" ON clientes
    FOR SELECT
    USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "clientes_insert_policy" ON clientes;
CREATE POLICY "clientes_insert_policy" ON clientes
    FOR INSERT
    WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "clientes_update_policy" ON clientes;
CREATE POLICY "clientes_update_policy" ON clientes
    FOR UPDATE
    USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "clientes_delete_policy" ON clientes;
CREATE POLICY "clientes_delete_policy" ON clientes
    FOR DELETE
    USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

-- Políticas RLS para pagos
DROP POLICY IF EXISTS "pagos_select_policy" ON pagos;
CREATE POLICY "pagos_select_policy" ON pagos
    FOR SELECT
    USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "pagos_insert_policy" ON pagos;
CREATE POLICY "pagos_insert_policy" ON pagos
    FOR INSERT
    WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "pagos_update_policy" ON pagos;
CREATE POLICY "pagos_update_policy" ON pagos
    FOR UPDATE
    USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "pagos_delete_policy" ON pagos;
CREATE POLICY "pagos_delete_policy" ON pagos
    FOR DELETE
    USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios 
            WHERE id = auth.uid()
        )
    );

