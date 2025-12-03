-- ============================================
-- MIGRACIÓN: Corregir políticas RLS para ventas
-- ============================================
-- Este script corrige el error 400 al hacer SELECT con relaciones
-- desde la tabla ventas hacia juguetes y empleados

-- Asegurar que RLS esté habilitado
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE juguetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes de ventas
DROP POLICY IF EXISTS "ventas_select_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_insert_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_update_policy" ON ventas;
DROP POLICY IF EXISTS "ventas_delete_policy" ON ventas;

-- Recrear políticas para ventas
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

-- Asegurar que las políticas de juguetes y empleados permitan SELECT
-- (necesario para las relaciones en las consultas)
DROP POLICY IF EXISTS "juguetes_select_policy" ON juguetes;
CREATE POLICY "juguetes_select_policy"
    ON juguetes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "empleados_select_policy" ON empleados;
CREATE POLICY "empleados_select_policy"
    ON empleados FOR SELECT
    USING (true);

-- Nota: Después de ejecutar este script, puede ser necesario
-- refrescar el schema cache de Supabase. Esto se hace automáticamente
-- pero puede tardar unos minutos. Si el error persiste, espera 2-3 minutos
-- y recarga la aplicación.










