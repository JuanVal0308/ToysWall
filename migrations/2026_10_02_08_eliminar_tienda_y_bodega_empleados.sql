-- =====================================================================
-- 2026_10_02_08_eliminar_tienda_y_bodega_empleados.sql
--
-- 1. Empleados que venden desde una bodega: empleados.bodega_id (una sola ubicación de venta:
--    tienda_id o bodega_id). registrar_venta ya guarda tienda_id/bodega_id del registro vendido.
-- 2. Eliminar tienda de forma segura (RPC public.eliminar_tienda, solo administradores):
--    en UNA transacción mueve el inventario de la tienda a una bodega (sumando al registro del
--    mismo código o moviendo el registro), reasigna sus empleados a esa bodega, cancela planes de
--    movimiento pendientes con esa tienda, quita su fila de ubicaciones y marca la tienda como
--    eliminada (baja lógica).
--    ¿Por qué baja lógica y no DELETE? ventas.tienda_id tiene ON DELETE SET NULL: un DELETE
--    borraría de todas las ventas históricas la tienda donde se hicieron, y movimientos /
--    logs_deshacer_ventas guardan el id sin llave foránea (quedarían apuntando a nada). Con la baja
--    lógica el historial queda intacto y la tienda deja de verse en la app (política de lectura).
--    Las devoluciones de ventas de esa tienda se reponen en la bodega que recibió su inventario.
--
-- Requiere 01–07. Idempotente. Hacer antes el respaldo 2026_10_02_08_respaldo_antes_de_08.sql.
-- El frontend publicado funciona antes y después de aplicar esta migración.
-- Rollback: rollback/2026_10_02_08_eliminar_tienda_y_bodega_empleados_rollback.sql
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Empleados: ubicación de venta en bodega
-- ---------------------------------------------------------------------
ALTER TABLE public.empleados ADD COLUMN IF NOT EXISTS bodega_id integer REFERENCES public.bodegas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_empleados_bodega_id ON public.empleados(bodega_id);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'empleados_una_ubicacion' AND conrelid = 'public.empleados'::regclass) THEN
        ALTER TABLE public.empleados
            ADD CONSTRAINT empleados_una_ubicacion CHECK (tienda_id IS NULL OR bodega_id IS NULL);
    END IF;
END $$;
COMMENT ON COLUMN public.empleados.bodega_id IS 'Bodega desde la que vende el empleado (NULL si vende desde una tienda o no tiene ubicación)';

-- ---------------------------------------------------------------------
-- 2. Tiendas: baja lógica
-- ---------------------------------------------------------------------
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS eliminada_en timestamptz;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS eliminada_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS bodega_reasignada_id integer REFERENCES public.bodegas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tiendas_activas ON public.tiendas(empresa_id) WHERE eliminada_en IS NULL;
COMMENT ON COLUMN public.tiendas.eliminada_en IS 'Baja lógica: fecha en que se eliminó con eliminar_tienda (NULL = activa)';
COMMENT ON COLUMN public.tiendas.eliminada_por IS 'Usuario que eliminó la tienda';
COMMENT ON COLUMN public.tiendas.bodega_reasignada_id IS 'Bodega que recibió el inventario y los empleados de la tienda eliminada';

-- La baja (o reactivación) solo se hace con eliminar_tienda, que mueve antes inventario y empleados
CREATE OR REPLACE FUNCTION privado.proteger_baja_tienda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.eliminada_en IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.eliminada_en IS DISTINCT FROM OLD.eliminada_en) THEN
        IF coalesce(current_setting('toyswall.baja_tienda', true), '') <> 'si' THEN
            RAISE EXCEPTION 'Para eliminar una tienda usa la opción Eliminar (mueve su inventario y empleados a una bodega)'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.proteger_baja_tienda() FROM PUBLIC;
DROP TRIGGER IF EXISTS tiendas_proteger_baja ON public.tiendas;
CREATE TRIGGER tiendas_proteger_baja BEFORE INSERT OR UPDATE ON public.tiendas
    FOR EACH ROW EXECUTE FUNCTION privado.proteger_baja_tienda();

-- Políticas de tiendas: solo se leen las activas; nadie borra directamente (solo la RPC)
DROP POLICY IF EXISTS toyswall_select_todos ON public.tiendas;
DROP POLICY IF EXISTS toyswall_select_activas ON public.tiendas;
DROP POLICY IF EXISTS toyswall_delete_admin ON public.tiendas;
CREATE POLICY toyswall_select_activas ON public.tiendas FOR SELECT TO authenticated
    USING (privado.es_usuario_activo() AND eliminada_en IS NULL);

-- ---------------------------------------------------------------------
-- 3. Funciones existentes que deben ignorar tiendas eliminadas
-- ---------------------------------------------------------------------
-- Destinos de Abastecer y planes: no se puede enviar stock a una tienda eliminada
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
    IF (p_tipo = 'tienda' AND NOT EXISTS (SELECT 1 FROM public.tiendas WHERE id = p_id AND eliminada_en IS NULL))
       OR (p_tipo = 'bodega' AND NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id = p_id)) THEN
        RAISE EXCEPTION 'La % de destino no existe', p_tipo USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- Reponer (deshacer/devolución/revertir traslado): si la ubicación original es una tienda
-- eliminada, se repone en la bodega que recibió su inventario
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
    v_bodega_reasignada integer;
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

    IF p_tienda_id IS NOT NULL THEN
        SELECT coalesce(t.bodega_reasignada_id,
                        (SELECT b.id FROM public.bodegas b WHERE b.empresa_id = t.empresa_id ORDER BY b.id LIMIT 1))
          INTO v_bodega_reasignada
          FROM public.tiendas t
         WHERE t.id = p_tienda_id AND t.eliminada_en IS NOT NULL;
        IF v_bodega_reasignada IS NOT NULL THEN
            p_tienda_id := NULL;
            p_bodega_id := v_bodega_reasignada;
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

-- Sincronizar ubicaciones no vuelve a crear la fila de una tienda eliminada
CREATE OR REPLACE FUNCTION public.sincronizar_ubicaciones()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, tienda_id, activo)
    SELECT t.nombre, 'tienda', t.direccion, t.empresa_id, t.id, TRUE
    FROM tiendas t
    WHERE t.eliminada_en IS NULL
      AND NOT EXISTS (SELECT 1 FROM ubicaciones u WHERE u.tienda_id = t.id)
    ON CONFLICT (tienda_id) DO NOTHING;

    INSERT INTO ubicaciones (nombre, tipo, direccion, empresa_id, bodega_id, activo)
    SELECT b.nombre, 'bodega', b.direccion, b.empresa_id, b.id, TRUE
    FROM bodegas b
    WHERE NOT EXISTS (SELECT 1 FROM ubicaciones u WHERE u.bodega_id = b.id)
    ON CONFLICT (bodega_id) DO NOTHING;

    RAISE NOTICE 'Ubicaciones sincronizadas correctamente';
END;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC eliminar_tienda
--   p_tienda_id     tienda a eliminar
--   p_bodega_id     bodega destino (NULL = la única bodega; error si hay varias)
--   p_confirmacion  nombre de la tienda escrito por el administrador (sin distinguir mayúsculas)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eliminar_tienda(
    p_tienda_id integer,
    p_bodega_id integer DEFAULT NULL,
    p_confirmacion text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v_tienda public.tiendas;
    v_bodega public.bodegas;
    v_num_bodegas integer;
    t public.juguetes;
    v_destino_id integer;
    v_movidos integer := 0;
    v_fusionados integer := 0;
    v_unidades bigint := 0;
    v_empleados integer := 0;
    v_planes integer := 0;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    IF NOT ctx.es_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede eliminar tiendas' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_tienda FROM public.tiendas
     WHERE id = p_tienda_id AND eliminada_en IS NULL
       AND (ctx.empresa_id IS NULL OR empresa_id = ctx.empresa_id)
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La tienda no existe o ya fue eliminada' USING ERRCODE = 'P0002';
    END IF;

    IF lower(btrim(coalesce(p_confirmacion, ''))) <> lower(btrim(v_tienda.nombre)) THEN
        RAISE EXCEPTION 'Para confirmar escribe el nombre exacto de la tienda: "%"', v_tienda.nombre
            USING ERRCODE = '22023';
    END IF;

    IF p_bodega_id IS NULL THEN
        SELECT count(*) INTO v_num_bodegas FROM public.bodegas WHERE empresa_id = v_tienda.empresa_id;
        IF v_num_bodegas = 0 THEN
            RAISE EXCEPTION 'No hay ninguna bodega que reciba el inventario y los empleados. Crea una bodega primero.'
                USING ERRCODE = 'P0002';
        ELSIF v_num_bodegas > 1 THEN
            RAISE EXCEPTION 'Selecciona la bodega que recibirá el inventario y los empleados' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_bodega FROM public.bodegas WHERE empresa_id = v_tienda.empresa_id FOR KEY SHARE;
    ELSE
        SELECT * INTO v_bodega FROM public.bodegas
         WHERE id = p_bodega_id AND empresa_id = v_tienda.empresa_id FOR KEY SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La bodega seleccionada no existe' USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- Bloquear en orden de id los registros de la tienda y de la bodega (evita interbloqueos con ventas)
    PERFORM 1 FROM public.juguetes
      WHERE tienda_id = v_tienda.id OR bodega_id = v_bodega.id
      ORDER BY id FOR UPDATE;

    -- Inventario: sumar al registro de la bodega con el mismo código o mover el registro
    FOR t IN SELECT * FROM public.juguetes WHERE tienda_id = v_tienda.id ORDER BY id LOOP
        v_unidades := v_unidades + coalesce(t.cantidad, 0);

        SELECT id INTO v_destino_id FROM public.juguetes
         WHERE bodega_id = v_bodega.id AND lower(btrim(codigo)) = lower(btrim(t.codigo))
         ORDER BY id LIMIT 1;

        IF v_destino_id IS NOT NULL THEN
            UPDATE public.juguetes b
               SET cantidad = coalesce(b.cantidad, 0) + coalesce(t.cantidad, 0),
                   item = coalesce(b.item, t.item),
                   foto_url = coalesce(b.foto_url, t.foto_url),
                   precio_min = coalesce(b.precio_min, t.precio_min),
                   precio_por_mayor = coalesce(b.precio_por_mayor, t.precio_por_mayor),
                   numero_bultos = coalesce(b.numero_bultos, t.numero_bultos),
                   cantidad_por_bulto = coalesce(b.cantidad_por_bulto, t.cantidad_por_bulto)
             WHERE b.id = v_destino_id;
            -- Las ventas de ese registro apuntan ahora al de la bodega (devoluciones van allí);
            -- ventas.tienda_id sigue indicando la tienda donde se vendió
            UPDATE public.ventas SET juguete_id = v_destino_id WHERE juguete_id = t.id;
            DELETE FROM public.juguetes WHERE id = t.id;
            v_fusionados := v_fusionados + 1;
        ELSE
            UPDATE public.juguetes SET tienda_id = NULL, bodega_id = v_bodega.id WHERE id = t.id;
            v_movidos := v_movidos + 1;
        END IF;

        IF coalesce(t.cantidad, 0) > 0 THEN
            INSERT INTO public.movimientos (tipo_origen, origen_id, tipo_destino, destino_id, juguete_codigo, cantidad, empresa_id)
            VALUES ('tienda', v_tienda.id, 'bodega', v_bodega.id, t.codigo, t.cantidad, t.empresa_id);
        END IF;
    END LOOP;

    -- Empleados de la tienda pasan a vender desde la bodega
    UPDATE public.empleados SET tienda_id = NULL, bodega_id = v_bodega.id WHERE tienda_id = v_tienda.id;
    GET DIAGNOSTICS v_empleados = ROW_COUNT;

    -- Planes de movimiento pendientes que salen o llegan a la tienda
    UPDATE public.planes_movimiento SET estado = 'cancelado', updated_at = now()
     WHERE estado = 'pendiente'
       AND ((tipo_origen = 'tienda' AND origen_id = v_tienda.id) OR (tipo_destino = 'tienda' AND destino_id = v_tienda.id));
    GET DIAGNOSTICS v_planes = ROW_COUNT;

    DELETE FROM public.ubicaciones WHERE tienda_id = v_tienda.id;

    PERFORM set_config('toyswall.baja_tienda', 'si', true);
    UPDATE public.tiendas
       SET eliminada_en = now(), eliminada_por = ctx.usuario_id, bodega_reasignada_id = v_bodega.id
     WHERE id = v_tienda.id;
    PERFORM set_config('toyswall.baja_tienda', '', true);

    RETURN jsonb_build_object(
        'tienda_id', v_tienda.id,
        'tienda_nombre', v_tienda.nombre,
        'bodega_id', v_bodega.id,
        'bodega_nombre', v_bodega.nombre,
        'registros_movidos', v_movidos,
        'registros_fusionados', v_fusionados,
        'unidades', v_unidades,
        'empleados_reasignados', v_empleados,
        'planes_cancelados', v_planes);
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_tienda(integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_tienda(integer, integer, text) TO authenticated;

COMMIT;

-- VERIFICACIÓN
--  * columnas nuevas: empleados.bodega_id, tiendas.eliminada_en / eliminada_por / bodega_reasignada_id
--  * eliminar_tienda: security_definer = true, anon_puede = false, authenticated_puede = true
--  * políticas de tiendas: solo toyswall_select_activas, toyswall_insert_admin y toyswall_update_admin
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema = 'public'
   AND ((table_name = 'empleados' AND column_name = 'bodega_id')
     OR (table_name = 'tiendas' AND column_name IN ('eliminada_en', 'eliminada_por', 'bodega_reasignada_id')))
 ORDER BY 1, 2;
SELECT p.proname AS funcion, p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_puede
  FROM pg_proc p WHERE p.oid = 'public.eliminar_tienda(integer, integer, text)'::regprocedure;
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tiendas' ORDER BY 1;
