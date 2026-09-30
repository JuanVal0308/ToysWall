/**
 * Importación de inventario desde Excel — capa de INFRAESTRUCTURA.
 * Lee el contexto (tiendas, bodegas, inventario) de Supabase y aplica el plan calculado por
 * ReglasImportacionInventario: actualiza por código + ubicación o crea el registro.
 * Cada fila se aplica por separado y se informa su resultado (no se detiene en el primer error).
 * Solo administradores (lo exige RLS en juguetes).
 */
class ServicioImportacionInventario {
    constructor(clienteSupabase) {
        this.cliente = clienteSupabase;
    }

    /** Lee todas las filas de una consulta paginando de 1000 en 1000 (límite de PostgREST). */
    async leerTodo(construirConsulta) {
        const tamano = 1000;
        const filas = [];
        for (let desde = 0; ; desde += tamano) {
            const { data, error } = await construirConsulta().range(desde, desde + tamano - 1);
            if (error) throw error;
            filas.push(...(data || []));
            if (!data || data.length < tamano) return filas;
        }
    }

    async cargarContexto(empresaId) {
        const [tiendas, bodegas, juguetes] = await Promise.all([
            this.leerTodo(() => this.cliente.from('tiendas').select('id, nombre').eq('empresa_id', empresaId).order('id')),
            this.leerTodo(() => this.cliente.from('bodegas').select('id, nombre').eq('empresa_id', empresaId).order('id')),
            this.leerTodo(() => this.cliente.from('juguetes')
                .select('id, codigo, nombre, cantidad, tienda_id, bodega_id')
                .eq('empresa_id', empresaId)
                .order('id'))
        ]);
        return { tiendas, bodegas, juguetes };
    }

    /**
     * Aplica el plan.
     * @param {Array} plan - Resultado de ReglasImportacionInventario.planificar()
     * @param {'reemplazar'|'sumar'} modo
     * @param {number} empresaId
     * @param {(hechos:number, total:number) => void} [alProgresar]
     * @returns {Promise<{creados:number, actualizados:number, fallidos:Array<{numeroFila:number, codigo:string, motivo:string}>}>}
     */
    async aplicar(plan, modo, empresaId, alProgresar = null) {
        const resultado = { creados: 0, actualizados: 0, fallidos: [] };
        let hechos = 0;
        for (const paso of plan) {
            const { fila } = paso;
            try {
                if (paso.accion === 'crear') {
                    await this.crear(fila, empresaId);
                    resultado.creados++;
                } else {
                    await this.actualizar(paso, modo);
                    resultado.actualizados++;
                }
            } catch (error) {
                resultado.fallidos.push({ numeroFila: fila.numeroFila, codigo: fila.codigo, motivo: error.message || String(error) });
            }
            hechos++;
            if (alProgresar) alProgresar(hechos, plan.length);
        }
        return resultado;
    }

    static camposOpcionales(fila) {
        const campos = {};
        ['item', 'precio_min', 'precio_por_mayor', 'numero_bultos', 'cantidad_por_bulto', 'foto_url'].forEach(c => {
            if (fila[c] !== undefined) campos[c] = fila[c];
        });
        return campos;
    }

    async crear(fila, empresaId) {
        const { error } = await this.cliente.from('juguetes').insert({
            codigo: fila.codigo,
            nombre: fila.nombre,
            cantidad: fila.cantidad,
            empresa_id: empresaId,
            tienda_id: fila.tipoUbicacion === 'tienda' ? fila.ubicacionId : null,
            bodega_id: fila.tipoUbicacion === 'bodega' ? fila.ubicacionId : null,
            ...ServicioImportacionInventario.camposOpcionales(fila)
        });
        if (error) throw error;
    }

    async actualizar(paso, modo) {
        const campos = ServicioImportacionInventario.camposOpcionales(paso.fila);
        if (modo === 'sumar') {
            // Suma sobre la cantidad ACTUAL con control de concurrencia (por si cambió desde la vista previa)
            if (Object.keys(campos).length) {
                const { error } = await this.cliente.from('juguetes').update(campos).eq('id', paso.jugueteId);
                if (error) throw error;
            }
            if (paso.fila.cantidad > 0) {
                if (!window.servicioStock) throw new Error('Servicio de stock no disponible');
                await window.servicioStock.ajustarCantidad(paso.jugueteId, paso.fila.cantidad);
            }
            return;
        }
        const { data, error } = await this.cliente.from('juguetes')
            .update({ ...campos, cantidad: paso.fila.cantidad })
            .eq('id', paso.jugueteId)
            .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('el registro ya no existe o no tienes permiso para modificarlo');
    }
}

if (typeof window !== 'undefined') {
    window.ServicioImportacionInventario = ServicioImportacionInventario;
    if (window.supabaseClient) window.servicioImportacionInventario = new ServicioImportacionInventario(window.supabaseClient);
}
