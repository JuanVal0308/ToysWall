-- ============================================
-- CONFIGURACIÓN COMPLETA DE BASE DE DATOS
-- Toys Walls - Sistema de Inventario Empresarial
-- ============================================
-- INSTRUCCIONES:
-- 1. Copia TODO este archivo
-- 2. Pégalo en el SQL Editor de Supabase
-- 3. Ejecuta el script (Run o Ctrl+Enter)
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

-- ============================================
-- 2. CREAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo_usuario_id ON usuarios(tipo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios(nombre);
CREATE INDEX IF NOT EXISTS idx_empresas_nombre ON empresas(nombre);

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

-- Habilitar RLS
ALTER TABLE tipo_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Todos pueden ver tipos de usuario" ON tipo_usuarios;
DROP POLICY IF EXISTS "Usuarios pueden ver empresas" ON empresas;
DROP POLICY IF EXISTS "Usuarios pueden ver usuarios de su empresa" ON usuarios;
DROP POLICY IF EXISTS "tipo_usuarios_select_policy" ON tipo_usuarios;
DROP POLICY IF EXISTS "empresas_select_policy" ON empresas;
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;

-- Crear políticas RLS simples (sin recursión)
CREATE POLICY "tipo_usuarios_select_policy"
    ON tipo_usuarios FOR SELECT
    USING (true);

CREATE POLICY "empresas_select_policy"
    ON empresas FOR SELECT
    USING (true);

CREATE POLICY "usuarios_select_policy"
    ON usuarios FOR SELECT
    USING (true);

-- Política para permitir que los usuarios actualicen sus propios datos
CREATE POLICY "usuarios_update_policy"
    ON usuarios FOR UPDATE
    USING (true)
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

