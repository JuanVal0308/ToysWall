/**
 * Servicio de stock basado en funciones de Postgres (RPC) — capa de INFRAESTRUCTURA.
 *
 * Cada operación se ejecuta en UNA transacción dentro de la base de datos (migración
 * 2026_09_30_04_stock_rpc.sql): o se aplica todo (stock + ventas/movimientos + logs) o nada.
 * Las ventas guardan la ubicación de origen y deshacer/devolver repone en esa ubicación exacta.
 * Se usa cuando APP_CONFIG.USAR_SUPABASE_AUTH = true (las RPC exigen sesión de Supabase Auth).
 */
class ServicioStockRpc {
    constructor(clienteSupabase) {
        this.cliente = clienteSupabase;
    }

    /** Ejecuta una RPC y convierte el error de Postgres en un Error con el mensaje legible. */
    async llamar(funcion, parametros) {
        const { data, error } = await this.cliente.rpc(funcion, parametros);
        if (error) {
            const err = new Error(error.message || `Error al ejecutar ${funcion}`);
            err.code = error.code;
            err.detalles = error.details;
            throw err;
        }
        return data;
    }

    /**
     * Registra una venta (normal o al por mayor) descontando stock.
     * @param {Object} p
     * @param {Array<{juguete_id:number, cantidad:number, precio_unitario:number}>} p.items
     * @param {string} p.metodoPago
     * @param {number|null} [p.empleadoId]
     * @param {number|null} [p.clienteId]
     * @param {boolean} [p.esPorMayor]
     * @param {number} [p.abono]
     * @returns {Promise<{codigo_venta:string, total:number, ventas:Array}>}
     */
    registrarVenta({ items, metodoPago, empleadoId = null, clienteId = null, esPorMayor = false, abono = 0 }) {
        return this.llamar('registrar_venta', {
            p_items: items.map(i => ({
                juguete_id: i.juguete_id,
                cantidad: i.cantidad,
                precio_unitario: i.precio_unitario
            })),
            p_metodo_pago: metodoPago,
            p_empleado_id: empleadoId,
            p_cliente_id: clienteId,
            p_es_por_mayor: esPorMayor,
            p_abono: abono || 0
        });
    }

    /** Deshace una venta completa (repone todo y la elimina). */
    deshacerVenta(codigoVenta) {
        return this.llamar('revertir_venta', { p_codigo_venta: codigoVenta, p_items: null, p_motivo: 'deshacer' });
    }

    /**
     * Devolución total o parcial.
     * @param {string} codigoVenta
     * @param {Array<{venta_id:number, cantidad:number}>|null} items - null = toda la venta
     */
    devolverVenta(codigoVenta, items = null) {
        return this.llamar('revertir_venta', { p_codigo_venta: codigoVenta, p_items: items, p_motivo: 'devolucion' });
    }

    /**
     * Mueve stock a otra ubicación (Abastecer).
     * @param {Array<{juguete_id:number, cantidad:number}>} items - juguete_id = registro de origen
     * @returns {Promise<{movimientos:Array}>}
     */
    transferir(items, tipoDestino, destinoId) {
        return this.llamar('transferir_stock', { p_items: items, p_tipo_destino: tipoDestino, p_destino_id: destinoId });
    }

    /** Deshace movimientos de Abastecer (por ids de la tabla movimientos). */
    revertirTransferencia(movimientoIds) {
        return this.llamar('revertir_transferencia', { p_movimiento_ids: movimientoIds });
    }

    /** Ejecuta un plan de movimiento pendiente. */
    ejecutarPlan(planId) {
        return this.llamar('ejecutar_plan_movimiento', { p_plan_id: planId });
    }
}

if (typeof window !== 'undefined') {
    window.ServicioStockRpc = ServicioStockRpc;
    window.usarStockRpc = () => window.APP_CONFIG?.USAR_SUPABASE_AUTH === true && !!window.servicioStockRpc;
    if (window.supabaseClient) window.servicioStockRpc = new ServicioStockRpc(window.supabaseClient);
}
