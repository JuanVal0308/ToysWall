/**
 * Interfaz: IRepositorioJuguetes
 * Define el contrato para operaciones de persistencia de juguetes
 * Principio DIP: Dependencia de abstracción, no de implementación concreta
 * Principio ISP: Interface segregada específica para juguetes
 */
class IRepositorioJuguetes {
    /**
     * Obtener todos los juguetes de una empresa
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Juguete[]>}
     */
    async obtenerTodos(empresaId) {
        throw new Error('Método obtenerTodos() debe ser implementado');
    }

    /**
     * Obtener un juguete por ID
     * @param {number} id - ID del juguete
     * @returns {Promise<Juguete|null>}
     */
    async obtenerPorId(id) {
        throw new Error('Método obtenerPorId() debe ser implementado');
    }

    /**
     * Obtener juguetes por código
     * @param {string} codigo - Código del juguete
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Juguete[]>}
     */
    async obtenerPorCodigo(codigo, empresaId) {
        throw new Error('Método obtenerPorCodigo() debe ser implementado');
    }

    /**
     * Crear un nuevo juguete
     * @param {Juguete} juguete - Juguete a crear
     * @returns {Promise<Juguete>}
     */
    async crear(juguete) {
        throw new Error('Método crear() debe ser implementado');
    }

    /**
     * Actualizar un juguete existente
     * @param {number} id - ID del juguete
     * @param {Object} datosActualizacion - Datos a actualizar
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Juguete>}
     */
    async actualizar(id, datosActualizacion, empresaId) {
        throw new Error('Método actualizar() debe ser implementado');
    }

    /**
     * Eliminar un juguete
     * @param {number} id - ID del juguete
     * @returns {Promise<boolean>}
     */
    async eliminar(id) {
        throw new Error('Método eliminar() debe ser implementado');
    }

    /**
     * Fila cruda de un juguete para editarlo (id, codigo, nombre, empresa_id, tienda_id, bodega_id, cantidad)
     * @param {number} id
     * @returns {Promise<Object>}
     */
    async obtenerFilaParaEdicion(id) {
        throw new Error('Método obtenerFilaParaEdicion() debe ser implementado');
    }

    /**
     * Filas cuyo código coincide sin distinguir mayúsculas, tildes ni espacios
     * @param {string} codigo
     * @param {number} empresaId
     * @returns {Promise<Object[]>}
     */
    async buscarFilasPorCodigo(codigo, empresaId) {
        throw new Error('Método buscarFilasPorCodigo() debe ser implementado');
    }

    /**
     * Verificar si existe un juguete con un código
     * @param {string} codigo - Código a verificar
     * @param {number} empresaId - ID de la empresa
     * @param {number|null} excluirId - ID a excluir de la búsqueda
     * @returns {Promise<boolean>}
     */
    async existeCodigo(codigo, empresaId, excluirId = null) {
        throw new Error('Método existeCodigo() debe ser implementado');
    }
}

// Exportar
window.IRepositorioJuguetes = IRepositorioJuguetes;
