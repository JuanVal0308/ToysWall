/**
 * Interfaz: IRepositorioUbicaciones
 * Define el contrato para operaciones de persistencia de ubicaciones
 * Principio DIP: Dependencia de abstracción, no de implementación concreta
 * Principio ISP: Interface segregada específica para ubicaciones
 */
class IRepositorioUbicaciones {
    /**
     * Obtener todas las ubicaciones de una empresa
     * @param {number} empresaId - ID de la empresa
     * @param {boolean} soloActivas - Si filtrar solo activas
     * @returns {Promise<Ubicacion[]>}
     */
    async obtenerTodas(empresaId, soloActivas = true) {
        throw new Error('Método obtenerTodas() debe ser implementado');
    }

    /**
     * Obtener una ubicación por ID
     * @param {number} id - ID de la ubicación
     * @returns {Promise<Ubicacion|null>}
     */
    async obtenerPorId(id) {
        throw new Error('Método obtenerPorId() debe ser implementado');
    }

    /**
     * Obtener ubicaciones por tipo
     * @param {number} empresaId - ID de la empresa
     * @param {string} tipo - Tipo de ubicación ('tienda', 'bodega', 'general')
     * @returns {Promise<Ubicacion[]>}
     */
    async obtenerPorTipo(empresaId, tipo) {
        throw new Error('Método obtenerPorTipo() debe ser implementado');
    }

    /**
     * Crear una nueva ubicación
     * @param {Ubicacion} ubicacion - Ubicación a crear
     * @returns {Promise<Ubicacion>}
     */
    async crear(ubicacion) {
        throw new Error('Método crear() debe ser implementado');
    }

    /**
     * Actualizar una ubicación existente
     * @param {number} id - ID de la ubicación
     * @param {Object} datosActualizacion - Datos a actualizar
     * @returns {Promise<Ubicacion>}
     */
    async actualizar(id, datosActualizacion) {
        throw new Error('Método actualizar() debe ser implementado');
    }

    /**
     * Desactivar una ubicación (soft delete)
     * @param {number} id - ID de la ubicación
     * @returns {Promise<boolean>}
     */
    async desactivar(id) {
        throw new Error('Método desactivar() debe ser implementado');
    }
}

// Exportar
window.IRepositorioUbicaciones = IRepositorioUbicaciones;
