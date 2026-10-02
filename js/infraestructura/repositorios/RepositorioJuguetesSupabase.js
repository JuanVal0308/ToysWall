/**
 * Implementación: RepositorioJuguetesSupabase
 * Implementa IRepositorioJuguetes usando Supabase como backend
 * Principio DIP: Implementa la abstracción definida en el dominio
 * Principio LSP: Sustituible por cualquier otra implementación de IRepositorioJuguetes
 */
class RepositorioJuguetesSupabase extends IRepositorioJuguetes {
    /**
     * @param {Object} clienteSupabase - Cliente de Supabase
     */
    constructor(clienteSupabase) {
        super();
        if (!clienteSupabase) {
            throw new Error('Cliente de Supabase es requerido');
        }
        this.cliente = clienteSupabase;
    }

    /**
     * @inheritdoc
     */
    async obtenerTodos(empresaId) {
        const { data, error } = await this.cliente
            .from('juguetes')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('nombre', { ascending: true });

        if (error) throw new Error(`Error al obtener juguetes: ${error.message}`);
        
        return (data || []).map(d => Juguete.desdeDatos(d));
    }

    /**
     * @inheritdoc
     */
    async obtenerPorId(id) {
        const { data, error } = await this.cliente
            .from('juguetes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No encontrado
            throw new Error(`Error al obtener juguete: ${error.message}`);
        }

        return data ? Juguete.desdeDatos(data) : null;
    }

    /**
     * @inheritdoc
     */
    async obtenerPorCodigo(codigo, empresaId) {
        const { data, error } = await this.cliente
            .from('juguetes')
            .select('*')
            .eq('codigo', codigo)
            .eq('empresa_id', empresaId);

        if (error) throw new Error(`Error al obtener juguetes por código: ${error.message}`);
        
        return (data || []).map(d => Juguete.desdeDatos(d));
    }

    /**
     * @inheritdoc
     */
    async crear(juguete) {
        if (!juguete.esValido()) {
            throw new Error('Datos del juguete inválidos');
        }

        const { data, error } = await this.cliente
            .from('juguetes')
            .insert(juguete.aDatos())
            .select()
            .single();

        if (error) throw new Error(`Error al crear juguete: ${error.message}`);
        
        return Juguete.desdeDatos(data);
    }

    /**
     * @inheritdoc
     */
    async actualizar(id, datosActualizacion, empresaId) {
        const idNumerico = parseInt(id);
        if (isNaN(idNumerico)) {
            throw new Error('ID de juguete inválido');
        }
        const R = window.ReglasEdicionJuguete;

        // PASO 1: fila editada tal como está en la BD (código, nombre y empresa reales)
        const filaOriginal = await this.obtenerFilaParaEdicion(idNumerico);

        // PASO 2: filas del MISMO producto (mismo código y nombre normalizados) en otras ubicaciones
        const candidatas = await this.buscarFilasPorCodigo(filaOriginal.codigo, filaOriginal.empresa_id);
        const idsProducto = R.filasDelProducto(candidatas, filaOriginal)
            .map(f => f.id)
            .filter(otroId => otroId !== idNumerico);

        // PASO 3: la fila editada recibe todo (cantidad = valor absoluto de ESTA ubicación)
        const { compartidos, porUbicacion } = R.separarCampos(datosActualizacion);
        const { data: filaActualizada, error: updateError } = await this.cliente
            .from('juguetes')
            .update({ ...compartidos, ...porUbicacion })
            .eq('id', idNumerico)
            .select();

        if (updateError) {
            throw new Error(`Error al actualizar juguete: ${updateError.message}`);
        }
        if (!filaActualizada || filaActualizada.length === 0) {
            throw new Error(`No se pudo actualizar el juguete con ID ${idNumerico}. Verifica permisos.`);
        }

        // PASO 4: los campos compartidos (nombre, código, precios, ITEM, foto, cantidad por bulto)
        // se copian a las demás ubicaciones del producto; su cantidad no se toca.
        if (Object.keys(compartidos).length > 0 && idsProducto.length > 0) {
            const { data: filasHermanas, error: syncError } = await this.cliente
                .from('juguetes')
                .update(compartidos)
                .in('id', idsProducto)
                .select('id');

            if (syncError) {
                throw new Error(`Error al sincronizar campos compartidos: ${syncError.message}`);
            }
            if (filasHermanas && filasHermanas.length > 0) {
                console.log(`✓ Sincronizados campos compartidos en ${filasHermanas.length} ubicacion(es) adicional(es)`);
            }
        }

        return Juguete.desdeDatos(filaActualizada[0]);
    }

    /**
     * Fila cruda de `juguetes` para editar (código, nombre, empresa y ubicación reales).
     */
    async obtenerFilaParaEdicion(id) {
        const { data, error } = await this.cliente
            .from('juguetes')
            .select('id, codigo, nombre, empresa_id, tienda_id, bodega_id, cantidad, numero_bultos')
            .eq('id', parseInt(id))
            .single();

        if (error) throw new Error(`Error al obtener juguete: ${error.message}`);
        if (!data) throw new Error(`No se encontró el juguete con ID ${id}`);
        return data;
    }

    /**
     * Filas de la empresa cuyo código coincide sin distinguir mayúsculas, tildes ni espacios
     * (misma comparación que "Agregar juguetes").
     */
    async buscarFilasPorCodigo(codigo, empresaId) {
        const R = window.ReglasEdicionJuguete;
        const limpio = String(codigo ?? '').trim();
        if (!limpio) return [];
        // ilike no distingue mayúsculas; los espacios internos repetidos se cubren con %.
        const patron = limpio.replace(/[\\%_]/g, '\\$&').replace(/\s+/g, '%');
        let consulta = this.cliente
            .from('juguetes')
            .select('id, codigo, nombre, empresa_id, tienda_id, bodega_id, cantidad, numero_bultos')
            .ilike('codigo', patron);
        if (empresaId !== null && empresaId !== undefined) consulta = consulta.eq('empresa_id', empresaId);
        const { data, error } = await consulta;

        if (error) throw new Error(`Error al buscar juguetes por código: ${error.message}`);
        return (data || []).filter(f => R.mismoTexto(f.codigo, codigo));
    }

    /**
     * @inheritdoc
     */
    async eliminar(id) {
        const { error } = await this.cliente
            .from('juguetes')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Error al eliminar juguete: ${error.message}`);
        
        return true;
    }

    /**
     * @inheritdoc
     */
    async existeCodigo(codigo, empresaId, excluirId = null) {
        let query = this.cliente
            .from('juguetes')
            .select('id')
            .eq('codigo', codigo)
            .eq('empresa_id', empresaId);

        if (excluirId) {
            query = query.neq('id', excluirId);
        }

        const { data, error } = await query.limit(1);

        if (error) throw new Error(`Error al verificar código: ${error.message}`);
        
        return data && data.length > 0;
    }
}

// Exportar
window.RepositorioJuguetesSupabase = RepositorioJuguetesSupabase;
