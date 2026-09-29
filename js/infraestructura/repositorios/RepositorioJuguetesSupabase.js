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

        // SOLUCIÓN SIMPLE: Update directo por ID, sin lógica compleja de cascada
        // El modelo actual ya soporta múltiples filas por código (una por ubicación)
        // Solo actualizamos LA FILA específica que el usuario está editando
        
        const { data: updated, error: updateError } = await this.cliente
            .from('juguetes')
            .update(datosActualizacion)
            .eq('id', idNumerico)
            .select();

        if (updateError) {
            throw new Error(`Error al actualizar juguete: ${updateError.message}`);
        }
        
        if (!updated || updated.length === 0) {
            throw new Error(`No se encontró el juguete con ID ${idNumerico}. Verifica que existe y que tienes permisos.`);
        }

        return Juguete.desdeDatos(updated[0]);
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
