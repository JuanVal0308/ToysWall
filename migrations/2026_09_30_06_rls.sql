-- =====================================================================
-- 2026_09_30_06_rls.sql
-- Seguridad a nivel de fila (RLS) basada en Supabase Auth. Hay una sola empresa, así que
-- no hay políticas por empresa:
--   * anon (sin sesión): no ve ni modifica nada; el login usa solo /auth/v1.
--   * authenticated con fila activa en usuarios (auth_id = auth.uid()): lectura y operación normal.
--   * administradores (tipo_usuario_id 1 o 2): borrados, catálogos, empleados, etc.
--   * usuarios: solo lectura (sin la columna password); altas, cambios y bajas por RPC (01).
--   * stock: ventas/devoluciones/traslados por las RPC de 04 (SECURITY DEFINER).
-- ⚠ APLICAR SOLO DESPUÉS de publicar el frontend con USAR_SUPABASE_AUTH = true:
--   el login antiguo (tabla usuarios con la anon key) deja de funcionar con esta migración.
-- Requiere 01–05. Idempotente (borra y recrea las políticas de public).
-- =====================================================================
BEGIN;

-- Usuarios creados después de 01 (con el login antiguo) también reciben su cuenta de Auth
SELECT privado.vincular_usuarios_pendientes() AS usuarios_vinculados_ahora;

-- Helper: crea las políticas de una tabla. Valores: 'todos' (usuario activo), 'admin', 'nadie'
CREATE OR REPLACE FUNCTION privado.aplicar_politicas(
    p_tabla text, p_lectura text, p_insercion text, p_actualizacion text, p_borrado text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_expr text;
    v_nivel text;
    v_cmd text;
    v_niveles text[] := ARRAY[p_lectura, p_insercion, p_actualizacion, p_borrado];
    v_cmds text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
BEGIN
    IF to_regclass('public.' || quote_ident(p_tabla)) IS NULL THEN
        RAISE NOTICE 'Tabla public.% no existe; se omite', p_tabla;
        RETURN;
    END IF;
    FOR i IN 1..4 LOOP
        v_nivel := v_niveles[i];
        v_cmd := v_cmds[i];
        IF v_nivel NOT IN ('todos', 'admin', 'nadie') THEN
            RAISE EXCEPTION 'Nivel inválido % para %', v_nivel, p_tabla;
        END IF;
        CONTINUE WHEN v_nivel = 'nadie';
        v_expr := CASE v_nivel WHEN 'todos' THEN 'privado.es_usuario_activo()' ELSE 'privado.es_admin()' END;
        EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s',
            'toyswall_' || lower(v_cmd) || '_' || v_nivel, p_tabla, v_cmd,
            CASE v_cmd
                WHEN 'INSERT' THEN format('WITH CHECK (%s)', v_expr)
                WHEN 'UPDATE' THEN format('USING (%s) WITH CHECK (%s)', v_expr, v_expr)
                ELSE format('USING (%s)', v_expr)
            END);
    END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION privado.aplicar_politicas(text, text, text, text, text) FROM PUBLIC;

-- 1. Borrar TODAS las políticas existentes de public (las antiguas eran USING (true) para todos)
DO $$
DECLARE p record;
BEGIN
    FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    END LOOP;
END $$;

-- 2. RLS activo en todas las tablas; anon sin privilegios; authenticated con privilegios (filtrados por RLS)
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Objetos creados en el futuro por postgres tampoco quedan abiertos para anon
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;

-- 3. Políticas por tabla: (tabla, leer, insertar, actualizar, borrar)
DO $$
BEGIN
    PERFORM privado.aplicar_politicas('tipo_usuarios',                     'todos', 'nadie', 'nadie', 'nadie');
    PERFORM privado.aplicar_politicas('empresas',                          'todos', 'nadie', 'admin', 'nadie');
    PERFORM privado.aplicar_politicas('usuarios',                          'todos', 'nadie', 'nadie', 'nadie');
    PERFORM privado.aplicar_politicas('bodegas',                           'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('tiendas',                           'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('ubicaciones',                       'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('empleados',                         'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('juguetes',                          'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('movimientos',                       'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('planes_movimiento',                 'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('clientes',                          'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('pagos',                             'todos', 'admin', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('ventas',                            'todos', 'admin', 'todos', 'admin');
    PERFORM privado.aplicar_politicas('facturas',                          'todos', 'todos', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('facturas_items',                    'todos', 'todos', 'admin', 'admin');
    PERFORM privado.aplicar_politicas('logs_deshacer_ventas',              'admin', 'todos', 'nadie', 'nadie');
    PERFORM privado.aplicar_politicas('pedidos_venta_por_mayor_empleados', 'todos', 'todos', 'todos', 'admin');
END $$;

-- Cualquier otra tabla que exista y no esté arriba: lectura para usuarios, escritura solo admin
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
                AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) LOOP
        PERFORM privado.aplicar_politicas(t.relname, 'todos', 'admin', 'admin', 'admin');
    END LOOP;
END $$;

-- 4. usuarios: la columna password nunca se expone por la API
REVOKE ALL ON public.usuarios FROM authenticated;
GRANT SELECT (id, nombre, email, empresa_id, tipo_usuario_id, activo, created_at, updated_at, auth_id)
    ON public.usuarios TO authenticated;

-- 5. Vistas: se evalúan con los permisos de quien consulta (respetan RLS)
DO $$
DECLARE v record;
BEGIN
    FOR v IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind = 'v' LOOP
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.relname);
    END LOOP;
END $$;

-- 6. Funciones de public (excepto las de extensiones): solo usuarios con sesión
DO $$
DECLARE f record;
BEGIN
    FOR f IN SELECT p.oid::regprocedure AS firma
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.firma);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.firma);
    END LOOP;
END $$;

COMMIT;

-- VERIFICACIÓN
-- a) Ninguna tabla sin RLS y ningún privilegio para anon (ambas consultas deben devolver 0 filas)
SELECT 'sin_rls' AS problema, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
SELECT 'anon_con_privilegios', table_name FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
UNION ALL
SELECT 'politica_publica_abierta', tablename || '.' || policyname FROM pg_policies
 WHERE schemaname = 'public' AND (roles @> ARRAY['public']::name[] OR roles @> ARRAY['anon']::name[])
UNION ALL
SELECT 'usuarios_sin_auth', nombre FROM public.usuarios WHERE auth_id IS NULL;
-- b) Resumen de políticas por tabla
SELECT tablename, string_agg(cmd || ':' || split_part(policyname, '_', 3), ', ' ORDER BY cmd) AS politicas
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;
