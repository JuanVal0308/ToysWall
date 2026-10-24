-- =====================================================================
-- CORRECCIÓN OPCIONAL — SOLO si confirmas que el físico debe ser General 47
-- para el código 43 (SG-29077) y que las 200 de VENT-20261019-001 NO se
-- reflejan en bodega. Por el diagnóstico, esas 200 YA se descontaron;
-- correr esto BAJARÍA de más el inventario.
--
-- Antes: respaldo completo + correr el SQL de verificación.
-- Ubicación de Jose / de la venta: bodega_id = 1 (Santa Isabel), juguete_id 1340 y 919.
-- =====================================================================
BEGIN;

-- Código 43: dejar la bodega en 38 (= 238 actuales - 200) → General 47
-- UPDATE public.juguetes
--    SET cantidad = cantidad - 200
--  WHERE id = 1340
--    AND bodega_id = 1
--    AND codigo = '43'
--    AND cantidad >= 200;

-- Código 22: SOLO si confirmas que 109 aún incluye las 200 (poco probable:
--   su updated_at coincide con la venta). Si igual quisieras forzar:
-- UPDATE public.juguetes
--    SET cantidad = GREATEST(cantidad - 200, 0)
--  WHERE id = 919
--    AND bodega_id = 1
--    AND codigo = '22'
--    AND cantidad >= 200;

-- Por defecto este archivo NO cambia nada (los UPDATE están comentados).
-- Descomenta SOLO la(s) línea(s) que confirmes tras conteo físico.

COMMIT;
