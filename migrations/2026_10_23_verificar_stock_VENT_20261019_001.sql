-- =====================================================================
-- Verificación (SOLO LECTURA) — VENT-20261019-001 y stock de códigos 43 / 22
-- Diagnóstico: la venta SÍ pasó por registrar_venta y descontó stock.
-- NO aplicar un UPDATE que reste otras 200: volvería a descontar de más.
-- =====================================================================

SELECT id, codigo_venta, juguete_codigo, juguete_id, tienda_id, bodega_id,
       empleado_id, cantidad, precio_venta, created_at
  FROM public.ventas
 WHERE codigo_venta = 'VENT-20261019-001'
   AND juguete_codigo IN ('43', '22')
 ORDER BY id;

SELECT j.id, j.codigo, j.item, j.cantidad, j.tienda_id, j.bodega_id,
       t.nombre AS tienda, b.nombre AS bodega, j.updated_at
  FROM public.juguetes j
  LEFT JOIN public.tiendas t ON t.id = j.tienda_id
  LEFT JOIN public.bodegas b ON b.id = j.bodega_id
 WHERE j.codigo IN ('43', '22')
 ORDER BY j.codigo, j.id;

SELECT id, nombre, codigo, tienda_id, bodega_id
  FROM public.empleados
 WHERE nombre ILIKE 'Jose';

-- Esperado:
--   43 / SG-29077: bodega id=1340 qty 238 + San victorino 9 + Campin 0 = General 247
--     (antes ~438 en bodega; 438-200=238). Venta: juguete_id=1340, bodega_id=1, qty 200.
--   22: bodega id=919 qty 109 (updated_at = timestamp exacto de la venta) + SV 15 = 124.
