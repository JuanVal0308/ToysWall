/**
 * Servicio de Ubicaciones
 * Maneja todas las operaciones relacionadas con tiendas, bodegas y ubicaciones
 */

class UbicacionesService {
    constructor(supabaseClient) {
        this.client = supabaseClient;
    }

    /**
     * Obtener todas las ubicaciones de una empresa
     * @param {number} empresaId - ID de la empresa
     * @param {boolean} soloActivas - Filtrar solo ubicaciones activas
     * @returns {Promise<Array>} Lista de ubicaciones
     */
    async obtenerUbicaciones(empresaId, soloActivas = true) {
        try {
            let query = this.client
                .from('ubicaciones')
                .select('*')
                .eq('empresa_id', empresaId)
                .order('tipo', { ascending: true })
                .order('nombre', { ascending: true });

            if (soloActivas) {
                query = query.eq('activo', true);
            }

            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener ubicaciones:', error);
            throw error;
        }
    }

    /**
     * Obtener ubicaciones por tipo
     * @param {number} empresaId - ID de la empresa
     * @param {string} tipo - Tipo de ubicación: 'tienda', 'bodega', 'general'
     * @returns {Promise<Array>} Lista de ubicaciones
     */
    async obtenerUbicacionesPorTipo(empresaId, tipo) {
        try {
            const { data, error } = await this.client
                .from('ubicaciones')
                .select('*')
                .eq('empresa_id', empresaId)
                .eq('tipo', tipo)
                .eq('activo', true)
                .order('nombre', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error(`Error al obtener ubicaciones tipo ${tipo}:`, error);
            throw error;
        }
    }

    /**
     * Obtener una ubicación por ID
     * @param {number} ubicacionId - ID de la ubicación
     * @returns {Promise<Object>} Ubicación
     */
    async obtenerUbicacionPorId(ubicacionId) {
        try {
            const { data, error } = await this.client
                .from('ubicaciones')
                .select('*')
                .eq('id', ubicacionId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al obtener ubicación:', error);
            throw error;
        }
    }

    /**
     * Crear una nueva ubicación
     * @param {Object} ubicacionData - Datos de la ubicación
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Object>} Ubicación creada
     */
    async crearUbicacion(ubicacionData, empresaId) {
        try {
            const { data, error } = await this.client
                .from('ubicaciones')
                .insert({
                    ...ubicacionData,
                    empresa_id: empresaId
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al crear ubicación:', error);
            throw error;
        }
    }

    /**
     * Actualizar una ubicación
     * @param {number} ubicacionId - ID de la ubicación
     * @param {Object} datosActualizacion - Datos a actualizar
     * @returns {Promise<Object>} Ubicación actualizada
     */
    async actualizarUbicacion(ubicacionId, datosActualizacion) {
        try {
            const { data, error } = await this.client
                .from('ubicaciones')
                .update(datosActualizacion)
                .eq('id', ubicacionId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al actualizar ubicación:', error);
            throw error;
        }
    }

    /**
     * Desactivar una ubicación (soft delete)
     * @param {number} ubicacionId - ID de la ubicación
     * @returns {Promise<Object>} Resultado
     */
    async desactivarUbicacion(ubicacionId) {
        try {
            const { data, error } = await this.client
                .from('ubicaciones')
                .update({ activo: false })
                .eq('id', ubicacionId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al desactivar ubicación:', error);
            throw error;
        }
    }

    /**
     * Obtener tiendas (legacy - para compatibilidad)
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Array>} Lista de tiendas
     */
    async obtenerTiendas(empresaId) {
        try {
            const { data, error } = await this.client
                .from('tiendas')
                .select('*')
                .eq('empresa_id', empresaId)
                .order('nombre', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener tiendas:', error);
            throw error;
        }
    }

    /**
     * Obtener bodegas (legacy - para compatibilidad)
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Array>} Lista de bodegas
     */
    async obtenerBodegas(empresaId) {
        try {
            const { data, error } = await this.client
                .from('bodegas')
                .select('*')
                .eq('empresa_id', empresaId)
                .order('nombre', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener bodegas:', error);
            throw error;
        }
    }

    /**
     * Obtener inventario de una ubicación específica
     * @param {number} ubicacionId - ID de la ubicación
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Array>} Lista de productos con stock en esa ubicación
     */
    async obtenerInventarioDeUbicacion(ubicacionId, empresaId) {
        try {
            const { data, error } = await this.client
                .from('inventario_por_ubicacion')
                .select(`
                    *,
                    juguetes:juguete_codigo (
                        id,
                        nombre,
                        codigo,
                        item,
                        foto_url,
                        precio_min,
                        precio_por_mayor
                    )
                `)
                .eq('ubicacion_id', ubicacionId)
                .eq('empresa_id', empresaId)
                .order('juguete_codigo', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener inventario de ubicación:', error);
            throw error;
        }
    }
}

// Exportar servicio
window.UbicacionesService = UbicacionesService;
