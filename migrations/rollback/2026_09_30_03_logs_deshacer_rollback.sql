-- Rollback de 2026_09_30_03_logs_deshacer.sql
-- Ejecutar antes el rollback de 04. usuario_id vuelve a INTEGER (los UUID guardados se pierden: quedan NULL).
BEGIN;
ALTER TABLE public.logs_deshacer_ventas DROP CONSTRAINT IF EXISTS logs_deshacer_ventas_motivo_check;
DROP INDEX IF EXISTS public.idx_logs_deshacer_ventas_creado_en;
ALTER TABLE public.logs_deshacer_ventas DROP COLUMN IF EXISTS motivo;
ALTER TABLE public.logs_deshacer_ventas DROP COLUMN IF EXISTS usuario_nombre;
ALTER TABLE public.logs_deshacer_ventas DROP COLUMN IF EXISTS venta_id;
ALTER TABLE public.logs_deshacer_ventas DROP COLUMN IF EXISTS juguete_id;
ALTER TABLE public.logs_deshacer_ventas DROP COLUMN IF EXISTS tienda_id;
ALTER TABLE public.logs_deshacer_ventas DROP COLUMN IF EXISTS bodega_id;
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'logs_deshacer_ventas' AND column_name = 'usuario_id') = 'uuid' THEN
        ALTER TABLE public.logs_deshacer_ventas ALTER COLUMN usuario_id TYPE integer USING NULL;
    END IF;
END $$;
COMMIT;

-- VERIFICACIÓN: usuario_id integer y sin columnas nuevas
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'logs_deshacer_ventas' ORDER BY ordinal_position;
