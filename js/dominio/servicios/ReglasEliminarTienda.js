/**
 * Reglas puras para eliminar una tienda (capa de DOMINIO).
 * La eliminación real la hace la RPC eliminar_tienda en una sola transacción; estas reglas
 * alimentan el modal de confirmación (nombre escrito, bodega destino y resumen del traslado)
 * con la misma lógica que la RPC.
 */
const ReglasEliminarTienda = {
    /** Nombre o código comparable: sin espacios a los lados y sin distinguir mayúsculas. */
    normalizar(texto) {
        return String(texto ?? '').trim().toLowerCase();
    },

    /** true si lo escrito coincide con el nombre de la tienda (sin distinguir mayúsculas ni espacios a los lados). */
    nombreConfirmado(escrito, nombreTienda) {
        const esperado = this.normalizar(nombreTienda);
        return esperado !== '' && this.normalizar(escrito) === esperado;
    },

    /**
     * Bodega que recibirá el inventario y los empleados.
     * - Sin bodegas: error.
     * - Una sola bodega: se usa automáticamente.
     * - Varias: la elegida por el administrador (error si no eligió o no existe).
     * @param {Array<{id:number, nombre:string}>} bodegas
     * @param {number|string|null} idSeleccionado
     * @returns {{bodega: Object|null, automatica: boolean, error: string|null}}
     */
    elegirBodegaDestino(bodegas, idSeleccionado = null) {
        const lista = bodegas || [];
        if (lista.length === 0) {
            return { bodega: null, automatica: false, error: 'No hay ninguna bodega que reciba el inventario y los empleados. Crea una bodega primero.' };
        }
        if (lista.length === 1) {
            return { bodega: lista[0], automatica: true, error: null };
        }
        const bodega = lista.find(b => String(b.id) === String(idSeleccionado ?? ''));
        if (!bodega) {
            return { bodega: null, automatica: false, error: 'Selecciona la bodega que recibirá el inventario y los empleados.' };
        }
        return { bodega, automatica: false, error: null };
    },

    /**
     * Resume qué pasará con el inventario (misma regla que la RPC): cada registro de la tienda se
     * suma al registro de la bodega con el mismo código o, si la bodega no lo tiene, se mueve.
     * @param {Array<{codigo:string, cantidad:number}>} filasTienda
     * @param {Array<{codigo:string}>} filasBodega
     * @returns {{registros:number, unidades:number, fusionados:number, movidos:number}}
     */
    resumirTraslado(filasTienda, filasBodega) {
        const enBodega = new Set((filasBodega || []).map(f => this.normalizar(f.codigo)));
        let fusionados = 0;
        let movidos = 0;
        let unidades = 0;
        (filasTienda || []).forEach(fila => {
            const codigo = this.normalizar(fila.codigo);
            unidades += Number(fila.cantidad) || 0;
            if (enBodega.has(codigo)) {
                fusionados++;
            } else {
                movidos++;
                enBodega.add(codigo); // un segundo registro con ese código se sumará a este
            }
        });
        return { registros: (filasTienda || []).length, unidades, fusionados, movidos };
    },

    /** Mensaje para el administrador a partir del resultado de la RPC. */
    mensajeResultado(r) {
        const partes = [`Tienda "${r.tienda_nombre}" eliminada.`];
        if (r.registros_movidos || r.registros_fusionados) {
            partes.push(`${r.unidades} unidad(es) pasaron a la bodega ${r.bodega_nombre} ` +
                `(${r.registros_fusionados} producto(s) sumados a los que ya había y ${r.registros_movidos} movido(s)).`);
        } else {
            partes.push('No tenía inventario.');
        }
        if (r.empleados_reasignados) {
            partes.push(`${r.empleados_reasignados} empleado(s) ahora venden desde la bodega ${r.bodega_nombre}.`);
        }
        if (r.planes_cancelados) {
            partes.push(`${r.planes_cancelados} plan(es) de movimiento pendiente(s) cancelado(s).`);
        }
        partes.push('Las ventas y movimientos anteriores se conservan.');
        return partes.join(' ');
    }
};

if (typeof window !== 'undefined') window.ReglasEliminarTienda = ReglasEliminarTienda;
if (typeof module !== 'undefined') module.exports = ReglasEliminarTienda;
