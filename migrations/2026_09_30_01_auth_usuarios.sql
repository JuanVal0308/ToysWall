-- =====================================================================
-- 2026_09_30_01_auth_usuarios.sql
-- Migra el inicio de sesión a Supabase Auth SIN dejar a nadie por fuera:
--   1. Crea el esquema "privado" (no expuesto por la API) con funciones auxiliares.
--   2. Agrega usuarios.auth_id (vínculo con auth.users) y permite password NULL.
--   3. Crea un usuario de Supabase Auth por cada fila de "usuarios", con su contraseña
--      ACTUAL (encriptada con bcrypt), el correo confirmado y el mismo UUID de usuarios.id.
--   4. Crea las funciones RPC para administrar usuarios y editar el perfil propio.
-- No borra ni cambia contraseñas en texto plano (eso lo hace el paso 07, después de verificar).
-- Idempotente: se puede ejecutar varias veces. Ejecutar completo en el SQL Editor de Supabase.
-- =====================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- 1. Esquema privado (PostgREST solo expone "public")
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;
-- Las políticas RLS se evalúan con el rol del usuario, por eso necesita USAGE
GRANT USAGE ON SCHEMA privado TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Vínculo usuarios <-> auth.users
-- ---------------------------------------------------------------------
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS auth_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_auth_id_fkey') THEN
        ALTER TABLE public.usuarios
            ADD CONSTRAINT usuarios_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_auth_id_key') THEN
        ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_auth_id_key UNIQUE (auth_id);
    END IF;
END $$;

-- Los usuarios nuevos ya no guardan contraseña en texto plano
ALTER TABLE public.usuarios ALTER COLUMN password DROP NOT NULL;

COMMENT ON COLUMN public.usuarios.auth_id IS 'Usuario de Supabase Auth (auth.users.id) con el que inicia sesión';

-- ---------------------------------------------------------------------
-- 3. Funciones auxiliares (esquema privado)
-- ---------------------------------------------------------------------

-- Crea (o reutiliza si ya existe el correo) un usuario de Supabase Auth con correo confirmado.
-- Columnas según el esquema actual de GoTrue: los tokens de texto deben ser '' (no NULL)
-- o el inicio de sesión falla con "converting NULL to string is unsupported".
CREATE OR REPLACE FUNCTION privado.crear_usuario_auth(p_id uuid, p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_temp
AS $$
DECLARE
    v_email text := lower(trim(p_email));
    v_id uuid;
BEGIN
    IF v_email IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'El correo es obligatorio';
    END IF;
    IF p_password IS NULL OR length(p_password) = 0 THEN
        RAISE EXCEPTION 'La contraseña es obligatoria para %', v_email;
    END IF;

    SELECT id INTO v_id FROM auth.users
     WHERE lower(email) = v_email AND coalesce(is_sso_user, false) = false
     LIMIT 1;
    IF v_id IS NOT NULL THEN
        RETURN v_id; -- ya existía: solo se vincula (no se toca su contraseña)
    END IF;

    v_id := coalesce(p_id, gen_random_uuid());
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_id) THEN
        v_id := gen_random_uuid();
    END IF;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
        crypt(p_password, gen_salt('bf', 10)), now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'origen', 'toyswall_migracion'),
        '{}'::jsonb, now(), now(),
        '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
        'email', now(), now(), now()
    );

    RETURN v_id;
END;
$$;

-- Cambia correo y/o contraseña de un usuario de Auth (sin enviar correos de confirmación)
CREATE OR REPLACE FUNCTION privado.actualizar_usuario_auth(p_auth_id uuid, p_email text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_temp
AS $$
BEGIN
    IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
        UPDATE auth.users SET email = lower(trim(p_email)), updated_at = now() WHERE id = p_auth_id;
        UPDATE auth.identities
           SET identity_data = identity_data || jsonb_build_object('email', lower(trim(p_email))), updated_at = now()
         WHERE user_id = p_auth_id AND provider = 'email';
    END IF;
    IF p_password IS NOT NULL AND p_password <> '' THEN
        UPDATE auth.users SET encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
         WHERE id = p_auth_id;
    END IF;
END;
$$;

-- Crea cuentas de Auth para las filas de usuarios que aún no tienen (idempotente)
CREATE OR REPLACE FUNCTION privado.vincular_usuarios_pendientes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_temp
AS $$
DECLARE
    r record;
    n integer := 0;
BEGIN
    FOR r IN SELECT id, email, password FROM public.usuarios
              WHERE auth_id IS NULL AND password IS NOT NULL AND length(password) > 0 LOOP
        UPDATE public.usuarios SET auth_id = privado.crear_usuario_auth(r.id, r.email, r.password) WHERE id = r.id;
        n := n + 1;
    END LOOP;
    RETURN n;
END;
$$;

-- Datos de la sesión actual (usadas por políticas RLS y RPC)
CREATE OR REPLACE FUNCTION privado.usuario_actual_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT u.id FROM public.usuarios u
     WHERE u.auth_id = auth.uid() AND coalesce(u.activo, true)
     LIMIT 1
$$;

CREATE OR REPLACE FUNCTION privado.es_usuario_activo() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND coalesce(u.activo, true))
$$;

CREATE OR REPLACE FUNCTION privado.es_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.usuarios u
                    WHERE u.auth_id = auth.uid() AND coalesce(u.activo, true) AND u.tipo_usuario_id IN (1, 2))
$$;

-- Contexto completo; lanza error si la sesión no corresponde a un usuario activo
CREATE OR REPLACE FUNCTION privado.contexto(
    OUT usuario_id uuid, OUT empresa_id integer, OUT tipo_usuario_id integer, OUT es_admin boolean, OUT nombre text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    SELECT u.id, u.empresa_id, u.tipo_usuario_id, u.tipo_usuario_id IN (1, 2), u.nombre
      INTO usuario_id, empresa_id, tipo_usuario_id, es_admin, nombre
      FROM public.usuarios u
     WHERE u.auth_id = auth.uid() AND coalesce(u.activo, true)
     LIMIT 1;
    IF usuario_id IS NULL THEN
        RAISE EXCEPTION 'Sesión no válida: inicia sesión nuevamente' USING ERRCODE = '42501';
    END IF;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA privado FROM PUBLIC;
GRANT EXECUTE ON FUNCTION privado.usuario_actual_id(), privado.es_usuario_activo(), privado.es_admin() TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Crear/vincular las cuentas de Auth de los usuarios existentes
-- ---------------------------------------------------------------------
SELECT privado.vincular_usuarios_pendientes() AS usuarios_vinculados_ahora;

-- Mientras el frontend siga con USAR_SUPABASE_AUTH = false (entre 01 y el cambio del flag), el login
-- antiguo crea usuarios y cambia correos/contraseñas directo en public.usuarios. Este trigger
-- replica esos cambios en Supabase Auth para que nadie quede con una clave distinta al activar el flag.
-- Con el flag activo las RPC guardan password = NULL, así que el trigger no hace nada.
CREATE OR REPLACE FUNCTION privado.sincronizar_usuario_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.auth_id IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = OLD.auth_id;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.auth_id IS NULL THEN
        IF NEW.password IS NOT NULL AND length(NEW.password) > 0 THEN
            UPDATE public.usuarios SET auth_id = privado.crear_usuario_auth(NEW.id, NEW.email, NEW.password)
             WHERE id = NEW.id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM privado.actualizar_usuario_auth(
            NEW.auth_id,
            CASE WHEN lower(NEW.email) IS DISTINCT FROM lower(OLD.email) THEN NEW.email END,
            CASE WHEN NEW.password IS DISTINCT FROM OLD.password THEN NEW.password END);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.sincronizar_usuario_auth() FROM PUBLIC;

DROP TRIGGER IF EXISTS usuarios_sincronizar_auth ON public.usuarios;
CREATE TRIGGER usuarios_sincronizar_auth
    AFTER INSERT OR UPDATE OF email, password OR DELETE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION privado.sincronizar_usuario_auth();

-- ---------------------------------------------------------------------
-- 5. RPC de administración de usuarios y perfil (reemplazan el manejo de contraseñas en el navegador)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_crear_usuario(
    p_nombre text, p_email text, p_password text, p_tipo_usuario_id integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v_id uuid := gen_random_uuid();
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    IF NOT ctx.es_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede crear usuarios' USING ERRCODE = '42501';
    END IF;
    IF p_tipo_usuario_id = 1 AND ctx.tipo_usuario_id <> 1 THEN
        RAISE EXCEPTION 'Solo un Super Administrador puede crear otro Super Administrador' USING ERRCODE = '42501';
    END IF;
    IF coalesce(trim(p_nombre), '') = '' OR coalesce(trim(p_email), '') = '' THEN
        RAISE EXCEPTION 'Nombre y correo son obligatorios' USING ERRCODE = '22023';
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.usuarios WHERE lower(email) = lower(trim(p_email)))
       OR EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))) THEN
        RAISE EXCEPTION 'El email ingresado ya está registrado' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.usuarios (id, nombre, email, password, empresa_id, tipo_usuario_id, activo)
    VALUES (v_id, trim(p_nombre), lower(trim(p_email)), NULL, ctx.empresa_id, p_tipo_usuario_id, true);
    UPDATE public.usuarios SET auth_id = privado.crear_usuario_auth(v_id, p_email, p_password) WHERE id = v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_actualizar_usuario(
    p_id uuid, p_nombre text, p_email text, p_tipo_usuario_id integer,
    p_password text DEFAULT NULL, p_activo boolean DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v_usuario public.usuarios;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    IF NOT ctx.es_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede editar usuarios' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_usuario FROM public.usuarios WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El usuario no existe' USING ERRCODE = 'P0002';
    END IF;
    IF ctx.tipo_usuario_id <> 1 AND (v_usuario.tipo_usuario_id = 1 OR p_tipo_usuario_id = 1) THEN
        RAISE EXCEPTION 'Solo un Super Administrador puede modificar Super Administradores' USING ERRCODE = '42501';
    END IF;
    IF p_password IS NOT NULL AND p_password <> '' AND length(p_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres' USING ERRCODE = '22023';
    END IF;
    IF p_email IS NOT NULL AND lower(trim(p_email)) <> lower(v_usuario.email) AND (
           EXISTS (SELECT 1 FROM public.usuarios WHERE lower(email) = lower(trim(p_email)) AND id <> p_id)
        OR EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email)) AND id IS DISTINCT FROM v_usuario.auth_id)) THEN
        RAISE EXCEPTION 'El email ingresado ya está registrado' USING ERRCODE = '23505';
    END IF;

    UPDATE public.usuarios
       SET nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
           email = coalesce(nullif(lower(trim(p_email)), ''), email),
           tipo_usuario_id = coalesce(p_tipo_usuario_id, tipo_usuario_id),
           activo = coalesce(p_activo, activo)
     WHERE id = p_id;

    IF v_usuario.auth_id IS NOT NULL THEN
        PERFORM privado.actualizar_usuario_auth(v_usuario.auth_id, p_email, p_password);
    ELSIF p_password IS NOT NULL AND p_password <> '' THEN
        UPDATE public.usuarios SET auth_id = privado.crear_usuario_auth(p_id, coalesce(p_email, v_usuario.email), p_password)
         WHERE id = p_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_eliminar_usuario(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v_usuario public.usuarios;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    IF NOT ctx.es_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede eliminar usuarios' USING ERRCODE = '42501';
    END IF;
    IF p_id = ctx.usuario_id THEN
        RAISE EXCEPTION 'No puedes eliminar tu propio usuario' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_usuario FROM public.usuarios WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El usuario no existe' USING ERRCODE = 'P0002';
    END IF;
    IF v_usuario.tipo_usuario_id = 1 AND ctx.tipo_usuario_id <> 1 THEN
        RAISE EXCEPTION 'Solo un Super Administrador puede eliminar Super Administradores' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.usuarios WHERE id = p_id;
    IF v_usuario.auth_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = v_usuario.auth_id;
    END IF;
END;
$$;

-- Perfil propio: exige la contraseña actual (verificada contra el hash de Auth)
CREATE OR REPLACE FUNCTION public.actualizar_mi_perfil(
    p_password_actual text, p_nombre text DEFAULT NULL, p_email text DEFAULT NULL, p_password_nueva text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, pg_temp
AS $$
DECLARE
    ctx record;
    v_hash text;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    SELECT encrypted_password INTO v_hash FROM auth.users WHERE id = auth.uid();
    IF v_hash IS NULL OR p_password_actual IS NULL OR crypt(p_password_actual, v_hash) <> v_hash THEN
        RAISE EXCEPTION 'La contraseña actual es incorrecta' USING ERRCODE = '28P01';
    END IF;
    IF p_password_nueva IS NOT NULL AND p_password_nueva <> '' AND length(p_password_nueva) < 6 THEN
        RAISE EXCEPTION 'La nueva contraseña debe tener al menos 6 caracteres' USING ERRCODE = '22023';
    END IF;
    IF p_nombre IS NOT NULL AND trim(p_nombre) <> '' AND EXISTS (
        SELECT 1 FROM public.usuarios WHERE lower(nombre) = lower(trim(p_nombre)) AND id <> ctx.usuario_id) THEN
        RAISE EXCEPTION 'Este nombre de usuario ya está en uso. Por favor, elige otro.' USING ERRCODE = '23505';
    END IF;
    IF p_email IS NOT NULL AND trim(p_email) <> '' AND (
           EXISTS (SELECT 1 FROM public.usuarios WHERE lower(email) = lower(trim(p_email)) AND id <> ctx.usuario_id)
        OR EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email)) AND id <> auth.uid())) THEN
        RAISE EXCEPTION 'El email ingresado ya está registrado' USING ERRCODE = '23505';
    END IF;

    UPDATE public.usuarios
       SET nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
           email = coalesce(nullif(lower(trim(p_email)), ''), email)
     WHERE id = ctx.usuario_id;
    PERFORM privado.actualizar_usuario_auth(auth.uid(), p_email, p_password_nueva);
END;
$$;

-- Solo usuarios con sesión (nunca anon) pueden llamar las RPC
REVOKE ALL ON FUNCTION public.admin_crear_usuario(text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_actualizar_usuario(uuid, text, text, integer, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_eliminar_usuario(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_mi_perfil(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crear_usuario(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_actualizar_usuario(uuid, text, text, integer, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_eliminar_usuario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_mi_perfil(text, text, text, text) TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------
-- VERIFICACIÓN (debe mostrar todos los usuarios con tiene_auth = true y
-- clave_coincide = true; ninguna fila con problema)
-- ---------------------------------------------------------------------
SELECT u.nombre,
       u.email,
       u.auth_id IS NOT NULL                                             AS tiene_auth,
       a.email_confirmed_at IS NOT NULL                                  AS correo_confirmado,
       (a.encrypted_password = extensions.crypt(u.password, a.encrypted_password)) AS clave_coincide,
       (SELECT count(*) FROM auth.identities i WHERE i.user_id = a.id AND i.provider = 'email') AS identidades
  FROM public.usuarios u
  LEFT JOIN auth.users a ON a.id = u.auth_id
 ORDER BY u.nombre;
