/**
 * Caso de Uso: ObtenerInventarioConsolidado
 * Obtiene el inventario completo consolidado por producto
 * Principio SRP: Responsabilidad única de obtener inventario consolidado
 */
class ObtenerInventarioConsolidado {
    /**
     * @param {IRepositorioInventario} repositorioInventario - Repositorio de inventario
     */
    constructor(repositorioInventario) {
        if (!(repositorioInventario instanceof IRepositorioInventario)) {
            throw new Error('Se requiere una instancia de IRepositorioInventario');
        }
        this.repositorioInventario = repositorioInventario;
    }

    /**
     * Ejecutar el caso de uso
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<{exito: boolean, datos?: any[], mensaje?: string}>}
     */
    async ejecutar(empresaId) {
        try {
            if (!empresaId) {
                return {
                    exito: false,
                    mensaje: 'ID de empresa es requerido'
                };
            }

            const inventario = await this.repositorioInventario.obtenerInventarioConsolidado(empresaId);

            return {
                exito: true,
                datos: inventario
            };
        } catch (error) {
            console.error('Error en ObtenerInventarioConsolidado:', error);
            return {
                exito: false,
                mensaje: `Error al obtener inventario: ${error.message}`
            };
        }
    }
}

// Exportar
window.ObtenerInventarioConsolidado = ObtenerInventarioConsolidado;
