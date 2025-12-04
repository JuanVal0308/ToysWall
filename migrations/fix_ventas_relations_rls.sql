-- ============================================
-- MIGRACIÓN: Corregir políticas RLS para relaciones de ventas
-- ============================================
-- Este script asegura que las consultas con relaciones desde ventas funcionen correctamente
-- Ejecutar este script en Supabase SQL Editor

-- 1. Asegurar que RLS esté habilitado en todas las tablas relacionadas
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE juguetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar todas las políticas existentes para recrearlas
DROP POLICY IF EXISTS "ventas_select_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_insert_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_update_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_delete_policy" ON ventas;

DROP POLICY IF EXISTS "juguetes_select_policy" ON juguetes;
DROP POLICY IF EXISTS "empleados_select_policy" ON empleados;

-- 3. Recrear políticas de SELECT para ventas (sin restricciones para permitir relaciones)
CREATE POLICY "ventas_select_policy"
    ON ventas FOR SELECT
    USING (true);

CREATE POLICY "ventas_insert_policy"
    ON ventas FOR INSERT
    WITH CHECK (true);

CREATE POLICY "ventas_update_policy"
    ON ventas FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "ventas_delete_policy"
    ON ventas FOR DELETE
    USING (true);

-- 4. Recrear políticas de SELECT para juguetes (necesario para relaciones)
CREATE POLICY "juguetes_select_policy"
    ON juguetes FOR SELECT
    USING (true);

-- 5. Recrear políticas de SELECT para empleados (necesario para relaciones)
CREATE POLICY "empleados_select_policy"
    ON empleados FOR SELECT
    USING (true);

-- 6. Verificar que las foreign keys existan
DO $$
BEGIN
    -- Verificar foreign key ventas -> juguetes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_juguete_id_fkey'
    ) THEN
        ALTER TABLE ventas 
        ADD CONSTRAINT ventas_juguete_id_fkey 
        FOREIGN KEY (juguete_id) REFERENCES juguetes(id) ON DELETE CASCADE;
    END IF;

    -- Verificar foreign key ventas -> empleados
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_empleado_id_fkey'
    ) THEN
        ALTER TABLE ventas 
        ADD CONSTRAINT ventas_empleado_id_fkey 
        FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Nota importante:
-- Después de ejecutar este script:
-- 1. Espera 1-2 minutos para que Supabase actualice el schema cache
-- 2. Recarga la aplicación (Ctrl+F5 para forzar recarga)
-- 3. Si el error persiste, verifica en Supabase Dashboard > Settings > API
--    que las políticas RLS estén activas










