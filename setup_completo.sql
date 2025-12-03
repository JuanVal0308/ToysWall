-- ============================================
-- CONFIGURACIÓN COMPLETA DE BASE DE DATOS
-- Toys Walls - Sistema de Inventario
-- ============================================
-- INSTRUCCIONES:
-- 1. Copia TODO este archivo
-- 2. Pégalo en el SQL Editor de Supabase
-- 3. Ejecuta el script completo (Run o Ctrl+Enter)
-- ============================================
-- Este script crea todas las tablas, políticas RLS,
-- índices, triggers y datos iniciales necesarios
-- ============================================

-- ============================================
-- 0. MIGRACIONES Y ACTUALIZACIONES
-- ============================================

-- Migración: Renombrar columna ubicacion a direccion en tiendas (si existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tiendas' AND column_name = 'ubicacion'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tiendas' AND column_name = 'direccion'
    ) THEN
        ALTER TABLE tiendas RENAME COLUMN ubicacion TO direccion;
        RAISE NOTICE 'Columna ubicacion renombrada a direccion en la tabla tiendas.';
    END IF;
END $$;

-- ============================================
-- 1. CREAR TABLAS
-- ============================================

-- Tabla: tipo_usuarios
CREATE TABLE IF NOT EXISTS tipo_usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: empresas (solo ToysWalls)
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
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo_usuario_id INTEGER NOT NULL REFERENCES tipo_usuarios(id) ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Tabla: tiendas
CREATE TABLE IF NOT EXISTS tiendas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: empleados
CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    documento VARCHAR(50),
    ubicacion TEXT,
    tienda_id INTEGER REFERENCES tiendas(id) ON DELETE SET NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: juguetes (sin categorías, con foto_url y precio mínimo)
CREATE TABLE IF NOT EXISTS juguetes (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            codigo VARCHAR(50) NOT NULL,
    item VARCHAR(50),
            cantidad INTEGER NOT NULL DEFAULT 0,
    foto_url TEXT,
    precio_min DECIMAL(10, 2),
    precio_por_mayor DECIMAL(10, 2),
    numero_bultos INTEGER,
    cantidad_por_bulto INTEGER,
            empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
            bodega_id INTEGER REFERENCES bodegas(id) ON DELETE SET NULL,
            tienda_id INTEGER REFERENCES tiendas(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT check_ubicacion CHECK (
                (bodega_id IS NOT NULL AND tienda_id IS NULL) OR 
        (bodega_id IS NULL AND tienda_id IS NOT NULL) OR
        (bodega_id IS NULL AND tienda_id IS NULL)
    )
);

-- Tabla: ventas
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    codigo_venta VARCHAR(50) NOT NULL,
    juguete_codigo VARCHAR(50) NOT NULL, -- Cambiado de juguete_id a juguete_codigo
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
    precio_venta DECIMAL(10, 2) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    metodo_pago VARCHAR(50) NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    facturada BOOLEAN DEFAULT FALSE,
    es_por_mayor BOOLEAN DEFAULT FALSE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    abono DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: facturas
CREATE TABLE IF NOT EXISTS facturas (
    id SERIAL PRIMARY KEY,
    codigo_factura VARCHAR(50) NOT NULL UNIQUE,
    cliente_nombre VARCHAR(100) NOT NULL,
    cliente_documento VARCHAR(50) NOT NULL,
    cliente_email VARCHAR(255) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: facturas_items
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

-- Tabla: movimientos
CREATE TABLE IF NOT EXISTS movimientos (
    id SERIAL PRIMARY KEY,
    tipo_origen VARCHAR(20) NOT NULL CHECK (tipo_origen IN ('bodega', 'tienda')),
    origen_id INTEGER NOT NULL,
    tipo_destino VARCHAR(20) NOT NULL CHECK (tipo_destino IN ('bodega', 'tienda')),
    destino_id INTEGER NOT NULL,
    juguete_codigo VARCHAR(50) NOT NULL, -- Cambiado de juguete_id a juguete_codigo
    cantidad INTEGER NOT NULL DEFAULT 1,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    items JSONB NOT NULL,
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
    metodo_pago VARCHAR(50) NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: logs_deshacer_ventas
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

-- Agregar cliente_id y abono a ventas si no existen (para compatibilidad con instalaciones existentes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'cliente_id'
    ) THEN
        ALTER TABLE ventas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'abono'
    ) THEN
        ALTER TABLE ventas ADD COLUMN abono DECIMAL(10, 2) DEFAULT 0;
    END IF;
    
    -- Migración: Agregar juguete_codigo si no existe (para instalaciones antiguas)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'juguete_codigo'
    ) THEN
        ALTER TABLE ventas ADD COLUMN juguete_codigo VARCHAR(50);
        -- Migrar datos existentes si hay juguete_id
        UPDATE ventas v
        SET juguete_codigo = j.codigo
        FROM juguetes j
        WHERE v.juguete_id = j.id
        AND v.juguete_codigo IS NULL
        AND j.codigo IS NOT NULL;
    END IF;
    
    -- Migración: Agregar juguete_codigo a movimientos si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movimientos' AND column_name = 'juguete_codigo'
    ) THEN
        ALTER TABLE movimientos ADD COLUMN juguete_codigo VARCHAR(50);
        -- Migrar datos existentes si hay juguete_id
        UPDATE movimientos m
        SET juguete_codigo = j.codigo
        FROM juguetes j
        WHERE m.juguete_id = j.id
        AND m.juguete_codigo IS NULL
        AND j.codigo IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- 2. CREAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo_usuario_id ON usuarios(tipo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios(nombre);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_empresas_nombre ON empresas(nombre);
CREATE INDEX IF NOT EXISTS idx_bodegas_empresa_id ON bodegas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tiendas_empresa_id ON tiendas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_empresa_id ON empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_tienda_id ON empleados(tienda_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_bodega_id ON juguetes(bodega_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_tienda_id ON juguetes(tienda_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_codigo ON juguetes(codigo);
CREATE INDEX IF NOT EXISTS idx_juguetes_empresa_id ON juguetes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_precio_min ON juguetes(precio_min) WHERE precio_min IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_empresa_id ON ventas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ventas_juguete_codigo ON ventas(juguete_codigo);
CREATE INDEX IF NOT EXISTS idx_ventas_empleado_id ON ventas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_ventas_codigo_venta ON ventas(codigo_venta);
CREATE INDEX IF NOT EXISTS idx_ventas_facturada ON ventas(facturada, codigo_venta);
CREATE INDEX IF NOT EXISTS idx_facturas_empresa_id ON facturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_empresa_id ON movimientos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_juguete_codigo ON movimientos(juguete_codigo);
CREATE INDEX IF NOT EXISTS idx_planes_movimiento_empresa_id ON planes_movimiento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_planes_movimiento_estado ON planes_movimiento(estado);
CREATE INDEX IF NOT EXISTS idx_planes_movimiento_created_at ON planes_movimiento(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_correo ON clientes(correo);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_id ON pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_logs_deshacer_ventas_empresa_id ON logs_deshacer_ventas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_deshacer_ventas_codigo_venta ON logs_deshacer_ventas(codigo_venta);

-- ============================================
-- 3. INSERTAR TIPOS DE USUARIO
-- ============================================

-- Insertar tipos de usuario si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tipo_usuarios WHERE id = 1) THEN
INSERT INTO tipo_usuarios (id, nombre, descripcion) VALUES
            (1, 'Super Administrador', 'Acceso completo al sistema');
    ELSE
        UPDATE tipo_usuarios SET nombre = 'Super Administrador', descripcion = 'Acceso completo al sistema' WHERE id = 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM tipo_usuarios WHERE id = 2) THEN
        INSERT INTO tipo_usuarios (id, nombre, descripcion) VALUES
            (2, 'Administrador', 'Administrador de ToysWalls, puede gestionar usuarios y datos');
    ELSE
        UPDATE tipo_usuarios SET nombre = 'Administrador', descripcion = 'Administrador de ToysWalls, puede gestionar usuarios y datos' WHERE id = 2;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM tipo_usuarios WHERE id = 3) THEN
        INSERT INTO tipo_usuarios (id, nombre, descripcion) VALUES
            (3, 'Empleado', 'Usuario regular, puede ver y registrar datos según permisos');
    ELSE
        UPDATE tipo_usuarios SET nombre = 'Empleado', descripcion = 'Usuario regular, puede ver y registrar datos según permisos' WHERE id = 3;
    END IF;
END $$;

-- Ajustar secuencia
SELECT setval('tipo_usuarios_id_seq', 3, true);

-- ============================================
-- 4. INSERTAR EMPRESA TOYSWALLS
-- ============================================

-- Insertar empresa ToysWalls si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM empresas WHERE id = 1) THEN
        INSERT INTO empresas (id, nombre, descripcion, logo_url) VALUES
            (1, 'ToysWalls', 'Sistema de Inventario de Juguetes', 'https://i.imgur.com/RBbjVnp.jpeg');
    ELSE
        UPDATE empresas SET 
            nombre = 'ToysWalls', 
            descripcion = 'Sistema de Inventario de Juguetes', 
            logo_url = 'https://i.imgur.com/RBbjVnp.jpeg' 
        WHERE id = 1;
    END IF;
END $$;

-- Ajustar secuencia
SELECT setval('empresas_id_seq', 1, true);

-- ============================================
-- 5. INSERTAR USUARIOS DE EJEMPLO
-- ============================================

-- Insertar usuarios de ejemplo si no existen
DO $$
BEGIN
-- Super Administrador
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'superadmin@toyswalls.com') THEN
INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
            ('Super Admin', 'superadmin@toyswalls.com', 'admin123', 1, 1);
    END IF;

-- Administrador
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@toyswalls.com') THEN
INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
            ('Admin', 'admin@toyswalls.com', 'admin123', 1, 2);
    END IF;

    -- Empleado Juan Pérez
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'juan@toyswalls.com') THEN
INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
            ('Juan Pérez', 'juan@toyswalls.com', 'empleado123', 1, 3);
    END IF;
    
    -- Empleado María García
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'maria@toyswalls.com') THEN
        INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
            ('María García', 'maria@toyswalls.com', 'empleado123', 1, 3);
    END IF;
    
    -- Empleados especiales que pueden vender en cualquier parte
    -- Jose (usa toyswalls@gmail.com)
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'toyswalls@gmail.com') THEN
        INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
            ('Jose', 'toyswalls@gmail.com', 'empleado123', 1, 3);
    END IF;
    
    -- Sindy (usa email alternativo ya que el email debe ser único)
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'sindy.toyswalls@gmail.com') THEN
        INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
            ('Sindy', 'sindy.toyswalls@gmail.com', 'empleado123', 1, 3);
    END IF;
END $$;

-- ============================================
-- 5.1. INSERTAR EMPLEADOS DE EJEMPLO
-- ============================================

-- Insertar empleados de ejemplo si no existen
DO $$
BEGIN
    -- Empleado Jose (puede vender en cualquier parte - sin tienda asignada)
    IF NOT EXISTS (SELECT 1 FROM empleados WHERE codigo = 'EMP-JOSE' AND empresa_id = 1) THEN
        INSERT INTO empleados (nombre, telefono, codigo, documento, empresa_id, tienda_id) VALUES
            ('Jose', '3000000001', 'EMP-JOSE', '1234567890', 1, NULL);
    END IF;
    
    -- Empleado Sindy (puede vender en cualquier parte - sin tienda asignada)
    IF NOT EXISTS (SELECT 1 FROM empleados WHERE codigo = 'EMP-SINDY' AND empresa_id = 1) THEN
        INSERT INTO empleados (nombre, telefono, codigo, documento, empresa_id, tienda_id) VALUES
            ('Sindy', '3000000002', 'EMP-SINDY', '0987654321', 1, NULL);
    END IF;
END $$;

-- ============================================
-- 6. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tipo_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE juguetes ENABLE ROW LEVEL SECURITY;

-- Agregar columna cantidad a ventas si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'cantidad'
    ) THEN
        ALTER TABLE ventas ADD COLUMN cantidad INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para evitar conflictos)
DROP POLICY IF EXISTS "tipo_usuarios_select_policy" ON tipo_usuarios;
DROP POLICY IF EXISTS "empresas_select_policy" ON empresas;
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete_policy" ON usuarios;
DROP POLICY IF EXISTS "bodegas_select_policy" ON bodegas;
DROP POLICY IF EXISTS "bodegas_insert_policy" ON bodegas;
DROP POLICY IF EXISTS "bodegas_update_policy" ON bodegas;
DROP POLICY IF EXISTS "bodegas_delete_policy" ON bodegas;
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
DROP POLICY IF EXISTS "ventas_select_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_insert_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_update_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_delete_policy" ON ventas;
DROP POLICY IF EXISTS "facturas_select_policy" ON facturas;
DROP POLICY IF EXISTS "facturas_insert_policy" ON facturas;
DROP POLICY IF EXISTS "facturas_items_select_policy" ON facturas_items;
DROP POLICY IF EXISTS "facturas_items_insert_policy" ON facturas_items;
DROP POLICY IF EXISTS "movimientos_select_policy" ON movimientos;
DROP POLICY IF EXISTS "movimientos_insert_policy" ON movimientos;

-- Crear políticas RLS para tipo_usuarios
DROP POLICY IF EXISTS "tipo_usuarios_select_policy" ON tipo_usuarios;
CREATE POLICY "tipo_usuarios_select_policy"
    ON tipo_usuarios FOR SELECT
    USING (true);

-- Crear políticas RLS para empresas
DROP POLICY IF EXISTS "empresas_select_policy" ON empresas;
CREATE POLICY "empresas_select_policy"
    ON empresas FOR SELECT
    USING (true);

-- Crear políticas RLS para usuarios
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;
CREATE POLICY "usuarios_select_policy"
    ON usuarios FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "usuarios_insert_policy" ON usuarios;
CREATE POLICY "usuarios_insert_policy"
    ON usuarios FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;
CREATE POLICY "usuarios_update_policy"
    ON usuarios FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios_delete_policy" ON usuarios;
CREATE POLICY "usuarios_delete_policy"
    ON usuarios FOR DELETE
    USING (true);

-- Crear políticas RLS para bodegas
DROP POLICY IF EXISTS "bodegas_select_policy" ON bodegas;
CREATE POLICY "bodegas_select_policy"
    ON bodegas FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "bodegas_insert_policy" ON bodegas;
CREATE POLICY "bodegas_insert_policy"
    ON bodegas FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "bodegas_update_policy" ON bodegas;
CREATE POLICY "bodegas_update_policy"
    ON bodegas FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "bodegas_delete_policy" ON bodegas;
CREATE POLICY "bodegas_delete_policy"
    ON bodegas FOR DELETE
    USING (true);

-- Crear políticas RLS para tiendas
DROP POLICY IF EXISTS "tiendas_select_policy" ON tiendas;
CREATE POLICY "tiendas_select_policy"
    ON tiendas FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "tiendas_insert_policy" ON tiendas;
CREATE POLICY "tiendas_insert_policy"
    ON tiendas FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "tiendas_update_policy" ON tiendas;
CREATE POLICY "tiendas_update_policy"
    ON tiendas FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tiendas_delete_policy" ON tiendas;
CREATE POLICY "tiendas_delete_policy"
    ON tiendas FOR DELETE
    USING (true);

-- Crear políticas RLS para empleados
DROP POLICY IF EXISTS "empleados_select_policy" ON empleados;
CREATE POLICY "empleados_select_policy"
    ON empleados FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "empleados_insert_policy" ON empleados;
CREATE POLICY "empleados_insert_policy"
    ON empleados FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "empleados_update_policy" ON empleados;
CREATE POLICY "empleados_update_policy"
    ON empleados FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "empleados_delete_policy" ON empleados;
CREATE POLICY "empleados_delete_policy"
    ON empleados FOR DELETE
    USING (true);

-- Crear políticas RLS para juguetes
DROP POLICY IF EXISTS "juguetes_select_policy" ON juguetes;
CREATE POLICY "juguetes_select_policy"
    ON juguetes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "juguetes_insert_policy" ON juguetes;
CREATE POLICY "juguetes_insert_policy"
    ON juguetes FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "juguetes_update_policy" ON juguetes;
CREATE POLICY "juguetes_update_policy"
    ON juguetes FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "juguetes_delete_policy" ON juguetes;
CREATE POLICY "juguetes_delete_policy"
    ON juguetes FOR DELETE
    USING (true);

-- Crear políticas RLS para ventas
DROP POLICY IF EXISTS "ventas_select_policy" ON ventas;
CREATE POLICY "ventas_select_policy"
    ON ventas FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "ventas_insert_policy" ON ventas;
CREATE POLICY "ventas_insert_policy"
    ON ventas FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "ventas_update_policy" ON ventas;
CREATE POLICY "ventas_update_policy"
    ON ventas FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "ventas_delete_policy" ON ventas;
CREATE POLICY "ventas_delete_policy"
    ON ventas FOR DELETE
    USING (true);

-- Crear políticas RLS para facturas
DROP POLICY IF EXISTS "facturas_select_policy" ON facturas;
CREATE POLICY "facturas_select_policy"
    ON facturas FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "facturas_insert_policy" ON facturas;
CREATE POLICY "facturas_insert_policy"
    ON facturas FOR INSERT
    WITH CHECK (true);

-- Crear políticas RLS para facturas_items
DROP POLICY IF EXISTS "facturas_items_select_policy" ON facturas_items;
CREATE POLICY "facturas_items_select_policy"
    ON facturas_items FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "facturas_items_insert_policy" ON facturas_items;
CREATE POLICY "facturas_items_insert_policy"
    ON facturas_items FOR INSERT
    WITH CHECK (true);

-- Crear políticas RLS para movimientos
DROP POLICY IF EXISTS "movimientos_select_policy" ON movimientos;
CREATE POLICY "movimientos_select_policy"
    ON movimientos FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "movimientos_insert_policy" ON movimientos;
CREATE POLICY "movimientos_insert_policy"
    ON movimientos FOR INSERT
    WITH CHECK (true);

-- Crear políticas RLS para planes_movimiento
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

-- Habilitar RLS para logs_deshacer_ventas
ALTER TABLE logs_deshacer_ventas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para logs_deshacer_ventas
DROP POLICY IF EXISTS "logs_deshacer_ventas_select" ON logs_deshacer_ventas;
CREATE POLICY "logs_deshacer_ventas_select"
    ON logs_deshacer_ventas FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "logs_deshacer_ventas_insert" ON logs_deshacer_ventas;
CREATE POLICY "logs_deshacer_ventas_insert"
    ON logs_deshacer_ventas FOR INSERT
    WITH CHECK (true);

-- ============================================
-- 7. FUNCIONES AUXILIARES
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. CREAR TRIGGERS
-- ============================================

-- Trigger para tipo_usuarios
DROP TRIGGER IF EXISTS update_tipo_usuarios_updated_at ON tipo_usuarios;
CREATE TRIGGER update_tipo_usuarios_updated_at
    BEFORE UPDATE ON tipo_usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para empresas
DROP TRIGGER IF EXISTS update_empresas_updated_at ON empresas;
CREATE TRIGGER update_empresas_updated_at
    BEFORE UPDATE ON empresas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para usuarios
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para bodegas
DROP TRIGGER IF EXISTS update_bodegas_updated_at ON bodegas;
CREATE TRIGGER update_bodegas_updated_at
    BEFORE UPDATE ON bodegas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para tiendas
DROP TRIGGER IF EXISTS update_tiendas_updated_at ON tiendas;
CREATE TRIGGER update_tiendas_updated_at
    BEFORE UPDATE ON tiendas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para empleados
DROP TRIGGER IF EXISTS update_empleados_updated_at ON empleados;
CREATE TRIGGER update_empleados_updated_at
    BEFORE UPDATE ON empleados
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para juguetes
DROP TRIGGER IF EXISTS update_juguetes_updated_at ON juguetes;
CREATE TRIGGER update_juguetes_updated_at
    BEFORE UPDATE ON juguetes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. LIMPIEZA DE DUPLICADOS (OPCIONAL)
-- ============================================
-- Esta sección consolida juguetes duplicados (mismo código, nombre y ubicación)
-- Ejecuta solo si necesitas limpiar duplicados existentes

-- Paso 1: Crear tabla temporal con juguetes consolidados
DO $$
DECLARE
    duplicados_existen BOOLEAN;
BEGIN
    -- Verificar si hay duplicados
    SELECT EXISTS (
        SELECT 1
        FROM juguetes
        GROUP BY empresa_id, codigo, nombre, bodega_id, tienda_id
        HAVING COUNT(*) > 1
    ) INTO duplicados_existen;
    
    IF duplicados_existen THEN
        -- Crear tabla temporal con juguetes consolidados
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

        -- Actualizar el registro principal con la cantidad total
        UPDATE juguetes j
        SET 
            cantidad = jc.cantidad_total,
            updated_at = jc.updated_at_latest
        FROM juguetes_consolidados jc
        WHERE j.id = jc.id_principal
          AND j.empresa_id = jc.empresa_id
          AND j.codigo = jc.codigo
          AND j.nombre = jc.nombre
          AND COALESCE(j.bodega_id, 0) = COALESCE(jc.bodega_id, 0)
          AND COALESCE(j.tienda_id, 0) = COALESCE(jc.tienda_id, 0);

        -- Eliminar los registros duplicados (mantener solo el principal)
        DELETE FROM juguetes
        WHERE id IN (
            SELECT j.id
            FROM juguetes j
            INNER JOIN juguetes_consolidados jc ON
                j.empresa_id = jc.empresa_id
                AND j.codigo = jc.codigo
                AND j.nombre = jc.nombre
                AND COALESCE(j.bodega_id, 0) = COALESCE(jc.bodega_id, 0)
                AND COALESCE(j.tienda_id, 0) = COALESCE(jc.tienda_id, 0)
            WHERE j.id != jc.id_principal
        );

        -- Limpiar tabla temporal
        DROP TABLE IF EXISTS juguetes_consolidados;
        
        RAISE NOTICE 'Duplicados de juguetes consolidados exitosamente.';
    ELSE
        RAISE NOTICE 'No se encontraron duplicados de juguetes.';
    END IF;
END $$;

-- ============================================
-- 10. VERIFICACIÓN DE DATOS
-- ============================================

-- Ver tipos de usuario creados
SELECT 'Tipos de Usuario:' as info;
SELECT * FROM tipo_usuarios ORDER BY id;

-- Ver empresa creada
SELECT 'Empresa:' as info;
SELECT * FROM empresas ORDER BY id;

-- Ver usuarios creados (sin mostrar contraseñas)
SELECT 'Usuarios:' as info;
SELECT 
    u.id,
    u.nombre,
    u.email,
    e.nombre as empresa_nombre,
    tu.nombre as tipo_usuario_nombre,
    u.activo,
    u.created_at
FROM usuarios u
JOIN empresas e ON u.empresa_id = e.id
JOIN tipo_usuarios tu ON u.tipo_usuario_id = tu.id
ORDER BY u.nombre;

-- Ver empleados creados
SELECT 'Empleados:' as info;
SELECT 
    e.id,
    e.nombre,
    e.codigo,
    e.telefono,
    e.documento,
    t.nombre as tienda_nombre,
    emp.nombre as empresa_nombre
FROM empleados e
JOIN empresas emp ON e.empresa_id = emp.id
LEFT JOIN tiendas t ON e.tienda_id = t.id
ORDER BY e.nombre;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- 
-- USUARIOS DE EJEMPLO CREADOS:
-- 
-- Super Administrador:
--   Email: "superadmin@toyswalls.com"
--   Contraseña: "admin123"
-- 
-- Administrador:
--   Email: "admin@toyswalls.com"
--   Contraseña: "admin123"
-- 
-- Empleados:
--   Email: "juan@toyswalls.com" o "maria@toyswalls.com"
--   Contraseña: "empleado123"
-- 
-- Empleados Especiales (pueden vender en cualquier parte):
--   Jose: Email "toyswalls@gmail.com", Contraseña: "empleado123"
--   Sindy: Email "sindy.toyswalls@gmail.com", Contraseña: "empleado123"
-- 
-- Empresa: "ToysWalls"
-- Logo: https://i.imgur.com/RBbjVnp.jpeg
-- 
-- NOTAS IMPORTANTES:
-- - Todos los usuarios pertenecen a ToysWalls
-- - El login ahora usa email en lugar de selección de empresa
-- - Las categorías han sido eliminadas
-- - Los juguetes ahora tienen un campo foto_url opcional
-- - El código de juguete debe ser único por nombre (no puede haber mismo código con diferente nombre)
-- - Los juguetes con mismo código y nombre en la misma ubicación se consolidan sumando cantidades
-- - La columna "ubicacion" en tiendas se renombra automáticamente a "direccion" si existe
-- - Los duplicados de juguetes se consolidan automáticamente al ejecutar este script
-- 
-- MIGRACIONES INCLUIDAS:
-- ✅ item y precio_por_mayor en juguetes (agregar_precio_por_mayor_e_item.sql)
-- ✅ es_por_mayor en ventas (agregar_es_por_mayor.sql)
-- ✅ facturada en ventas (agregar_campo_facturada.sql)
-- ✅ tabla planes_movimiento (crear_tabla_planes_movimiento.sql)
-- ✅ precio_min en juguetes (agregar_precios_juguetes.sql - solo precio_min, sin precio_max)
-- ✅ Políticas RLS corregidas para ventas, usuarios y relaciones (fix_ventas_rls_policies.sql, fix_ventas_relations_rls.sql, fix_usuarios_rls.sql)
-- ✅ Foreign keys con ON DELETE CASCADE (fix_foreign_keys_delete.sql)
-- ✅ Cambio de juguete_id a juguete_codigo en ventas y movimientos (cambiar_juguete_id_a_codigo.sql)
-- ✅ Tabla clientes y pagos (crear_tabla_clientes.sql)
-- ✅ Tabla logs_deshacer_ventas (crear_tabla_logs_deshacer_ventas.sql)
-- 
-- ============================================
