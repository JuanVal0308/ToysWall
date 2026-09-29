/**
 * Implementación: RepositorioUbicacionesSupabase
 * Implementa IRepositorioUbicaciones usando Supabase como backend
 * Principio DIP: Implementa la abstracción definida en el dominio
 * Principio LSP: Sustituible por cualquier otra implementación de IRepositorioUbicaciones
 */
class RepositorioUbicacionesSupabase extends IRepositorioUbicaciones {
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
    async obtenerTodas(empresaId, soloActivas = true) {
        let query = this.cliente
            .from('ubicaciones')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('tipo', { ascending: true })
            .order('nombre', { ascending: true });

        if (soloActivas) {
            query = query.eq('activo', true);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Error al obtener ubicaciones: ${error.message}`);
        
        return (data || []).map(d => Ubicacion.desdeDatos(d));
    }

    /**
     * @inheritdoc
     */
    async obtenerPorId(id) {
        const { data, error } = await this.cliente
            .from('ubicaciones')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No encontrado
            throw new Error(`Error al obtener ubicación: ${error.message}`);
        }

        return data ? Ubicacion.desdeDatos(data) : null;
    }

    /**
     * @inheritdoc
     */
    async obtenerPorTipo(empresaId, tipo) {
        const { data, error } = await this.cliente
            .from('ubicaciones')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('tipo', tipo)
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (error) throw new Error(`Error al obtener ubicaciones por tipo: ${error.message}`);
        
        return (data || []).map(d => Ubicacion.desdeDatos(d));
    }

    /**
     * @inheritdoc
     */
    async crear(ubicacion) {
        if (!ubicacion.esValida()) {
            throw new Error('Datos de ubicación inválidos');
        }

        const { data, error } = await this.cliente
            .from('ubicaciones')
            .insert(ubicacion.aDatos())
            .select()
            .single();

        if (error) throw new Error(`Error al crear ubicación: ${error.message}`);
        
        return Ubicacion.desdeDatos(data);
    }

    /**
     * @inheritdoc
     */
    async actualizar(id, datosActualizacion) {
        const { data, error } = await this.cliente
            .from('ubicaciones')
            .update(datosActualizacion)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Error al actualizar ubicación: ${error.message}`);
        
        return Ubicacion.desdeDatos(data);
    }

    /**
     * @inheritdoc
     */
    async desactivar(id) {
        const { error } = await this.cliente
            .from('ubicaciones')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw new Error(`Error al desactivar ubicación: ${error.message}`);
        
        return true;
    }
}

// Exportar
window.RepositorioUbicacionesSupabase = RepositorioUbicacionesSupabase;
