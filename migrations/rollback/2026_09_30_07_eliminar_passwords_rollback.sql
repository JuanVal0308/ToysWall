-- Rollback de 2026_09_30_07_eliminar_passwords.sql
-- Solo quita la restricción. Las contraseñas en texto plano NO se pueden recuperar:
-- el login antiguo solo volvería a funcionar si cada usuario recibe una contraseña nueva en usuarios.password.
BEGIN;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_sin_password_plano;
COMMENT ON COLUMN public.usuarios.password IS NULL;
COMMIT;

-- VERIFICACIÓN: 0 filas
SELECT conname FROM pg_constraint WHERE conname = 'usuarios_sin_password_plano';
