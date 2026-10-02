-- =====================================================================
-- 2026_10_02_08_respaldo_antes_de_08.sql
-- Respaldo (copia de las tablas que toca la migración 08) en el esquema privado, que no está
-- expuesto por la API. Ejecutar ANTES de 2026_10_02_08_eliminar_tienda_y_bodega_empleados.sql.
-- Idempotente: si el respaldo ya existe no lo sobrescribe.
-- Para borrarlo más adelante: DROP TABLE privado.respaldo_20261002_<tabla>;
-- =====================================================================
BEGIN;
CREATE SCHEMA IF NOT EXISTS privado;
CREATE TABLE IF NOT EXISTS privado.respaldo_20261002_tiendas            AS TABLE public.tiendas;
CREATE TABLE IF NOT EXISTS privado.respaldo_20261002_empleados          AS TABLE public.empleados;
CREATE TABLE IF NOT EXISTS privado.respaldo_20261002_juguetes           AS TABLE public.juguetes;
CREATE TABLE IF NOT EXISTS privado.respaldo_20261002_ubicaciones        AS TABLE public.ubicaciones;
CREATE TABLE IF NOT EXISTS privado.respaldo_20261002_planes_movimiento  AS TABLE public.planes_movimiento;
REVOKE ALL ON ALL TABLES IN SCHEMA privado FROM PUBLIC, anon, authenticated;
COMMIT;

-- VERIFICACIÓN: el número de filas de cada respaldo debe coincidir con su tabla
SELECT 'tiendas' AS tabla, (SELECT count(*) FROM privado.respaldo_20261002_tiendas) AS respaldo, (SELECT count(*) FROM public.tiendas) AS actual
UNION ALL SELECT 'empleados', (SELECT count(*) FROM privado.respaldo_20261002_empleados), (SELECT count(*) FROM public.empleados)
UNION ALL SELECT 'juguetes', (SELECT count(*) FROM privado.respaldo_20261002_juguetes), (SELECT count(*) FROM public.juguetes)
UNION ALL SELECT 'ubicaciones', (SELECT count(*) FROM privado.respaldo_20261002_ubicaciones), (SELECT count(*) FROM public.ubicaciones)
UNION ALL SELECT 'planes_movimiento', (SELECT count(*) FROM privado.respaldo_20261002_planes_movimiento), (SELECT count(*) FROM public.planes_movimiento);
