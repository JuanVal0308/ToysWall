-- =====================================================================
-- 2026_09_30_04_stock_rpc.sql
-- Operaciones de stock atómicas en Postgres (una transacción por llamada, filas bloqueadas
-- con FOR UPDATE). Las usa el frontend cuando USAR_SUPABASE_AUTH = true:
--   registrar_venta            venta normal y al por mayor (descuenta y guarda ubicación)
--   revertir_venta             deshacer (motivo 'deshacer') y devoluciones (motivo 'devolucion')
--   transferir_stock           abastecer (mover entre tiendas/bodegas)
--   revertir_transferencia     deshacer abastecer
--   ejecutar_plan_movimiento   ejecutar un plan pendiente
-- SECURITY DEFINER con search_path fijo; exigen sesión de un usuario activo y, donde aplica, admin.
-- Requiere 01 (esquema privado), 02 (columnas de ubicación en ventas) y 03 (logs).
-- Idempotente (CREATE OR REPLACE).
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- Auxiliares internas
-- ---------------------------------------------------------------------

-- Siguiente código VENT-AAAAMMDD-NNN (fecha de Colombia), serializado con un lock de transacción
CREATE OR REPLACE FUNCTION privado.siguiente_codigo_venta()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_fecha text := to_char((now() AT TIME ZONE 'America/Bogota')::date, 'YYYYMMDD');
    v_n integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('toyswall_codigo_venta'));
    SELECT coalesce(max(split_part(codigo_venta, '-', 3)::integer), 0) + 1
      INTO v_n
      FROM public.ventas
     WHERE codigo_venta LIKE 'VENT-' || v_fecha || '-%'
       AND split_part(codigo_venta, '-', 3) ~ '^[0-9]+$';
    RETURN 'VENT-' || v_fecha || '-' || lpad(v_n::text, 3, '0');
END;
$$;

-- Suma unidades a un juguete en una ubicación. Orden de búsqueda:
--   1) el registro exacto (p_juguete_id) si todavía existe;
--   2) otro registro del mismo código en la misma tienda/bodega;
--   3) si no hay, lo recrea en esa ubicación copiando los datos de otro registro del código;
--   4) ventas antiguas sin ubicación: primer registro del código (comportamiento previo).
-- Devuelve el id del registro que recibió las unidades, o NULL si no hay de dónde copiar datos.
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

-- Verifica que exista la tienda/bodega destino
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

-- Mueve p_cantidad desde un registro (ya bloqueado y validado) a otra ubicación y registra el movimiento.
-- Si el origen queda en 0 se elimina el registro (comportamiento previo de la app).
CREATE OR REPLACE FUNCTION privado.transferir_uno(
    p_origen_id integer, p_cantidad integer, p_tipo_destino text, p_destino_id integer, p_empresa_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_origen public.juguetes;
    v_destino_id integer;
    v_mov_id integer;
    v_tipo_origen text;
    v_origen_ubic integer;
BEGIN
    UPDATE public.juguetes SET cantidad = cantidad - p_cantidad
     WHERE id = p_origen_id
    RETURNING * INTO v_origen;

    v_tipo_origen := CASE WHEN v_origen.bodega_id IS NOT NULL THEN 'bodega' ELSE 'tienda' END;
    v_origen_ubic := coalesce(v_origen.bodega_id, v_origen.tienda_id);

    SELECT id INTO v_destino_id FROM public.juguetes
     WHERE codigo = v_origen.codigo
       AND ((p_tipo_destino = 'tienda' AND tienda_id = p_destino_id)
         OR (p_tipo_destino = 'bodega' AND bodega_id = p_destino_id))
     ORDER BY id LIMIT 1 FOR UPDATE;

    IF v_destino_id IS NOT NULL THEN
        -- Suma y completa datos faltantes del destino con los del origen
        UPDATE public.juguetes d
           SET cantidad = coalesce(d.cantidad, 0) + p_cantidad,
               item = coalesce(d.item, v_origen.item),
               precio_min = coalesce(d.precio_min, v_origen.precio_min),
               precio_por_mayor = coalesce(d.precio_por_mayor, v_origen.precio_por_mayor),
               numero_bultos = coalesce(d.numero_bultos, v_origen.numero_bultos),
               cantidad_por_bulto = coalesce(d.cantidad_por_bulto, v_origen.cantidad_por_bulto),
               foto_url = coalesce(nullif(d.foto_url, ''), v_origen.foto_url)
         WHERE d.id = v_destino_id;
    ELSE
        INSERT INTO public.juguetes (nombre, codigo, item, cantidad, foto_url, precio_min, precio_por_mayor,
                                     numero_bultos, cantidad_por_bulto, empresa_id, tienda_id, bodega_id)
        VALUES (v_origen.nombre, v_origen.codigo, v_origen.item, p_cantidad, v_origen.foto_url, v_origen.precio_min,
                v_origen.precio_por_mayor, v_origen.numero_bultos, v_origen.cantidad_por_bulto, v_origen.empresa_id,
                CASE WHEN p_tipo_destino = 'tienda' THEN p_destino_id END,
                CASE WHEN p_tipo_destino = 'bodega' THEN p_destino_id END)
        RETURNING id INTO v_destino_id;
    END IF;

    INSERT INTO public.movimientos (tipo_origen, origen_id, tipo_destino, destino_id, juguete_codigo, cantidad, empresa_id)
    VALUES (v_tipo_origen, v_origen_ubic, p_tipo_destino, p_destino_id, v_origen.codigo, p_cantidad,
            coalesce(p_empresa_id, v_origen.empresa_id))
    RETURNING id INTO v_mov_id;

    IF v_origen.cantidad = 0 THEN
        DELETE FROM public.juguetes WHERE id = v_origen.id;
    END IF;

    RETURN jsonb_build_object(
        'movimiento_id', v_mov_id,
        'juguete_codigo', v_origen.codigo,
        'juguete_nombre', v_origen.nombre,
        'cantidad', p_cantidad,
        'juguete_origen_id', v_origen.id,
        'juguete_destino_id', v_destino_id,
        'restante_origen', v_origen.cantidad
    );
END;
$$;

-- ---------------------------------------------------------------------
-- registrar_venta
--   p_items: [{"juguete_id": 1, "cantidad": 2, "precio_unitario": 15000,
--              "empleado_id": 3, "metodo_pago": "efectivo"}, ...]
--   empleado_id y metodo_pago por item son opcionales (si faltan se usan p_empleado_id / p_metodo_pago).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_venta(
    p_items jsonb,
    p_metodo_pago text,
    p_empleado_id integer DEFAULT NULL,
    p_cliente_id integer DEFAULT NULL,
    p_es_por_mayor boolean DEFAULT false,
    p_abono numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v_item jsonb;
    v_pedido record;
    v_j public.juguetes;
    v_codigo text;
    v_total numeric := 0;
    v_abono numeric := coalesce(p_abono, 0);
    v_cant integer;
    v_precio numeric;
    v_abono_item numeric;
    v_venta_id integer;
    v_ventas jsonb := '[]'::jsonb;
    v_metodo text;
    v_empleado integer;
    v_total_credito numeric := 0;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debes agregar al menos un item a la venta' USING ERRCODE = '22023';
    END IF;
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'El cliente seleccionado no existe' USING ERRCODE = 'P0002';
    END IF;

    -- Validar formato de cada item
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        v_metodo := coalesce(nullif(trim(v_item->>'metodo_pago'), ''), nullif(trim(p_metodo_pago), ''));
        IF v_metodo IS NULL THEN
            RAISE EXCEPTION 'Selecciona el método de pago' USING ERRCODE = '22023';
        END IF;
        IF v_metodo = 'credito' AND p_es_por_mayor AND p_cliente_id IS NULL THEN
            RAISE EXCEPTION 'Para ventas a crédito debes seleccionar un cliente' USING ERRCODE = '22023';
        END IF;
        IF coalesce(v_item->>'empleado_id', '') <> '' AND (v_item->>'empleado_id') !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'Empleado inválido en uno de los items' USING ERRCODE = '22023';
        END IF;
        v_empleado := coalesce(nullif(v_item->>'empleado_id', '')::integer, p_empleado_id);
        IF v_empleado IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.empleados WHERE id = v_empleado) THEN
            RAISE EXCEPTION 'El empleado seleccionado no existe' USING ERRCODE = 'P0002';
        END IF;
        IF coalesce(v_item->>'juguete_id', '') !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'Item inválido: falta el juguete' USING ERRCODE = '22023';
        END IF;
        IF coalesce(v_item->>'cantidad', '') !~ '^[0-9]+$' OR (v_item->>'cantidad')::integer <= 0 THEN
            RAISE EXCEPTION 'La cantidad debe ser un número entero mayor a 0' USING ERRCODE = '22023';
        END IF;
        IF coalesce(v_item->>'precio_unitario', '') !~ '^[0-9]+(\.[0-9]+)?$' THEN
            RAISE EXCEPTION 'Precio inválido en uno de los items' USING ERRCODE = '22023';
        END IF;
        v_total := v_total + (v_item->>'cantidad')::integer * (v_item->>'precio_unitario')::numeric;
        IF v_metodo = 'credito' THEN
            v_total_credito := v_total_credito + (v_item->>'cantidad')::integer * (v_item->>'precio_unitario')::numeric;
        END IF;
    END LOOP;

    IF v_abono < 0 OR v_abono > v_total_credito THEN
        RAISE EXCEPTION 'El abono no puede ser negativo ni mayor que el total a crédito' USING ERRCODE = '22023';
    END IF;

    -- Bloquear los registros en orden de id (evita interbloqueos) y validar stock acumulado
    PERFORM 1 FROM public.juguetes
      WHERE id IN (SELECT (value->>'juguete_id')::integer FROM jsonb_array_elements(p_items))
      ORDER BY id FOR UPDATE;

    FOR v_pedido IN
        SELECT (value->>'juguete_id')::integer AS juguete_id,
               sum((value->>'cantidad')::integer) AS cantidad,
               min((value->>'precio_unitario')::numeric) AS precio_minimo_item
          FROM jsonb_array_elements(p_items) GROUP BY 1
    LOOP
        SELECT * INTO v_j FROM public.juguetes WHERE id = v_pedido.juguete_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Uno de los juguetes ya no existe en esa ubicación (pudo ser movido o eliminado). Vuelve a agregarlo.'
                USING ERRCODE = 'P0002';
        END IF;
        IF coalesce(v_j.cantidad, 0) < v_pedido.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, solicitado: %',
                v_j.nombre, coalesce(v_j.cantidad, 0), v_pedido.cantidad USING ERRCODE = 'P0001';
        END IF;
        -- Misma regla que la pantalla: un empleado no puede vender por debajo del precio mínimo
        IF NOT ctx.es_admin AND NOT p_es_por_mayor AND v_j.precio_min IS NOT NULL
           AND v_pedido.precio_minimo_item < v_j.precio_min THEN
            RAISE EXCEPTION 'El precio de "%" debe ser mayor o igual al precio mínimo (%)', v_j.nombre, v_j.precio_min
                USING ERRCODE = '22023';
        END IF;
    END LOOP;

    v_codigo := privado.siguiente_codigo_venta();

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        v_cant := (v_item->>'cantidad')::integer;
        v_precio := (v_item->>'precio_unitario')::numeric;
        v_metodo := coalesce(nullif(trim(v_item->>'metodo_pago'), ''), trim(p_metodo_pago));
        v_empleado := coalesce(nullif(v_item->>'empleado_id', '')::integer, p_empleado_id);

        UPDATE public.juguetes SET cantidad = cantidad - v_cant
         WHERE id = (v_item->>'juguete_id')::integer
        RETURNING * INTO v_j;

        v_abono_item := CASE WHEN v_metodo = 'credito' AND v_total_credito > 0
                             THEN round(v_abono * v_cant * v_precio / v_total_credito, 2) ELSE 0 END;

        INSERT INTO public.ventas (codigo_venta, juguete_codigo, juguete_id, tienda_id, bodega_id, empleado_id,
                                   precio_venta, cantidad, metodo_pago, empresa_id, es_por_mayor, cliente_id,
                                   abono, usuario_id)
        VALUES (v_codigo, v_j.codigo, v_j.id, v_j.tienda_id, v_j.bodega_id, v_empleado,
                v_cant * v_precio, v_cant, v_metodo, coalesce(ctx.empresa_id, v_j.empresa_id),
                coalesce(p_es_por_mayor, false), p_cliente_id, v_abono_item, ctx.usuario_id)
        RETURNING id INTO v_venta_id;

        v_ventas := v_ventas || jsonb_build_object(
            'venta_id', v_venta_id,
            'juguete_id', v_j.id,
            'juguete_codigo', v_j.codigo,
            'juguete_nombre', v_j.nombre,
            'cantidad', v_cant,
            'precio_venta', v_cant * v_precio,
            'abono', v_abono_item,
            'empleado_id', v_empleado,
            'metodo_pago', v_metodo,
            'tienda_id', v_j.tienda_id,
            'bodega_id', v_j.bodega_id,
            'cantidad_restante', v_j.cantidad);
    END LOOP;

    RETURN jsonb_build_object('codigo_venta', v_codigo, 'total', v_total, 'ventas', v_ventas);
END;
$$;

-- ---------------------------------------------------------------------
-- revertir_venta
--   p_items NULL  -> todas las ventas del código, cantidad completa
--   p_items       -> [{"venta_id": 10, "cantidad": 1}, ...] (devolución selectiva/parcial)
--   p_motivo      -> 'deshacer' (solo admin o quien la registró, máximo 30 minutos) o 'devolucion'
-- Repone en la ubicación exacta de la venta, registra el log y borra/ajusta la venta.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revertir_venta(
    p_codigo_venta text,
    p_items jsonb DEFAULT NULL,
    p_motivo text DEFAULT 'devolucion')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v record;
    v_cant integer;
    v_jid integer;
    v_j public.juguetes;
    v_codigo_vendedor text;
    v_encontradas integer := 0;
    v_eliminadas integer := 0;
    v_parciales integer := 0;
    v_unidades integer := 0;
    v_detalle jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();

    IF p_motivo NOT IN ('deshacer', 'devolucion') THEN
        RAISE EXCEPTION 'Motivo inválido: %', p_motivo USING ERRCODE = '22023';
    END IF;
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'Formato de items inválido' USING ERRCODE = '22023';
    END IF;

    FOR v IN
        SELECT * FROM public.ventas
         WHERE codigo_venta = p_codigo_venta
           AND (p_items IS NULL OR id IN (SELECT (value->>'venta_id')::integer FROM jsonb_array_elements(p_items)))
         ORDER BY id
         FOR UPDATE
    LOOP
        v_encontradas := v_encontradas + 1;

        IF p_motivo = 'deshacer' AND NOT ctx.es_admin
           AND (v.usuario_id IS DISTINCT FROM ctx.usuario_id OR v.created_at < now() - interval '30 minutes') THEN
            RAISE EXCEPTION 'Solo puedes deshacer tus propias ventas de los últimos 30 minutos. Para otras ventas usa Ajustes > Devolución.'
                USING ERRCODE = '42501';
        END IF;

        v_cant := v.cantidad;
        IF p_items IS NOT NULL THEN
            SELECT least(coalesce((value->>'cantidad')::integer, v.cantidad), v.cantidad) INTO v_cant
              FROM jsonb_array_elements(p_items) WHERE (value->>'venta_id')::integer = v.id LIMIT 1;
        END IF;
        IF v_cant IS NULL OR v_cant <= 0 THEN
            CONTINUE;
        END IF;

        v_jid := privado.reponer_stock(v.juguete_id, v.juguete_codigo, v.tienda_id, v.bodega_id, v_cant, v.empresa_id);
        IF v_jid IS NULL THEN
            RAISE EXCEPTION 'No se encontró el juguete con código % para devolver las unidades. Créalo en el inventario y vuelve a intentarlo.',
                v.juguete_codigo USING ERRCODE = 'P0002';
        END IF;
        SELECT * INTO v_j FROM public.juguetes WHERE id = v_jid;
        SELECT codigo INTO v_codigo_vendedor FROM public.empleados WHERE id = v.empleado_id;

        INSERT INTO public.logs_deshacer_ventas (
            empresa_id, usuario_id, usuario_nombre, motivo, venta_id, codigo_venta, codigo_vendedor, empleado_id,
            juguete_codigo, juguete_nombre, juguete_id, tienda_id, bodega_id, precio_venta, cantidad)
        VALUES (
            v.empresa_id, ctx.usuario_id, ctx.nombre, p_motivo, v.id, v.codigo_venta, v_codigo_vendedor, v.empleado_id,
            v.juguete_codigo, v_j.nombre, v_jid, v_j.tienda_id, v_j.bodega_id,
            round(v.precio_venta / greatest(v.cantidad, 1) * v_cant, 2), v_cant);

        IF v_cant >= v.cantidad THEN
            DELETE FROM public.ventas WHERE id = v.id;
            v_eliminadas := v_eliminadas + 1;
        ELSE
            UPDATE public.ventas
               SET cantidad = v.cantidad - v_cant,
                   precio_venta = round(v.precio_venta / v.cantidad * (v.cantidad - v_cant), 2)
             WHERE id = v.id;
            v_parciales := v_parciales + 1;
        END IF;

        v_unidades := v_unidades + v_cant;
        v_detalle := v_detalle || jsonb_build_object(
            'venta_id', v.id, 'juguete_codigo', v.juguete_codigo, 'juguete_nombre', v_j.nombre,
            'cantidad', v_cant, 'juguete_id', v_jid, 'tienda_id', v_j.tienda_id, 'bodega_id', v_j.bodega_id);
    END LOOP;

    IF v_encontradas = 0 THEN
        RAISE EXCEPTION 'No se encontraron ventas para procesar' USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object('ventas_eliminadas', v_eliminadas, 'ventas_parciales', v_parciales,
                              'unidades_repuestas', v_unidades, 'detalle', v_detalle);
END;
$$;

-- ---------------------------------------------------------------------
-- transferir_stock (Abastecer) — todo o nada
--   p_items: [{"juguete_id": 5, "cantidad": 3}, ...] (juguete_id = registro de ORIGEN)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transferir_stock(p_items jsonb, p_tipo_destino text, p_destino_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v_item jsonb;
    v_pedido record;
    v_j public.juguetes;
    v_movimientos jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    IF NOT ctx.es_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede mover inventario' USING ERRCODE = '42501';
    END IF;
    PERFORM privado.validar_ubicacion(p_tipo_destino, p_destino_id);

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debes seleccionar al menos un juguete' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        IF coalesce(v_item->>'juguete_id', '') !~ '^[0-9]+$'
           OR coalesce(v_item->>'cantidad', '') !~ '^[0-9]+$' OR (v_item->>'cantidad')::integer <= 0 THEN
            RAISE EXCEPTION 'Cada juguete debe tener una cantidad entera mayor a 0' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    PERFORM 1 FROM public.juguetes
      WHERE id IN (SELECT (value->>'juguete_id')::integer FROM jsonb_array_elements(p_items))
      ORDER BY id FOR UPDATE;

    -- Validar todo antes de mover nada
    FOR v_pedido IN
        SELECT (value->>'juguete_id')::integer AS juguete_id, sum((value->>'cantidad')::integer) AS cantidad
          FROM jsonb_array_elements(p_items) GROUP BY 1 ORDER BY 1
    LOOP
        SELECT * INTO v_j FROM public.juguetes WHERE id = v_pedido.juguete_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Uno de los juguetes ya no existe en el origen. Recarga la lista.' USING ERRCODE = 'P0002';
        END IF;
        IF (p_tipo_destino = 'tienda' AND v_j.tienda_id = p_destino_id)
           OR (p_tipo_destino = 'bodega' AND v_j.bodega_id = p_destino_id) THEN
            RAISE EXCEPTION 'El origen y el destino son la misma ubicación' USING ERRCODE = '22023';
        END IF;
        IF coalesce(v_j.cantidad, 0) < v_pedido.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, solicitado: %',
                v_j.nombre, coalesce(v_j.cantidad, 0), v_pedido.cantidad USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    FOR v_pedido IN
        SELECT (value->>'juguete_id')::integer AS juguete_id, sum((value->>'cantidad')::integer) AS cantidad
          FROM jsonb_array_elements(p_items) GROUP BY 1 ORDER BY 1
    LOOP
        v_movimientos := v_movimientos
            || privado.transferir_uno(v_pedido.juguete_id, v_pedido.cantidad::integer, p_tipo_destino, p_destino_id, ctx.empresa_id);
    END LOOP;

    RETURN jsonb_build_object('movimientos', v_movimientos);
END;
$$;

-- ---------------------------------------------------------------------
-- revertir_transferencia (deshacer Abastecer) — todo o nada
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revertir_transferencia(p_movimiento_ids integer[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    m record;
    d record;
    v_pendiente integer;
    v_disponible integer;
    v_tomar integer;
    v_revertidos integer := 0;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    IF NOT ctx.es_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede deshacer movimientos' USING ERRCODE = '42501';
    END IF;
    IF p_movimiento_ids IS NULL OR array_length(p_movimiento_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'No hay movimientos para deshacer' USING ERRCODE = '22023';
    END IF;

    FOR m IN SELECT * FROM public.movimientos WHERE id = ANY (p_movimiento_ids) ORDER BY id DESC FOR UPDATE LOOP
        SELECT coalesce(sum(cantidad), 0) INTO v_disponible FROM public.juguetes
         WHERE codigo = m.juguete_codigo
           AND ((m.tipo_destino = 'tienda' AND tienda_id = m.destino_id) OR (m.tipo_destino = 'bodega' AND bodega_id = m.destino_id));
        IF v_disponible < m.cantidad THEN
            RAISE EXCEPTION 'El destino ya no tiene las % unidades del código % (quedan %). No se puede deshacer.',
                m.cantidad, m.juguete_codigo, v_disponible USING ERRCODE = 'P0001';
        END IF;

        -- 1. Descontar del destino
        v_pendiente := m.cantidad;
        FOR d IN SELECT id, cantidad FROM public.juguetes
                  WHERE codigo = m.juguete_codigo
                    AND ((m.tipo_destino = 'tienda' AND tienda_id = m.destino_id) OR (m.tipo_destino = 'bodega' AND bodega_id = m.destino_id))
                    AND cantidad > 0
                  ORDER BY id FOR UPDATE LOOP
            EXIT WHEN v_pendiente = 0;
            v_tomar := least(d.cantidad, v_pendiente);
            UPDATE public.juguetes SET cantidad = cantidad - v_tomar WHERE id = d.id;
            v_pendiente := v_pendiente - v_tomar;
        END LOOP;

        -- 2. Devolver al origen (recrea el registro si se había eliminado al quedar en 0)
        PERFORM privado.reponer_stock(NULL, m.juguete_codigo,
            CASE WHEN m.tipo_origen = 'tienda' THEN m.origen_id END,
            CASE WHEN m.tipo_origen = 'bodega' THEN m.origen_id END,
            m.cantidad, m.empresa_id);

        -- 3. Quitar registros del destino que quedaron vacíos (mismo criterio que al mover)
        DELETE FROM public.juguetes
         WHERE codigo = m.juguete_codigo AND cantidad = 0
           AND ((m.tipo_destino = 'tienda' AND tienda_id = m.destino_id) OR (m.tipo_destino = 'bodega' AND bodega_id = m.destino_id));

        DELETE FROM public.movimientos WHERE id = m.id;
        v_revertidos := v_revertidos + 1;
    END LOOP;

    IF v_revertidos = 0 THEN
        RAISE EXCEPTION 'Los movimientos ya no existen (¿ya se deshicieron?)' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object('movimientos_revertidos', v_revertidos);
END;
$$;

-- ---------------------------------------------------------------------
-- ejecutar_plan_movimiento
-- Mueve cada item del plan que tenga stock suficiente en el origen; los demás se informan
-- como omitidos. Si no se puede mover ninguno, el plan sigue pendiente y no cambia nada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ejecutar_plan_movimiento(p_plan_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    ctx record;
    v_plan public.planes_movimiento;
    v_item jsonb;
    v_codigo text;
    v_cant integer;
    v_origen public.juguetes;
    v_movimientos jsonb := '[]'::jsonb;
    v_omitidos jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO ctx FROM privado.contexto();
    IF NOT ctx.es_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede ejecutar planes de movimiento' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_plan FROM public.planes_movimiento WHERE id = p_plan_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El plan no existe' USING ERRCODE = 'P0002';
    END IF;
    IF v_plan.estado <> 'pendiente' THEN
        RAISE EXCEPTION 'Este plan ya fue ejecutado o cancelado' USING ERRCODE = '22023';
    END IF;
    PERFORM privado.validar_ubicacion(v_plan.tipo_destino, v_plan.destino_id);

    FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(v_plan.items, '[]'::jsonb)) LOOP
        v_codigo := coalesce(v_item->>'juguete_codigo', v_item->>'codigo');
        v_cant := CASE WHEN coalesce(v_item->>'cantidad', '') ~ '^[0-9]+$' THEN (v_item->>'cantidad')::integer END;
        IF v_codigo IS NULL OR v_cant IS NULL OR v_cant <= 0 THEN
            v_omitidos := v_omitidos || to_jsonb(coalesce(v_item->>'nombre', v_codigo, 'item') || ': datos incompletos');
            CONTINUE;
        END IF;

        SELECT * INTO v_origen FROM public.juguetes
         WHERE codigo = v_codigo
           AND ((v_plan.tipo_origen = 'tienda' AND tienda_id = v_plan.origen_id)
             OR (v_plan.tipo_origen = 'bodega' AND bodega_id = v_plan.origen_id))
         ORDER BY cantidad DESC, id LIMIT 1 FOR UPDATE;

        IF NOT FOUND THEN
            v_omitidos := v_omitidos || to_jsonb(v_codigo || ': no está en el origen');
            CONTINUE;
        END IF;
        IF coalesce(v_origen.cantidad, 0) < v_cant THEN
            v_omitidos := v_omitidos || to_jsonb(v_origen.nombre || ': stock insuficiente (' || coalesce(v_origen.cantidad, 0) || ' de ' || v_cant || ')');
            CONTINUE;
        END IF;

        v_movimientos := v_movimientos
            || privado.transferir_uno(v_origen.id, v_cant, v_plan.tipo_destino, v_plan.destino_id, v_plan.empresa_id);
    END LOOP;

    IF jsonb_array_length(v_movimientos) = 0 AND jsonb_array_length(coalesce(v_plan.items, '[]'::jsonb)) > 0 THEN
        RETURN jsonb_build_object('ejecutado', false, 'procesados', 0,
                                  'total', jsonb_array_length(v_plan.items), 'omitidos', v_omitidos);
    END IF;

    UPDATE public.planes_movimiento
       SET estado = 'ejecutado', ejecutado_por = ctx.nombre, ejecutado_at = now()
     WHERE id = p_plan_id;

    RETURN jsonb_build_object('ejecutado', true, 'procesados', jsonb_array_length(v_movimientos),
                              'total', jsonb_array_length(coalesce(v_plan.items, '[]'::jsonb)),
                              'omitidos', v_omitidos, 'movimientos', v_movimientos);
END;
$$;

-- Permisos: solo usuarios con sesión; las auxiliares privadas no son invocables por la API
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA privado FROM PUBLIC;
GRANT EXECUTE ON FUNCTION privado.usuario_actual_id(), privado.es_usuario_activo(), privado.es_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.registrar_venta(jsonb, text, integer, integer, boolean, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revertir_venta(text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transferir_stock(jsonb, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revertir_transferencia(integer[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ejecutar_plan_movimiento(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta(jsonb, text, integer, integer, boolean, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revertir_venta(text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transferir_stock(jsonb, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revertir_transferencia(integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ejecutar_plan_movimiento(integer) TO authenticated;

COMMIT;

-- VERIFICACIÓN: deben aparecer las 5 funciones, SECURITY DEFINER, sin permiso para anon
SELECT p.proname AS funcion,
       p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_puede
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('registrar_venta', 'revertir_venta', 'transferir_stock', 'revertir_transferencia', 'ejecutar_plan_movimiento')
 ORDER BY 1;
