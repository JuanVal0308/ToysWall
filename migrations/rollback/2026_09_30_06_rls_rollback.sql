-- Rollback de 2026_09_30_06_rls.sql
-- Vuelve al estado anterior: políticas abiertas USING (true) para todos (incluido anon), permisos
-- para anon y vistas sin security_invoker. Necesario si se vuelve a USAR_SUPABASE_AUTH = false.
-- ⚠ Esto vuelve a dejar los datos accesibles con la anon key (igual que antes de la migración).
BEGIN;

DO $$
DECLARE p record;
BEGIN
    FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'toyswall_%' LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    END LOOP;
END $$;

DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'acceso_abierto_' || t.relname, t.relname);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'acceso_abierto_' || t.relname, t.relname);
    END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

DO $$
DECLARE v record;
BEGIN
    FOR v IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind = 'v' LOOP
        EXECUTE format('ALTER VIEW public.%I RESET (security_invoker)', v.relname);
    END LOOP;
END $$;

-- Funciones previas (no las RPC nuevas, que siguen solo para authenticated)
DO $$
DECLARE f record;
BEGIN
    FOR f IN SELECT p.oid::regprocedure AS firma FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.proname IN ('generar_codigo_venta', 'update_updated_at_column', 'sincronizar_ubicaciones', 'obtener_inventario_total_codigo') LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f.firma);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS privado.aplicar_politicas(text, text, text, text, text);

COMMIT;

-- VERIFICACIÓN: cada tabla con su política acceso_abierto_* y anon con acceso
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY 1;
SELECT has_table_privilege('anon', 'public.juguetes', 'SELECT') AS anon_lee_juguetes;
