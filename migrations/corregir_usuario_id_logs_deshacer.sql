-- =====================================================================
-- PROPUESTA (NO EJECUTADA): corregir el tipo de logs_deshacer_ventas.usuario_id
-- =====================================================================
-- Problema: la tabla usuarios usa id UUID, pero logs_deshacer_ventas.usuario_id es INTEGER.
-- Al deshacer una venta, el insert del log fallaba con el error 22P02
-- ("invalid input syntax for type integer") y el log NUNCA se guardaba.
-- El frontend ahora reintenta sin usuario_id para no perder el log, pero así no queda
-- registrado quién deshizo la venta.
--
-- Esta migración cambia la columna a UUID. La tabla está vacía en producción
-- (verificado el 30/09/2026), por lo que la conversión no pierde datos.
-- Ejecutar manualmente en el SQL Editor de Supabase después de revisarla.

BEGIN;

ALTER TABLE logs_deshacer_ventas
    ALTER COLUMN usuario_id TYPE UUID USING NULL;

-- Opcional: relacionar con usuarios (si se borra el usuario, se conserva el log)
ALTER TABLE logs_deshacer_ventas
    ADD CONSTRAINT logs_deshacer_ventas_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

COMMIT;
