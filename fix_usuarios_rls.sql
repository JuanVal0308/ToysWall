-- ============================================
-- Script para corregir políticas RLS de usuarios
-- ============================================
-- Este script agrega las políticas faltantes para INSERT y DELETE en la tabla usuarios

-- Eliminar políticas existentes si existen (para evitar conflictos)
DROP POLICY IF EXISTS "usuarios_insert_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete_policy" ON usuarios;

-- Crear política RLS para INSERT en usuarios
CREATE POLICY "usuarios_insert_policy"
    ON usuarios FOR INSERT
    WITH CHECK (true);

-- Crear política RLS para DELETE en usuarios
CREATE POLICY "usuarios_delete_policy"
    ON usuarios FOR DELETE
    USING (true);

-- Verificar que las políticas se crearon correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'usuarios'
ORDER BY policyname;

