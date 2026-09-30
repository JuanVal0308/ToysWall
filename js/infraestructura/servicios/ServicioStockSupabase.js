/**
 * Servicio de stock sobre Supabase (capa de INFRAESTRUCTURA).
 *
 * Centraliza las operaciones que modifican cantidades de la tabla `juguetes` para que
 * ventas, ventas al por mayor, movimientos (abastecer / planes) y sus "deshacer" se comporten igual:
 *  - Se actualiza el registro existente en su lugar (no se borra y se vuelve a crear, lo que
 *    cambiaba los ids y podía perder datos si la inserción fallaba).
 *  - Se usa control de concurrencia optimista: el UPDATE solo se aplica si la cantidad no cambió
 *    desde la lectura; si otro usuario la cambió, se reintenta con el valor nuevo.
 *  - Todos los errores de Supabase se propagan (antes muchos se ignoraban en silencio).
 */
class ServicioStockSupabase {
    constructor(clienteSupabase) {
        this.cliente = clienteSupabase;
        this.reintentos = 4;
    }

    /** Campos que se copian al crear un registro del mismo juguete en otra ubicación. */
    static camposJuguete(fila) {
        return {
            nombre: fila.nombre,
            codigo: fila.codigo,
            item: fila.item ?? null,
            foto_url: fila.foto_url ?? null,
            precio_min: fila.precio_min ?? null,
            precio_por_mayor: fila.precio_por_mayor ?? null,
            numero_bultos: fila.numero_bultos ?? null,
            cantidad_por_bulto: fila.cantidad_por_bulto ?? null,
            empresa_id: fila.empresa_id
        };
    }

    async obtener(id) {
        const { data, error } = await this.cliente.from('juguetes').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data;
    }

    /**
     * Suma (delta > 0) o resta (delta < 0) unidades a un registro de juguete.
     * Lanza error si el resultado quedaría negativo.
     * @returns {Promise<{anterior: number, nueva: number, fila: Object}>}
     */
    async ajustarCantidad(id, delta) {
        for (let intento = 0; intento < this.reintentos; intento++) {
            const fila = await this.obtener(id);
            if (!fila) throw new Error('El juguete ya no existe en esa ubicación (pudo ser eliminado o movido).');
            const anterior = fila.cantidad || 0;
            const nueva = anterior + delta;
            if (nueva < 0) {
                throw new Error(`Stock insuficiente para "${fila.nombre}". Disponible: ${anterior}, solicitado: ${-delta}`);
            }
            let consulta = this.cliente.from('juguetes').update({ cantidad: nueva }).eq('id', id);
            consulta = fila.cantidad === null ? consulta.is('cantidad', null) : consulta.eq('cantidad', fila.cantidad);
            const { data, error } = await consulta.select('id');
            if (error) throw error;
            if (data && data.length === 1) return { anterior, nueva, fila };
            // Otro usuario modificó la cantidad entre la lectura y la escritura: reintentar
        }
        throw new Error('El inventario cambió mientras se guardaba. Intenta de nuevo.');
    }

    /** Descuenta unidades de un registro (venta). */
    descontar(id, cantidad) {
        return this.ajustarCantidad(id, -Math.abs(cantidad));
    }

    /**
     * Devuelve unidades a un registro (deshacer venta / devolución).
     * Si el registro ya no existe, lo recrea en la misma ubicación con los datos de respaldo.
     * @param {number} id
     * @param {number} cantidad
     * @param {Object} [respaldo] - Fila original (para recrearla si fue eliminada)
     */
    async reponer(id, cantidad, respaldo = null) {
        const fila = id ? await this.obtener(id) : null;
        if (fila) return this.ajustarCantidad(id, Math.abs(cantidad));
        if (!respaldo) throw new Error('No se encontró el juguete para devolver las unidades.');
        const nuevo = {
            ...ServicioStockSupabase.camposJuguete(respaldo),
            cantidad: Math.abs(cantidad),
            bodega_id: respaldo.bodega_id || null,
            tienda_id: respaldo.bodega_id ? null : (respaldo.tienda_id || null)
        };
        const { data, error } = await this.cliente.from('juguetes').insert(nuevo).select().single();
        if (error) throw error;
        return { anterior: 0, nueva: data.cantidad, fila: data, recreado: true };
    }

    /**
     * Mueve unidades de un registro de juguete a otra ubicación (bodega o tienda).
     * Si en el destino ya existe el mismo código, suma la cantidad; si no, crea el registro
     * copiando todos los datos del origen.
     * @returns {Promise<Object>} Detalle necesario para revertir el movimiento.
     */
    async transferir({ jugueteOrigenId, cantidad, destinoTipo, destinoId, empresaId }) {
        const origen = await this.obtener(jugueteOrigenId);
        if (!origen) throw new Error('El juguete de origen ya no existe.');
        const campoDestino = destinoTipo === 'bodega' ? 'bodega_id' : 'tienda_id';
        if (String(origen[campoDestino]) === String(destinoId)) {
            throw new Error('El origen y el destino son la misma ubicación.');
        }

        // 1. Descontar del origen (valida stock y concurrencia)
        const { nueva: restanteOrigen } = await this.descontar(origen.id, cantidad);

        try {
            // 2. Sumar en el destino (mismo código en esa ubicación)
            const { data: existentes, error } = await this.cliente
                .from('juguetes')
                .select('*')
                .eq('codigo', origen.codigo)
                .eq('empresa_id', empresaId)
                .eq(campoDestino, destinoId)
                .limit(1);
            if (error) throw error;

            if (existentes && existentes.length > 0) {
                const destino = existentes[0];
                await this.ajustarCantidad(destino.id, cantidad);
                // Completar datos faltantes en el destino con los del origen
                const completar = {};
                ['item', 'precio_min', 'precio_por_mayor', 'numero_bultos', 'cantidad_por_bulto', 'foto_url'].forEach(c => {
                    if (!destino[c] && origen[c]) completar[c] = origen[c];
                });
                if (Object.keys(completar).length > 0) {
                    const { error: errCompletar } = await this.cliente.from('juguetes').update(completar).eq('id', destino.id);
                    if (errCompletar) console.warn('No se pudieron completar datos del destino:', errCompletar);
                }
                await this.eliminarOrigenSiVacio(origen.id, restanteOrigen);
                return { jugueteOrigenId: origen.id, jugueteDestinoId: destino.id, creadoEnDestino: false, cantidad, origen };
            }

            const nuevo = {
                ...ServicioStockSupabase.camposJuguete(origen),
                empresa_id: empresaId,
                cantidad,
                bodega_id: destinoTipo === 'bodega' ? destinoId : null,
                tienda_id: destinoTipo === 'tienda' ? destinoId : null
            };
            const { data: creado, error: errCrear } = await this.cliente.from('juguetes').insert(nuevo).select().single();
            if (errCrear) throw errCrear;
            await this.eliminarOrigenSiVacio(origen.id, restanteOrigen);
            return { jugueteOrigenId: origen.id, jugueteDestinoId: creado.id, creadoEnDestino: true, cantidad, origen };
        } catch (error) {
            // Compensar: devolver las unidades al origen para no perder stock
            try {
                await this.reponer(origen.id, cantidad, origen);
            } catch (errCompensacion) {
                console.error('No se pudo compensar el origen tras un error en el destino:', errCompensacion);
            }
            throw error;
        }
    }

    /**
     * Mantiene el comportamiento previo de los movimientos: si el origen queda en 0 se elimina
     * el registro (al deshacer se recrea con todos sus datos). Solo borra si sigue en 0.
     */
    async eliminarOrigenSiVacio(id, restante) {
        if (restante !== 0) return;
        const { error } = await this.cliente.from('juguetes').delete().eq('id', id).eq('cantidad', 0);
        if (error) console.warn('No se pudo eliminar el registro vacío de origen:', error);
    }

    /**
     * Resume el inventario de una ubicación (para impedir borrar tiendas/bodegas con stock:
     * la BD tiene ON DELETE SET NULL y los juguetes quedarían sin ubicación, invisibles).
     * @param {'tienda'|'bodega'} tipo
     * @returns {Promise<{registros: number, unidades: number}>}
     */
    async resumenUbicacion(tipo, id) {
        const campo = tipo === 'bodega' ? 'bodega_id' : 'tienda_id';
        const { data, error } = await this.cliente.from('juguetes').select('cantidad').eq(campo, id);
        if (error) throw error;
        return {
            registros: (data || []).length,
            unidades: (data || []).reduce((suma, fila) => suma + (fila.cantidad || 0), 0)
        };
    }

    /** Revierte un movimiento hecho con transferir(). */
    async revertirTransferencia(detalle) {
        if (detalle.creadoEnDestino) {
            const destino = await this.obtener(detalle.jugueteDestinoId);
            if (destino) {
                if ((destino.cantidad || 0) < detalle.cantidad) {
                    throw new Error(`El destino ya no tiene las ${detalle.cantidad} unidades de "${destino.nombre}" (quedan ${destino.cantidad}).`);
                }
                if ((destino.cantidad || 0) === detalle.cantidad) {
                    const { error } = await this.cliente.from('juguetes').delete().eq('id', destino.id).eq('cantidad', detalle.cantidad);
                    if (error) throw error;
                } else {
                    await this.descontar(destino.id, detalle.cantidad);
                }
            }
        } else {
            await this.descontar(detalle.jugueteDestinoId, detalle.cantidad);
        }
        await this.reponer(detalle.jugueteOrigenId, detalle.cantidad, detalle.origen);
    }
}

if (typeof window !== 'undefined') {
    window.ServicioStockSupabase = ServicioStockSupabase;
    // Instancia compartida (el cliente se crea en config.js, que se carga antes)
    if (window.supabaseClient) window.servicioStock = new ServicioStockSupabase(window.supabaseClient);
}
