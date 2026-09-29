/**
 * Caso de Uso: ObtenerUbicaciones
 * Obtiene las ubicaciones de una empresa
 * Principio SRP: Responsabilidad única de obtener ubicaciones
 */
class ObtenerUbicaciones {
    /**
     * @param {IRepositorioUbicaciones} repositorioUbicaciones - Repositorio de ubicaciones
     */
    constructor(repositorioUbicaciones) {
        if (!(repositorioUbicaciones instanceof IRepositorioUbicaciones)) {
            throw new Error('Se requiere una instancia de IRepositorioUbicaciones');
        }
        this.repositorioUbicaciones = repositorioUbicaciones;
    }

    /**
     * Ejecutar el caso de uso
     * @param {number} empresaId - ID de la empresa
     * @param {boolean} soloActivas - Si filtrar solo activas
     * @returns {Promise<{exito: boolean, datos?: Ubicacion[], mensaje?: string}>}
     */
    async ejecutar(empresaId, soloActivas = true) {
        try {
            if (!empresaId) {
                return {
                    exito: false,
                    mensaje: 'ID de empresa es requerido'
                };
            }

            const ubicaciones = await this.repositorioUbicaciones.obtenerTodas(empresaId, soloActivas);

            return {
                exito: true,
                datos: ubicaciones
            };
        } catch (error) {
            console.error('Error en ObtenerUbicaciones:', error);
            return {
                exito: false,
                mensaje: `Error al obtener ubicaciones: ${error.message}`
            };
        }
    }
}

// Exportar
window.ObtenerUbicaciones = ObtenerUbicaciones;
