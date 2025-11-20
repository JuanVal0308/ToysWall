-- ============================================
-- CONFIGURACIÓN COMPLETA DE BASE DE DATOS
-- Toys Walls - Sistema de Inventario Empresarial
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
    ubicacion TEXT NOT NULL,
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
    ubicacion TEXT NOT NULL,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: juguetes (actualizada para soportar bodegas y tiendas)
-- Primero verificar si la tabla existe y actualizarla si es necesario
DO $$ 
BEGIN
    -- Si la tabla no existe, crearla
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'juguetes') THEN
        CREATE TABLE juguetes (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            codigo VARCHAR(50) NOT NULL,
            categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
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
        -- Si la tabla existe, agregar columnas faltantes
        -- Agregar empresa_id si no existe
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'juguetes' AND column_name = 'empresa_id') THEN
            ALTER TABLE juguetes ADD COLUMN empresa_id INTEGER;
            -- Actualizar empresa_id desde bodegas relacionadas
            UPDATE juguetes j
            SET empresa_id = b.empresa_id
            FROM bodegas b
            WHERE j.bodega_id = b.id;
            -- Hacer NOT NULL después de actualizar
            ALTER TABLE juguetes ALTER COLUMN empresa_id SET NOT NULL;
            ALTER TABLE juguetes ADD CONSTRAINT juguetes_empresa_id_fkey 
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
        END IF;

        -- Agregar categoria_id si no existe
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'juguetes' AND column_name = 'categoria_id') THEN
            -- Crear categoría "General" si no existe
            INSERT INTO categorias (nombre, empresa_id)
            SELECT DISTINCT 'General', empresa_id
            FROM empresas
            WHERE NOT EXISTS (
                SELECT 1 FROM categorias 
                WHERE nombre = 'General' AND empresa_id = empresas.id
            )
            ON CONFLICT DO NOTHING;
            
            ALTER TABLE juguetes ADD COLUMN categoria_id INTEGER;
            -- Asignar categoría "General" a juguetes existentes
            UPDATE juguetes j
            SET categoria_id = c.id
            FROM categorias c
            WHERE c.nombre = 'General' 
            AND c.empresa_id = j.empresa_id;
            -- Hacer NOT NULL después de actualizar
            ALTER TABLE juguetes ALTER COLUMN categoria_id SET NOT NULL;
            ALTER TABLE juguetes ADD CONSTRAINT juguetes_categoria_id_fkey 
                FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT;
        END IF;

        -- Agregar tienda_id si no existe
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'juguetes' AND column_name = 'tienda_id') THEN
            ALTER TABLE juguetes ADD COLUMN tienda_id INTEGER 
                REFERENCES tiendas(id) ON DELETE SET NULL;
        END IF;

        -- Eliminar columna categoria (VARCHAR) si existe
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'juguetes' AND column_name = 'categoria' 
                   AND data_type = 'character varying') THEN
            ALTER TABLE juguetes DROP COLUMN categoria;
        END IF;

        -- Agregar constraint CHECK si no existe
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'check_ubicacion' 
            AND conrelid = 'juguetes'::regclass
        ) THEN
            ALTER TABLE juguetes ADD CONSTRAINT check_ubicacion CHECK (
                (bodega_id IS NOT NULL AND tienda_id IS NULL) OR 
                (bodega_id IS NULL AND tienda_id IS NOT NULL)
            );
        END IF;
    END IF;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_juguetes_bodega_id ON juguetes(bodega_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_tienda_id ON juguetes(tienda_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_categoria_id ON juguetes(categoria_id);
CREATE INDEX IF NOT EXISTS idx_juguetes_codigo ON juguetes(codigo);
CREATE INDEX IF NOT EXISTS idx_juguetes_empresa_id ON juguetes(empresa_id);

-- ============================================
-- 3. INSERTAR TIPOS DE USUARIO
-- ============================================

INSERT INTO tipo_usuarios (id, nombre, descripcion) VALUES
    (1, 'Super Administrador', 'Acceso completo al sistema, puede gestionar todas las empresas'),
    (2, 'Administrador', 'Administrador de su empresa, puede gestionar usuarios y datos de su empresa'),
    (3, 'Empleado', 'Usuario regular, puede ver y registrar datos según permisos')
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

-- Ajustar secuencia
SELECT setval('tipo_usuarios_id_seq', 3, true);

-- ============================================
-- 4. INSERTAR EMPRESA DE EJEMPLO
-- ============================================

INSERT INTO empresas (id, nombre, descripcion) VALUES
    (1, 'Toys Walls', 'Empresa principal de juguetes')
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

-- Ajustar secuencia
SELECT setval('empresas_id_seq', 1, true);

-- ============================================
-- 5. INSERTAR USUARIOS DE EJEMPLO
-- ============================================

-- Super Administrador
INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
    ('Super Admin', 'superadmin@toyswalls.com', 'admin123', 1, 1)
ON CONFLICT DO NOTHING;

-- Administrador
INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
    ('Admin', 'admin@toyswalls.com', 'admin123', 1, 2)
ON CONFLICT DO NOTHING;

-- Empleados
INSERT INTO usuarios (nombre, email, password, empresa_id, tipo_usuario_id) VALUES
    ('Juan Pérez', 'juan@toyswalls.com', 'empleado123', 1, 3),
    ('María García', 'maria@toyswalls.com', 'empleado123', 1, 3)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. CONFIGURAR ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tipo_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE juguetes ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para evitar conflictos)
DROP POLICY IF EXISTS "tipo_usuarios_select_policy" ON tipo_usuarios;
DROP POLICY IF EXISTS "empresas_select_policy" ON empresas;
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;
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

-- Crear políticas RLS para tipo_usuarios
CREATE POLICY "tipo_usuarios_select_policy"
    ON tipo_usuarios FOR SELECT
    USING (true);

-- Crear políticas RLS para empresas
CREATE POLICY "empresas_select_policy"
    ON empresas FOR SELECT
    USING (true);

-- Crear políticas RLS para usuarios
CREATE POLICY "usuarios_select_policy"
    ON usuarios FOR SELECT
    USING (true);

CREATE POLICY "usuarios_update_policy"
    ON usuarios FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Crear políticas RLS para bodegas
CREATE POLICY "bodegas_select_policy"
    ON bodegas FOR SELECT
    USING (true);

CREATE POLICY "bodegas_insert_policy"
    ON bodegas FOR INSERT
    WITH CHECK (true);

CREATE POLICY "bodegas_update_policy"
    ON bodegas FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "bodegas_delete_policy"
    ON bodegas FOR DELETE
    USING (true);

-- Crear políticas RLS para categorias
CREATE POLICY "categorias_select_policy"
    ON categorias FOR SELECT
    USING (true);

CREATE POLICY "categorias_insert_policy"
    ON categorias FOR INSERT
    WITH CHECK (true);

CREATE POLICY "categorias_update_policy"
    ON categorias FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "categorias_delete_policy"
    ON categorias FOR DELETE
    USING (true);

-- Crear políticas RLS para tiendas
CREATE POLICY "tiendas_select_policy"
    ON tiendas FOR SELECT
    USING (true);

CREATE POLICY "tiendas_insert_policy"
    ON tiendas FOR INSERT
    WITH CHECK (true);

CREATE POLICY "tiendas_update_policy"
    ON tiendas FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "tiendas_delete_policy"
    ON tiendas FOR DELETE
    USING (true);

-- Crear políticas RLS para empleados
CREATE POLICY "empleados_select_policy"
    ON empleados FOR SELECT
    USING (true);

CREATE POLICY "empleados_insert_policy"
    ON empleados FOR INSERT
    WITH CHECK (true);

CREATE POLICY "empleados_update_policy"
    ON empleados FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "empleados_delete_policy"
    ON empleados FOR DELETE
    USING (true);

-- Crear políticas RLS para juguetes
CREATE POLICY "juguetes_select_policy"
    ON juguetes FOR SELECT
    USING (true);

CREATE POLICY "juguetes_insert_policy"
    ON juguetes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "juguetes_update_policy"
    ON juguetes FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "juguetes_delete_policy"
    ON juguetes FOR DELETE
    USING (true);

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

-- Función para obtener empresa_id del usuario actual (para uso futuro)
CREATE OR REPLACE FUNCTION current_empresa()
RETURNS INTEGER AS $$
    SELECT empresa_id FROM usuarios 
    WHERE id = (SELECT id FROM usuarios WHERE nombre = current_setting('app.current_user_name', true)::text LIMIT 1)
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Función para obtener tipo_usuario_id del usuario actual (para uso futuro)
CREATE OR REPLACE FUNCTION current_tipo_usuario()
RETURNS INTEGER AS $$
    SELECT tipo_usuario_id FROM usuarios 
    WHERE id = (SELECT id FROM usuarios WHERE nombre = current_setting('app.current_user_name', true)::text LIMIT 1)
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

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

-- Trigger para categorias
DROP TRIGGER IF EXISTS update_categorias_updated_at ON categorias;
CREATE TRIGGER update_categorias_updated_at
    BEFORE UPDATE ON categorias
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
-- 9. VERIFICACIÓN DE DATOS
-- ============================================

-- Ver tipos de usuario creados
SELECT 'Tipos de Usuario:' as info;
SELECT * FROM tipo_usuarios ORDER BY id;

-- Ver empresas creadas
SELECT 'Empresas:' as info;
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

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- 
-- USUARIOS DE EJEMPLO CREADOS:
-- 
-- Super Administrador:
--   Nombre: "Super Admin"
--   Contraseña: "admin123"
-- 
-- Administrador:
--   Nombre: "Admin"
--   Contraseña: "admin123"
-- 
-- Empleados:
--   Nombre: "Juan Pérez" o "María García"
--   Contraseña: "empleado123"
-- 
-- Empresa: "Toys Walls"
-- 
-- ============================================

