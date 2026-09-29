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
        // Convertir ID a entero
        const idNumerico = parseInt(id);
        if (isNaN(idNumerico)) {
            throw new Error('ID de juguete inválido');
        }

        // Obtener juguete original
        const { data: jugueteOriginal, error: fetchError } = await this.cliente
            .from('juguetes')
            .select('codigo, nombre')
            .eq('id', idNumerico)
            .eq('empresa_id', empresaId)
            .single();

        if (fetchError) throw new Error(`Error al obtener juguete original: ${fetchError.message}`);
        if (!jugueteOriginal) throw new Error('Juguete no encontrado');

        const codigoCambio = jugueteOriginal.codigo !== datosActualizacion.codigo;
        const nombreCambio = jugueteOriginal.nombre !== datosActualizacion.nombre;

        // Si cambió código o nombre, actualizar todos los registros con ese código
        if (codigoCambio || nombreCambio) {
            // Actualizar código y nombre en todos los registros
            const { error: updateAllError } = await this.cliente
                .from('juguetes')
                .update({
                    nombre: datosActualizacion.nombre,
                    codigo: datosActualizacion.codigo
                })
                .eq('codigo', jugueteOriginal.codigo)
                .eq('nombre', jugueteOriginal.nombre)
                .eq('empresa_id', empresaId);

            if (updateAllError) throw new Error(`Error al actualizar código/nombre: ${updateAllError.message}`);

            // Actualizar el registro específico con todos los campos
            const { error: updateError } = await this.cliente
                .from('juguetes')
                .update(datosActualizacion)
                .eq('id', idNumerico)
                .eq('empresa_id', empresaId);

            if (updateError) throw new Error(`Error al actualizar juguete específico: ${updateError.message}`);
        } else {
            // Actualizar solo este registro
            const { error: updateError } = await this.cliente
                .from('juguetes')
                .update(datosActualizacion)
                .eq('id', idNumerico)
                .eq('empresa_id', empresaId);

            if (updateError) throw new Error(`Error al actualizar juguete: ${updateError.message}`);
        }

        // Sincronizar precios en todos los registros del mismo código
        const { error: syncPreciosError } = await this.cliente
            .from('juguetes')
            .update({
                precio_min: datosActualizacion.precio_min,
                precio_por_mayor: datosActualizacion.precio_por_mayor
            })
            .eq('codigo', datosActualizacion.codigo)
            .eq('empresa_id', empresaId);

        if (syncPreciosError) throw new Error(`Error al sincronizar precios: ${syncPreciosError.message}`);

        return await this.obtenerPorId(idNumerico);
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
