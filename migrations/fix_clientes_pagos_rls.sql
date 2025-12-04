-- ============================================
-- FIX: Políticas RLS para clientes y pagos
-- ============================================
-- Este script corrige las políticas RLS de las tablas
-- clientes y pagos para que funcionen con autenticación personalizada
-- ============================================
-- INSTRUCCIONES:
-- 1. Copia TODO este archivo
-- 2. Pégalo en el SQL Editor de Supabase
-- 3. Ejecuta el script (Run o Ctrl+Enter)
-- ============================================

-- Políticas RLS para clientes
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
CREATE POLICY "clientes_select_policy" ON clientes
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "clientes_insert_policy" ON clientes;
CREATE POLICY "clientes_insert_policy" ON clientes
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "clientes_update_policy" ON clientes;
CREATE POLICY "clientes_update_policy" ON clientes
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "clientes_delete_policy" ON clientes;
CREATE POLICY "clientes_delete_policy" ON clientes
    FOR DELETE
    USING (true);

-- Políticas RLS para pagos
DROP POLICY IF EXISTS "pagos_select_policy" ON pagos;
CREATE POLICY "pagos_select_policy" ON pagos
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "pagos_insert_policy" ON pagos;
CREATE POLICY "pagos_insert_policy" ON pagos
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "pagos_update_policy" ON pagos;
CREATE POLICY "pagos_update_policy" ON pagos
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "pagos_delete_policy" ON pagos;
CREATE POLICY "pagos_delete_policy" ON pagos
    FOR DELETE
    USING (true);

-- ============================================
-- ✅ Migración completada
-- ============================================
-- Las políticas RLS de clientes y pagos han sido
-- actualizadas para funcionar con autenticación personalizada.
-- ============================================

