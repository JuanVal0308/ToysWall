/**
 * Tiendas, bodegas y ubicación de venta de empleados — capa de INFRAESTRUCTURA.
 *
 * - eliminarTienda: RPC eliminar_tienda (migración 2026_10_02_08). En UNA transacción mueve el
 *   inventario y los empleados de la tienda a una bodega y la marca como eliminada; las ventas y
 *   movimientos históricos se conservan. Solo administradores (lo valida la base de datos).
 * - admiteBodegaEnEmpleados: detecta si ya existe empleados.bodega_id, para que el frontend
 *   funcione igual antes de aplicar la migración (solo tiendas) y después (tiendas y bodegas).
 */
class ServicioUbicacionesRpc {
    constructor(clienteSupabase) {
        this.cliente = clienteSupabase;
        this._admiteBodega = null;
    }

    static get MENSAJE_MIGRACION_PENDIENTE() {
        return 'Para eliminar tiendas primero hay que aplicar en Supabase la migración 2026_10_02_08 ' +
            '(mueve el inventario y los empleados a una bodega sin perder el historial).';
    }

    /** true si el error indica que la función RPC no existe (migración sin aplicar). */
    static esFuncionFaltante(error) {
        if (!error) return false;
        return error.code === 'PGRST202' || error.code === '42883' ||
            /could not find the function|function .* does not exist/i.test(error.message || '');
    }

    /** true si el error indica que una columna no existe (migración sin aplicar). */
    static esColumnaFaltante(error) {
        if (!error) return false;
        return error.code === '42703' || error.code === 'PGRST204' ||
            /column .* does not exist|could not find the .* column/i.test(error.message || '');
    }

    /**
     * Elimina la tienda moviendo inventario y empleados a la bodega.
     * @param {number} tiendaId
     * @param {number|null} bodegaId - null = la única bodega
     * @param {string} confirmacion - nombre de la tienda escrito por el administrador
     * @returns {Promise<Object>} resumen (registros_movidos, registros_fusionados, unidades, empleados_reasignados, ...)
     */
    async eliminarTienda(tiendaId, bodegaId, confirmacion) {
        const { data, error } = await this.cliente.rpc('eliminar_tienda', {
            p_tienda_id: Number(tiendaId),
            p_bodega_id: bodegaId === null || bodegaId === undefined || bodegaId === '' ? null : Number(bodegaId),
            p_confirmacion: confirmacion
        });
        if (error) {
            const faltante = ServicioUbicacionesRpc.esFuncionFaltante(error);
            const err = new Error(faltante ? ServicioUbicacionesRpc.MENSAJE_MIGRACION_PENDIENTE : (error.message || 'No se pudo eliminar la tienda'));
            err.code = faltante ? 'MIGRACION_PENDIENTE' : error.code;
            throw err;
        }
        return data;
    }

    /** Datos para el modal de eliminar: tienda, su inventario, bodegas y número de empleados. */
    async datosParaEliminar(tiendaId) {
        const id = Number(tiendaId);
        const [tienda, juguetes, bodegas, empleados] = await Promise.all([
            this.cliente.from('tiendas').select('id, nombre').eq('id', id).maybeSingle(),
            this.cliente.from('juguetes').select('id, codigo, cantidad').eq('tienda_id', id),
            this.cliente.from('bodegas').select('id, nombre').order('nombre'),
            this.cliente.from('empleados').select('id', { count: 'exact', head: true }).eq('tienda_id', id)
        ]);
        for (const r of [tienda, juguetes, bodegas, empleados]) {
            if (r.error) throw r.error;
        }
        if (!tienda.data) throw new Error('La tienda ya no existe.');
        return {
            tienda: tienda.data,
            juguetes: juguetes.data || [],
            bodegas: bodegas.data || [],
            empleados: empleados.count || 0
        };
    }

    /** Códigos de los registros de una bodega (para anticipar qué se suma y qué se mueve). */
    async codigosDeBodega(bodegaId) {
        const { data, error } = await this.cliente.from('juguetes').select('codigo').eq('bodega_id', Number(bodegaId));
        if (error) throw error;
        return data || [];
    }

    /** true si la BD ya tiene empleados.bodega_id (migración 08 aplicada). Se consulta una vez. */
    async admiteBodegaEnEmpleados() {
        if (this._admiteBodega !== null) return this._admiteBodega;
        // Se mira si la fila trae la columna (sin pedirla por nombre, para no generar un error 400)
        const { data, error } = await this.cliente.from('empleados').select('*').limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
            this._admiteBodega = Object.prototype.hasOwnProperty.call(data[0], 'bodega_id');
            return this._admiteBodega;
        }
        // Sin empleados no se puede mirar una fila: se pide la columna directamente
        const prueba = await this.cliente.from('empleados').select('bodega_id').limit(1);
        if (prueba.error && !ServicioUbicacionesRpc.esColumnaFaltante(prueba.error)) throw prueba.error;
        this._admiteBodega = !prueba.error;
        return this._admiteBodega;
    }
}

if (typeof window !== 'undefined') {
    window.ServicioUbicacionesRpc = ServicioUbicacionesRpc;
    if (window.supabaseClient) window.servicioUbicaciones = new ServicioUbicacionesRpc(window.supabaseClient);
}
