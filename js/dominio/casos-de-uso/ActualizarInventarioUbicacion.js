/**
 * Caso de Uso: ActualizarInventarioUbicacion
 * Actualiza la cantidad de un producto en una ubicación específica
 * Principio SRP: Responsabilidad única de actualizar inventario por ubicación
 */
class ActualizarInventarioUbicacion {
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
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} ubicacionId - ID de la ubicación
     * @param {number} cantidad - Nueva cantidad
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<{exito: boolean, mensaje: string, datos?: any}>}
     */
    async ejecutar(jugueteCodigo, ubicacionId, cantidad, empresaId) {
        try {
            // Validaciones
            if (!jugueteCodigo) {
                return {
                    exito: false,
                    mensaje: 'Código de juguete es requerido'
                };
            }

            if (!ubicacionId || !empresaId) {
                return {
                    exito: false,
                    mensaje: 'Ubicación y empresa son requeridos'
                };
            }

            const cantidadNumerica = parseInt(cantidad);
            if (isNaN(cantidadNumerica) || cantidadNumerica < 0) {
                return {
                    exito: false,
                    mensaje: 'La cantidad debe ser un número positivo'
                };
            }

            // Ejecutar actualización
            const resultado = await this.repositorioInventario.actualizarCantidad(
                jugueteCodigo,
                ubicacionId,
                cantidadNumerica,
                empresaId
            );

            return {
                exito: true,
                mensaje: 'Inventario actualizado correctamente',
                datos: resultado
            };
        } catch (error) {
            console.error('Error en ActualizarInventarioUbicacion:', error);
            return {
                exito: false,
                mensaje: `Error al actualizar inventario: ${error.message}`
            };
        }
    }
}

// Exportar
window.ActualizarInventarioUbicacion = ActualizarInventarioUbicacion;
