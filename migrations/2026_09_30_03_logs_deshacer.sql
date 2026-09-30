-- =====================================================================
-- 2026_09_30_03_logs_deshacer.sql
-- Corrige logs_deshacer_ventas:
--   * usuario_id era INTEGER pero los usuarios usan UUID (todo insert fallaba con 22P02).
--   * Agrega motivo (deshacer / devolucion), venta, ubicación y nombre de quien lo hizo.
-- La tabla está vacía en producción; si tuviera ids enteros antiguos se ponen en NULL
-- (no hay forma de convertir un entero a UUID).
-- Idempotente.
-- =====================================================================
BEGIN;

DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'logs_deshacer_ventas' AND column_name = 'usuario_id') = 'integer' THEN
        ALTER TABLE public.logs_deshacer_ventas ALTER COLUMN usuario_id TYPE uuid USING NULL;
    END IF;
END $$;

ALTER TABLE public.logs_deshacer_ventas ADD COLUMN IF NOT EXISTS motivo varchar(20) NOT NULL DEFAULT 'deshacer';
ALTER TABLE public.logs_deshacer_ventas ADD COLUMN IF NOT EXISTS usuario_nombre varchar(100);
ALTER TABLE public.logs_deshacer_ventas ADD COLUMN IF NOT EXISTS venta_id integer;
ALTER TABLE public.logs_deshacer_ventas ADD COLUMN IF NOT EXISTS juguete_id integer;
ALTER TABLE public.logs_deshacer_ventas ADD COLUMN IF NOT EXISTS tienda_id integer;
ALTER TABLE public.logs_deshacer_ventas ADD COLUMN IF NOT EXISTS bodega_id integer;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_deshacer_ventas_motivo_check') THEN
        ALTER TABLE public.logs_deshacer_ventas
            ADD CONSTRAINT logs_deshacer_ventas_motivo_check CHECK (motivo IN ('deshacer', 'devolucion'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_logs_deshacer_ventas_creado_en ON public.logs_deshacer_ventas(creado_en DESC);

COMMIT;

-- VERIFICACIÓN: usuario_id debe ser uuid y deben existir las columnas nuevas
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'logs_deshacer_ventas'
   AND column_name IN ('usuario_id', 'motivo', 'usuario_nombre', 'venta_id', 'juguete_id', 'tienda_id', 'bodega_id')
 ORDER BY column_name;
