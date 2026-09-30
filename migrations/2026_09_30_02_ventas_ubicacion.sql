-- =====================================================================
-- 2026_09_30_02_ventas_ubicacion.sql
-- Cada venta guarda de qué registro/ubicación salió el stock y quién la registró,
-- para que deshacer y devoluciones repongan exactamente en esa ubicación.
-- Las ventas anteriores quedan con estos campos en NULL (se reponen como antes).
-- Idempotente. No modifica datos existentes.
-- =====================================================================
BEGIN;

ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS juguete_id integer REFERENCES public.juguetes(id) ON DELETE SET NULL;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS tienda_id  integer REFERENCES public.tiendas(id)  ON DELETE SET NULL;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS bodega_id  integer REFERENCES public.bodegas(id)  ON DELETE SET NULL;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS usuario_id uuid    REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_juguete_id ON public.ventas(juguete_id);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario_id ON public.ventas(usuario_id);

COMMENT ON COLUMN public.ventas.juguete_id IS 'Registro de juguetes (fila por ubicación) del que se descontó el stock';
COMMENT ON COLUMN public.ventas.tienda_id  IS 'Tienda de la que salió el stock (NULL si salió de bodega o es una venta antigua)';
COMMENT ON COLUMN public.ventas.bodega_id  IS 'Bodega de la que salió el stock (NULL si salió de tienda o es una venta antigua)';
COMMENT ON COLUMN public.ventas.usuario_id IS 'Usuario (usuarios.id) que registró la venta';

COMMIT;

-- VERIFICACIÓN: deben aparecer las 4 columnas
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'ventas'
   AND column_name IN ('juguete_id', 'tienda_id', 'bodega_id', 'usuario_id')
 ORDER BY column_name;
