-- =====================================================================
-- 2026_09_30_07_eliminar_passwords.sql
-- Elimina las contraseñas en texto plano de public.usuarios. Las contraseñas viven solo en
-- Supabase Auth (hash bcrypt en auth.users).
-- ⚠ Aplicar SOLO después de comprobar que todos inician sesión con USAR_SUPABASE_AUTH = true
--   (tras aplicar 06). No tiene vuelta atrás: el rollback no puede recuperar las contraseñas.
-- Se detiene sin cambiar nada si algún usuario no tiene cuenta de Auth vinculada.
-- Idempotente.
-- =====================================================================
BEGIN;

DO $$
DECLARE v_pendientes text;
BEGIN
    SELECT string_agg(nombre, ', ') INTO v_pendientes FROM public.usuarios WHERE auth_id IS NULL;
    IF v_pendientes IS NOT NULL THEN
        RAISE EXCEPTION 'Usuarios sin cuenta de Auth: %. Ejecuta primero SELECT privado.vincular_usuarios_pendientes();', v_pendientes;
    END IF;
END $$;

UPDATE public.usuarios SET password = NULL WHERE password IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_sin_password_plano') THEN
        ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_sin_password_plano CHECK (password IS NULL);
    END IF;
END $$;

COMMENT ON COLUMN public.usuarios.password IS 'OBSOLETA: siempre NULL. Las contraseñas están en Supabase Auth.';

-- Opcional, cuando ya no haya ninguna versión antigua del frontend en uso:
-- ALTER TABLE public.usuarios DROP COLUMN password;

COMMIT;

-- VERIFICACIÓN: con_password debe ser 0 y sin_auth debe ser 0
SELECT count(*) FILTER (WHERE password IS NOT NULL) AS con_password,
       count(*) FILTER (WHERE auth_id IS NULL)      AS sin_auth,
       count(*)                                     AS total
  FROM public.usuarios;
