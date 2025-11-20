-- ============================================
-- CONFIGURACIÓN COMPLETA DE BASE DE DATOS
-- Toys Walls - Sistema de Inventario Empresarial
-- ============================================
-- INSTRUCCIONES:
-- 1. Copia TODO este archivo
-- 2. Pégalo en el SQL Editor de Supabase
-- 3. Ejecuta el script completo (Run o Ctrl+Enter)
-- ============================================

-- ============================================
-- 1. CREAR TABLAS PRINCIPALES
-- ============================================

-- Tabla: tipo_usuarios
CREATE TABLE IF NOT EXISTS tipo_usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: empresas
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo_usuario_id INTEGER NOT NULL REFERENCES tipo_usuarios(id) ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_usuario_empresa UNIQUE(nombre, empresa_id)
);

-- Tabla: bodegas
CREATE TABLE IF NOT EXISTS bodegas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: categorias
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_categoria_empresa UNIQUE(nombre, empresa_id)
);

-- Tabla: tiendas
CREATE TABLE IF NOT EXISTS tiendas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: empleados (actualizada con documento y relación con tienda)
CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    documento VARCHAR(50) NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    tienda_id INTEGER REFERENCES tiendas(id) ON DELETE SET NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: juguetes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'juguetes') THEN
        CREATE TABLE juguetes (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            codigo VARCHAR(50) NOT NULL,
            cantidad INTEGER NOT NULL DEFAULT 0,
            empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
            bodega_id INTEGER REFERENCES bodegas(id) ON DELETE SET NULL,
            tienda_id INTEGER REFERENCES tiendas(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT check_ubicacion CHECK (
                (bodega_id IS NOT NULL AND tienda_id IS NULL) OR 
                (bodega_id IS NULL AND tienda_id IS NOT NULL)
            )
        );
    ELSE
        -- Actualizar tabla existente
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'juguetes' AND column_name = 'empresa_id') THEN
            ALTER TABLE juguetes ADD COLUMN empresa_id INTEGER;
            UPDATE juguetes j SET empresa_id = b.empresa_id FROM bodegas b WHERE j.bodega_id = b.id;
            ALTER TABLE juguetes ALTER COLUMN empresa_id SET NOT NULL;
            ALTER TABLE juguetes ADD CONSTRAINT juguetes_empresa_id_fkey 
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'juguetes' AND column_name = 'tienda_id') THEN
            ALTER TABLE juguetes ADD COLUMN tienda_id INTEGER 
                REFERENCES tiendas(id) ON DELETE SET NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'juguetes' AND column_name = 'categoria' 
                   AND data_type = 'character varying') THEN
            ALTER TABLE juguetes DROP COLUMN categoria;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'juguetes' AND column_name = 'categoria_id') THEN
            ALTER TABLE juguetes DROP COLUMN categoria_id;
        END IF;
    END IF;
END $$;

-- Tabla: juguetes_categorias (relación muchos a muchos)
CREATE TABLE IF NOT EXISTS juguetes_categorias (
    id SERIAL PRIMARY KEY,
    juguete_id INTEGER NOT NULL REFERENCES juguetes(id) ON DELETE CASCADE,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_juguete_categoria UNIQUE(juguete_id, categoria_id)
);

-- Tabla: ventas
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    codigo_venta VARCHAR(50) NOT NULL UNIQUE,
    juguete_id INTEGER NOT NULL REFERENCES juguetes(id) ON DELETE RESTRICT,
    empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE RESTRICT,
    precio_venta DECIMAL(10, 2) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta')),
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: facturas
CREATE TABLE IF NOT EXISTS facturas (
    id SERIAL PRIMARY KEY,
    codigo_factura VARCHAR(50) NOT NULL UNIQUE,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    cliente_nombre VARCHAR(100) NOT NULL,
    cliente_documento VARCHAR(50) NOT NULL,
    cliente_email VARCHAR(255) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    enviada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: facturas_items (items de la factura)
CREATE TABLE IF NOT EXISTS facturas_items (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
    juguete_nombre VARCHAR(100) NOT NULL,
    juguete_codigo VARCHAR(50) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: movimientos (para abastecer tiendas)
CREATE TABLE IF NOT EXISTS movimientos (
    id SERIAL PRIMARY KEY,
    tipo_origen VARCHAR(20) NOT NULL CHECK (tipo_origen IN ('bodega', 'tienda')),
    origen_id INTEGER NOT NULL,
    tipo_destino VARCHAR(20) NOT NULL CHECK (tipo_destino IN ('bodega', 'tienda')),
    destino_id INTEGER NOT NULL,
    juguete_id INTEGER NOT NULL REFERENCES juguetes(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. CREAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo_usuario_id ON usuarios(tipo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios(nombre);
CREATE INDEX IF NOT EXISTS idx_empresas_nombre ON empresas(nombre);
CREATE INDEX IF NOT EXISTS idx_bodegas_empresa_id ON bodegas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa_id ON categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tiendas_empresa_id ON tiendas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_empresa_id ON empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_tienda_id ON empleados(tienda_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_bodega_id ON juguetes(bodega_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_tienda_id ON juguetes(tienda_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_codigo ON juguetes(codigo);
CREATE INDEX IF NOT EXISTS idx_juguetes_empresa_id ON juguetes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_categorias_juguete_id ON juguetes_categorias(juguete_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_categorias_categoria_id ON juguetes_categorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_ventas_empresa_id ON ventas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ventas_empleado_id ON ventas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON ventas(created_at);
CREATE INDEX IF NOT EXISTS idx_facturas_empresa_id ON facturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_venta_id ON facturas(venta_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_empresa_id ON movimientos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_created_at ON movimientos(created_at);

-- ============================================
-- 3. INSERTAR DATOS INICIALES
-- ============================================

-- Tipos de usuario
INSERT INTO tipo_usuarios (id, nombre, descripcion) VALUES
    (1, 'Super Administrador', 'Acceso completo al sistema, puede gestionar todas las empresas'),
    (2, 'Administrador', 'Administrador de su empresa, puede gestionar usuarios y datos de su empresa'),
    (3, 'Empleado', 'Usuario regular, puede ver y registrar datos según permisos')
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

SELECT setval('tipo_usuarios_id_seq', 3, true);

-- Empresa de ejemplo
INSERT INTO empresas (id, nombre, descripcion) VALUES
    (1, 'Toys Walls', 'Empresa principal de juguetes')
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

SELECT setval('empresas_id_seq', 1, true);

-- Usuarios de ejemplo
INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
    ('Super Admin', 'superadmin@toyswalls.com', 'admin123', 1, 1),
    ('Admin', 'admin@toyswalls.com', 'admin123', 1, 2),
    ('Juan Pérez', 'juan@toyswalls.com', 'empleado123', 1, 3),
    ('María García', 'maria@toyswalls.com', 'empleado123', 1, 3)
ON CONFLICT DO NOTHING;

-- Categorías por defecto
INSERT INTO categorias (nombre, empresa_id) VALUES
    ('Niño', 1),
    ('Niña', 1),
    ('Bebé', 1)
ON CONFLICT (nombre, empresa_id) DO NOTHING;

-- ============================================
-- 4. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS
ALTER TABLE tipo_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE juguetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE juguetes_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "tipo_usuarios_select_policy" ON tipo_usuarios;
DROP POLICY IF EXISTS "empresas_select_policy" ON empresas;
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete_policy" ON usuarios;
DROP POLICY IF EXISTS "bodegas_select_policy" ON bodegas;
DROP POLICY IF EXISTS "bodegas_insert_policy" ON bodegas;
DROP POLICY IF EXISTS "bodegas_update_policy" ON bodegas;
DROP POLICY IF EXISTS "bodegas_delete_policy" ON bodegas;
DROP POLICY IF EXISTS "categorias_select_policy" ON categorias;
DROP POLICY IF EXISTS "categorias_insert_policy" ON categorias;
DROP POLICY IF EXISTS "categorias_update_policy" ON categorias;
DROP POLICY IF EXISTS "categorias_delete_policy" ON categorias;
DROP POLICY IF EXISTS "tiendas_select_policy" ON tiendas;
DROP POLICY IF EXISTS "tiendas_insert_policy" ON tiendas;
DROP POLICY IF EXISTS "tiendas_update_policy" ON tiendas;
DROP POLICY IF EXISTS "tiendas_delete_policy" ON tiendas;
DROP POLICY IF EXISTS "empleados_select_policy" ON empleados;
DROP POLICY IF EXISTS "empleados_insert_policy" ON empleados;
DROP POLICY IF EXISTS "empleados_update_policy" ON empleados;
DROP POLICY IF EXISTS "empleados_delete_policy" ON empleados;
DROP POLICY IF EXISTS "juguetes_select_policy" ON juguetes;
DROP POLICY IF EXISTS "juguetes_insert_policy" ON juguetes;
DROP POLICY IF EXISTS "juguetes_update_policy" ON juguetes;
DROP POLICY IF EXISTS "juguetes_delete_policy" ON juguetes;
DROP POLICY IF EXISTS "juguetes_categorias_select_policy" ON juguetes_categorias;
DROP POLICY IF EXISTS "juguetes_categorias_insert_policy" ON juguetes_categorias;
DROP POLICY IF EXISTS "juguetes_categorias_delete_policy" ON juguetes_categorias;
DROP POLICY IF EXISTS "ventas_select_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_insert_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_update_policy" ON ventas;
DROP POLICY IF EXISTS "facturas_select_policy" ON facturas;
DROP POLICY IF EXISTS "facturas_insert_policy" ON facturas;
DROP POLICY IF EXISTS "facturas_update_policy" ON facturas;
DROP POLICY IF EXISTS "facturas_items_select_policy" ON facturas_items;
DROP POLICY IF EXISTS "facturas_items_insert_policy" ON facturas_items;
DROP POLICY IF EXISTS "movimientos_select_policy" ON movimientos;
DROP POLICY IF EXISTS "movimientos_insert_policy" ON movimientos;
DROP POLICY IF EXISTS "movimientos_update_policy" ON movimientos;

-- Crear políticas RLS
CREATE POLICY "tipo_usuarios_select_policy" ON tipo_usuarios FOR SELECT USING (true);
CREATE POLICY "empresas_select_policy" ON empresas FOR SELECT USING (true);
CREATE POLICY "usuarios_select_policy" ON usuarios FOR SELECT USING (true);
CREATE POLICY "usuarios_insert_policy" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "usuarios_update_policy" ON usuarios FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "usuarios_delete_policy" ON usuarios FOR DELETE USING (true);
CREATE POLICY "bodegas_select_policy" ON bodegas FOR SELECT USING (true);
CREATE POLICY "bodegas_insert_policy" ON bodegas FOR INSERT WITH CHECK (true);
CREATE POLICY "bodegas_update_policy" ON bodegas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "bodegas_delete_policy" ON bodegas FOR DELETE USING (true);
CREATE POLICY "categorias_select_policy" ON categorias FOR SELECT USING (true);
CREATE POLICY "categorias_insert_policy" ON categorias FOR INSERT WITH CHECK (true);
CREATE POLICY "categorias_update_policy" ON categorias FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "categorias_delete_policy" ON categorias FOR DELETE USING (true);
CREATE POLICY "tiendas_select_policy" ON tiendas FOR SELECT USING (true);
CREATE POLICY "tiendas_insert_policy" ON tiendas FOR INSERT WITH CHECK (true);
CREATE POLICY "tiendas_update_policy" ON tiendas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "tiendas_delete_policy" ON tiendas FOR DELETE USING (true);
CREATE POLICY "empleados_select_policy" ON empleados FOR SELECT USING (true);
CREATE POLICY "empleados_insert_policy" ON empleados FOR INSERT WITH CHECK (true);
CREATE POLICY "empleados_update_policy" ON empleados FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "empleados_delete_policy" ON empleados FOR DELETE USING (true);
CREATE POLICY "juguetes_select_policy" ON juguetes FOR SELECT USING (true);
CREATE POLICY "juguetes_insert_policy" ON juguetes FOR INSERT WITH CHECK (true);
CREATE POLICY "juguetes_update_policy" ON juguetes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "juguetes_delete_policy" ON juguetes FOR DELETE USING (true);
CREATE POLICY "juguetes_categorias_select_policy" ON juguetes_categorias FOR SELECT USING (true);
CREATE POLICY "juguetes_categorias_insert_policy" ON juguetes_categorias FOR INSERT WITH CHECK (true);
CREATE POLICY "juguetes_categorias_delete_policy" ON juguetes_categorias FOR DELETE USING (true);
CREATE POLICY "ventas_select_policy" ON ventas FOR SELECT USING (true);
CREATE POLICY "ventas_insert_policy" ON ventas FOR INSERT WITH CHECK (true);
CREATE POLICY "ventas_update_policy" ON ventas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "facturas_select_policy" ON facturas FOR SELECT USING (true);
CREATE POLICY "facturas_insert_policy" ON facturas FOR INSERT WITH CHECK (true);
CREATE POLICY "facturas_update_policy" ON facturas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "facturas_items_select_policy" ON facturas_items FOR SELECT USING (true);
CREATE POLICY "facturas_items_insert_policy" ON facturas_items FOR INSERT WITH CHECK (true);
CREATE POLICY "movimientos_select_policy" ON movimientos FOR SELECT USING (true);
CREATE POLICY "movimientos_insert_policy" ON movimientos FOR INSERT WITH CHECK (true);
CREATE POLICY "movimientos_update_policy" ON movimientos FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================
-- 5. FUNCIONES AUXILIARES
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para generar código de factura
CREATE OR REPLACE FUNCTION generar_codigo_factura()
RETURNS TEXT AS $$
DECLARE
    nuevo_codigo TEXT;
    contador INTEGER;
BEGIN
    -- Formato: FACT-YYYYMMDD-XXX
    nuevo_codigo := 'FACT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
    
    -- Contar facturas del día
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_factura FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO contador
    FROM facturas
    WHERE codigo_factura LIKE nuevo_codigo || '%';
    
    nuevo_codigo := nuevo_codigo || LPAD(contador::TEXT, 3, '0');
    RETURN nuevo_codigo;
END;
$$ LANGUAGE plpgsql;

-- Función para generar código de venta
CREATE OR REPLACE FUNCTION generar_codigo_venta()
RETURNS TEXT AS $$
DECLARE
    nuevo_codigo TEXT;
    contador INTEGER;
BEGIN
    -- Formato: VENT-YYYYMMDD-XXX
    nuevo_codigo := 'VENT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_venta FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO contador
    FROM ventas
    WHERE codigo_venta LIKE nuevo_codigo || '%';
    
    nuevo_codigo := nuevo_codigo || LPAD(contador::TEXT, 3, '0');
    RETURN nuevo_codigo;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CREAR TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_tipo_usuarios_updated_at ON tipo_usuarios;
CREATE TRIGGER update_tipo_usuarios_updated_at BEFORE UPDATE ON tipo_usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_empresas_updated_at ON empresas;
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bodegas_updated_at ON bodegas;
CREATE TRIGGER update_bodegas_updated_at BEFORE UPDATE ON bodegas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categorias_updated_at ON categorias;
CREATE TRIGGER update_categorias_updated_at BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tiendas_updated_at ON tiendas;
CREATE TRIGGER update_tiendas_updated_at BEFORE UPDATE ON tiendas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_empleados_updated_at ON empleados;
CREATE TRIGGER update_empleados_updated_at BEFORE UPDATE ON empleados FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_juguetes_updated_at ON juguetes;
CREATE TRIGGER update_juguetes_updated_at BEFORE UPDATE ON juguetes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ventas_updated_at ON ventas;
CREATE TRIGGER update_ventas_updated_at BEFORE UPDATE ON ventas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_facturas_updated_at ON facturas;
CREATE TRIGGER update_facturas_updated_at BEFORE UPDATE ON facturas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_movimientos_updated_at ON movimientos;
CREATE TRIGGER update_movimientos_updated_at BEFORE UPDATE ON movimientos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- 
-- TABLAS CREADAS:
-- - tipo_usuarios
-- - empresas
-- - usuarios
-- - bodegas
-- - categorias
-- - tiendas
-- - empleados
-- - juguetes
-- - juguetes_categorias (relación muchos a muchos)
-- - ventas
-- - facturas
-- - facturas_items
-- - movimientos
-- 
-- USUARIOS DE EJEMPLO:
-- Super Admin / admin123
-- Admin / admin123
-- Juan Pérez / empleado123
-- María García / empleado123
-- 
-- CATEGORÍAS POR DEFECTO:
-- - Niño
-- - Niña
-- - Bebé
-- 
-- ============================================

