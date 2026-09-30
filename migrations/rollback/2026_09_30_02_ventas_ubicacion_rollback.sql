-- Rollback de 2026_09_30_02_ventas_ubicacion.sql
-- Ejecutar antes el rollback de 04 (las RPC usan estas columnas). Se pierde la ubicación guardada en las ventas.
BEGIN;
DROP INDEX IF EXISTS public.idx_ventas_juguete_id;
DROP INDEX IF EXISTS public.idx_ventas_usuario_id;
ALTER TABLE public.ventas DROP COLUMN IF EXISTS juguete_id;
ALTER TABLE public.ventas DROP COLUMN IF EXISTS tienda_id;
ALTER TABLE public.ventas DROP COLUMN IF EXISTS bodega_id;
ALTER TABLE public.ventas DROP COLUMN IF EXISTS usuario_id;
COMMIT;

-- VERIFICACIÓN: 0 filas
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'ventas' AND column_name IN ('juguete_id', 'tienda_id', 'bodega_id', 'usuario_id');
