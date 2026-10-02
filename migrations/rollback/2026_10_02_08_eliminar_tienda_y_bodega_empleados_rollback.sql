-- Rollback de 2026_10_02_08_eliminar_tienda_y_bodega_empleados.sql
-- Vuelve a las funciones y políticas de 04/06. Idempotente.
-- ⚠ Los empleados asignados a una bodega quedan sin ubicación de venta (se borra empleados.bodega_id).
-- ⚠ Las tiendas ya eliminadas NO se borran (eso quitaría la tienda de las ventas históricas):
--   vuelven a verse con el prefijo "[ELIMINADA] " y sin inventario ni empleados, y se conservan las
--   columnas de la baja lógica. Si no hay tiendas eliminadas, también se quitan esas columnas.
BEGIN;

DROP FUNCTION IF EXISTS public.eliminar_tienda(integer, integer, text);

-- Políticas de tiendas como en 06
DROP POLICY IF EXISTS toyswall_select_activas ON public.tiendas;
DROP POLICY IF EXISTS toyswall_select_todos ON public.tiendas;
DROP POLICY IF EXISTS toyswall_delete_admin ON public.tiendas;
CREATE POLICY toyswall_select_todos ON public.tiendas FOR SELECT TO authenticated USING (privado.es_usuario_activo());
CREATE POLICY toyswall_delete_admin ON public.tiendas FOR DELETE TO authenticated USING (privado.es_admin());

DROP TRIGGER IF EXISTS tiendas_proteger_baja ON public.tiendas;
DROP FUNCTION IF EXISTS privado.proteger_baja_tienda();

-- Funciones como en 04 / inventario_por_ubicacion
CREATE OR REPLACE FUNCTION privado.validar_ubicacion(p_tipo text, p_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_tipo NOT IN ('tienda', 'bodega') THEN
        RAISE EXCEPTION 'Tipo de ubicación inválido: %', p_tipo USING ERRCODE = '22023';
    END IF;
    IF (p_tipo = 'tienda' AND NOT EXISTS (SELECT 1 FROM public.tiendas WHERE id = p_id))
       OR (p_tipo = 'bodega' AND NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id = p_id)) THEN
        RAISE EXCEPTION 'La % de destino no existe', p_tipo USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION privado.reponer_stock(
    p_juguete_id integer, p_codigo text, p_tienda_id integer, p_bodega_id integer, p_cantidad integer, p_empresa_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_id integer;
    v_plantilla public.juguetes;
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'Cantidad a reponer inválida';
    END IF;

    IF p_juguete_id IS NOT NULL THEN
        UPDATE public.juguetes SET cantidad = coalesce(cantidad, 0) + p_cantidad
         WHERE id = p_juguete_id
        RETURNING id INTO v_id;
        IF v_id IS NOT NULL THEN
            RETURN v_id;
        END IF;
    END IF;

    IF p_tienda_id IS NULL AND p_bodega_id IS NULL THEN
        SELECT id INTO v_id FROM public.juguetes WHERE codigo = p_codigo ORDER BY id LIMIT 1 FOR UPDATE;
        IF v_id IS NULL THEN
            RETURN NULL;
        END IF;
        UPDATE public.juguetes SET cantidad = coalesce(cantidad, 0) + p_cantidad WHERE id = v_id;
        RETURN v_id;
    END IF;

    SELECT id INTO v_id FROM public.juguetes
     WHERE codigo = p_codigo
       AND tienda_id IS NOT DISTINCT FROM p_tienda_id
       AND bodega_id IS NOT DISTINCT FROM p_bodega_id
     ORDER BY id LIMIT 1 FOR UPDATE;
    IF v_id IS NOT NULL THEN
        UPDATE public.juguetes SET cantidad = coalesce(cantidad, 0) + p_cantidad WHERE id = v_id;
        RETURN v_id;
    END IF;

    SELECT * INTO v_plantilla FROM public.juguetes WHERE codigo = p_codigo ORDER BY id LIMIT 1;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    INSERT INTO public.juguetes (nombre, codigo, item, cantidad, foto_url, precio_min, precio_por_mayor,
                                 numero_bultos, cantidad_por_bulto, empresa_id, tienda_id, bodega_id)
    VALUES (v_plantilla.nombre, v_plantilla.codigo, v_plantilla.item, p_cantidad, v_plantilla.foto_url,
            v_plantilla.precio_min, v_plantilla.precio_por_mayor, v_plantilla.numero_bultos,
            v_plantilla.cantidad_por_bulto, coalesce(p_empresa_id, v_plantilla.empresa_id),
            p_tienda_id, CASE WHEN p_tienda_id IS NULL THEN p_bodega_id END)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION privado.reponer_stock(integer, text, integer, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION privado.validar_ubicacion(text, integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sincronizar_ubicaciones()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insertar tiendas nuevas
    INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, tienda_id, activo)
    SELECT t.nombre, 'tienda', t.direccion, t.empresa_id, t.id, TRUE
    FROM tiendas t
    WHERE NOT EXISTS (
        SELECT 1 FROM ubicaciones u WHERE u.tienda_id = t.id
    )
    ON CONFLICT (tienda_id) DO NOTHING;

    -- Insertar bodegas nuevas
    INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, bodega_id, activo)
    SELECT b.nombre, 'bodega', b.direccion, b.empresa_id, b.id, TRUE
    FROM bodegas b
    WHERE NOT EXISTS (
        SELECT 1 FROM ubicaciones u WHERE u.bodega_id = b.id
    )
    ON CONFLICT (bodega_id) DO NOTHING;

    RAISE NOTICE 'Ubicaciones sincronizadas correctamente';
END;
$$;

-- Tiendas eliminadas: se conservan (historial) marcadas en el nombre
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'tiendas' AND column_name = 'eliminada_en') THEN
        IF EXISTS (SELECT 1 FROM public.tiendas WHERE eliminada_en IS NOT NULL) THEN
            UPDATE public.tiendas SET nombre = left('[ELIMINADA] ' || nombre, 100)
             WHERE eliminada_en IS NOT NULL AND nombre NOT LIKE '[ELIMINADA] %';
            RAISE NOTICE 'Hay tiendas eliminadas: se conservan con el prefijo [ELIMINADA] y las columnas de baja lógica';
        ELSE
            DROP INDEX IF EXISTS public.idx_tiendas_activas;
            ALTER TABLE public.tiendas DROP COLUMN IF EXISTS bodega_reasignada_id;
            ALTER TABLE public.tiendas DROP COLUMN IF EXISTS eliminada_por;
            ALTER TABLE public.tiendas DROP COLUMN IF EXISTS eliminada_en;
        END IF;
    END IF;
END $$;

-- Empleados: quitar la ubicación en bodega
ALTER TABLE public.empleados DROP CONSTRAINT IF EXISTS empleados_una_ubicacion;
DROP INDEX IF EXISTS public.idx_empleados_bodega_id;
ALTER TABLE public.empleados DROP COLUMN IF EXISTS bodega_id;

COMMIT;

-- VERIFICACIÓN: no debe existir eliminar_tienda ni empleados.bodega_id; políticas de tiendas como en 06
SELECT to_regprocedure('public.eliminar_tienda(integer, integer, text)') AS eliminar_tienda;
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empleados' AND column_name = 'bodega_id';
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tiendas' ORDER BY 1;
