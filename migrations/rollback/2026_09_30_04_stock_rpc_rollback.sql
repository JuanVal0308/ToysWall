-- Rollback de 2026_09_30_04_stock_rpc.sql
-- Con el frontend en USAR_SUPABASE_AUTH = true, la venta/abastecer dejarían de funcionar: cambia antes el flag a false
-- (y en ese caso revierte también 06, porque el modo antiguo escribe directo en las tablas).
BEGIN;
DROP FUNCTION IF EXISTS public.registrar_venta(jsonb, text, integer, integer, boolean, numeric);
DROP FUNCTION IF EXISTS public.revertir_venta(text, jsonb, text);
DROP FUNCTION IF EXISTS public.transferir_stock(jsonb, text, integer);
DROP FUNCTION IF EXISTS public.revertir_transferencia(integer[]);
DROP FUNCTION IF EXISTS public.ejecutar_plan_movimiento(integer);
DROP FUNCTION IF EXISTS privado.transferir_uno(integer, integer, text, integer, integer);
DROP FUNCTION IF EXISTS privado.validar_ubicacion(text, integer);
DROP FUNCTION IF EXISTS privado.reponer_stock(integer, text, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS privado.siguiente_codigo_venta();
COMMIT;

-- VERIFICACIÓN: 0 filas
SELECT n.nspname || '.' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE p.proname IN ('registrar_venta', 'revertir_venta', 'transferir_stock', 'revertir_transferencia', 'ejecutar_plan_movimiento',
                     'transferir_uno', 'validar_ubicacion', 'reponer_stock', 'siguiente_codigo_venta');
