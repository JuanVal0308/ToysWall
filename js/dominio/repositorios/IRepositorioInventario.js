/**
 * Interfaz: IRepositorioInventario
 * Define el contrato para operaciones de inventario por ubicación
 * Principio DIP: Dependencia de abstracción, no de implementación concreta
 * Principio ISP: Interface segregada específica para inventario
 */
class IRepositorioInventario {
    /**
     * Obtener inventario de una empresa
     * @param {number} empresaId - ID de la empresa
     * @param {number|null} ubicacionId - ID de ubicación (null para todas)
     * @returns {Promise<InventarioUbicacion[]>}
     */
    async obtenerInventario(empresaId, ubicacionId = null) {
        throw new Error('Método obtenerInventario() debe ser implementado');
    }

    /**
     * Obtener inventario consolidado (sumado por código)
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Object[]>}
     */
    async obtenerInventarioConsolidado(empresaId) {
        throw new Error('Método obtenerInventarioConsolidado() debe ser implementado');
    }

    /**
     * Obtener cantidad total de un producto (todas las ubicaciones)
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<number>}
     */
    async obtenerCantidadTotal(jugueteCodigo, empresaId) {
        throw new Error('Método obtenerCantidadTotal() debe ser implementado');
    }

    /**
     * Actualizar cantidad en una ubicación
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} ubicacionId - ID de la ubicación
     * @param {number} cantidad - Nueva cantidad
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<InventarioUbicacion>}
     */
    async actualizarCantidad(jugueteCodigo, ubicacionId, cantidad, empresaId) {
        throw new Error('Método actualizarCantidad() debe ser implementado');
    }

    /**
     * Agregar inventario en una ubicación
     * @param {InventarioUbicacion} inventario - Inventario a agregar
     * @returns {Promise<InventarioUbicacion>}
     */
    async agregar(inventario) {
        throw new Error('Método agregar() debe ser implementado');
    }

    /**
     * Transferir inventario entre ubicaciones
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} ubicacionOrigenId - ID de ubicación origen
     * @param {number} ubicacionDestinoId - ID de ubicación destino
     * @param {number} cantidad - Cantidad a transferir
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<boolean>}
     */
    async transferir(jugueteCodigo, ubicacionOrigenId, ubicacionDestinoId, cantidad, empresaId) {
        throw new Error('Método transferir() debe ser implementado');
    }
}

// Exportar
window.IRepositorioInventario = IRepositorioInventario;
