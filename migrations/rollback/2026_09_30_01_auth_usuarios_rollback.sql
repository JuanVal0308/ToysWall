-- Rollback de 2026_09_30_01_auth_usuarios.sql
-- Quita las RPC de usuarios/perfil, los helpers y las cuentas de Auth creadas por la migración.
-- ⚠ Antes revierte 07 y 06; con 07 aplicada las contraseñas en texto plano ya no existen y el login
--   antiguo no funcionaría (no ejecutar este rollback en ese caso).
-- ⚠ Borra también 04/05 si dependen del esquema privado (ejecuta antes sus rollbacks).
BEGIN;

DROP FUNCTION IF EXISTS public.admin_crear_usuario(text, text, text, integer);
DROP FUNCTION IF EXISTS public.admin_actualizar_usuario(uuid, text, text, integer, text, boolean);
DROP FUNCTION IF EXISTS public.admin_eliminar_usuario(uuid);
DROP FUNCTION IF EXISTS public.actualizar_mi_perfil(text, text, text, text);
DROP TRIGGER IF EXISTS usuarios_sincronizar_auth ON public.usuarios;

-- Cuentas de Auth creadas por la migración (las identidades se borran en cascada)
DELETE FROM auth.users a
 WHERE a.raw_app_meta_data->>'origen' = 'toyswall_migracion';

ALTER TABLE public.usuarios DROP COLUMN IF EXISTS auth_id;

DROP SCHEMA IF EXISTS privado CASCADE;

COMMIT;

-- VERIFICACIÓN: todo debe ser 0 / false
SELECT (SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'origen' = 'toyswall_migracion') AS cuentas_migradas,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'auth_id') AS existe_auth_id,
       EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'privado') AS existe_privado;
