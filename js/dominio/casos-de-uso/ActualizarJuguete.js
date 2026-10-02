/**
 * Caso de Uso: ActualizarJuguete
 * Coordina la actualización de un juguete
 * Principio SRP: Responsabilidad única de actualizar juguetes
 * Principio OCP: Abierto para extensión (validaciones adicionales)
 */
class ActualizarJuguete {
    /**
     * @param {IRepositorioJuguetes} repositorioJuguetes - Repositorio de juguetes
     */
    constructor(repositorioJuguetes) {
        if (!(repositorioJuguetes instanceof IRepositorioJuguetes)) {
            throw new Error('Se requiere una instancia de IRepositorioJuguetes');
        }
        this.repositorioJuguetes = repositorioJuguetes;
    }

    /**
     * Ejecutar el caso de uso
     * @param {number} jugueteId - ID del juguete a actualizar
     * @param {Object} datosActualizacion - Datos a actualizar
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<{exito: boolean, mensaje: string, datos?: any}>}
     */
    async ejecutar(jugueteId, datosActualizacion, empresaId) {
        try {
            // Validación: ID debe ser numérico
            const id = parseInt(jugueteId);
            if (isNaN(id)) {
                return {
                    exito: false,
                    mensaje: 'ID de juguete inválido'
                };
            }

            // Validación: Datos básicos
            if (!datosActualizacion.nombre || !datosActualizacion.codigo) {
                return {
                    exito: false,
                    mensaje: 'Nombre y código son obligatorios'
                };
            }

            // Validación: Precios válidos
            if (datosActualizacion.precio_min < 0) {
                return {
                    exito: false,
                    mensaje: 'El precio mínimo no puede ser negativo'
                };
            }

            // Validación: Si hay precio por mayor, debe ser válido
            if (datosActualizacion.precio_por_mayor !== null && 
                datosActualizacion.precio_por_mayor !== undefined &&
                datosActualizacion.precio_por_mayor < 0) {
                return {
                    exito: false,
                    mensaje: 'El precio por mayor no puede ser negativo'
                };
            }

            // Verificar el código: solo se rechaza si lo usa un producto DISTINTO.
            // Las filas del mismo juguete en otras tiendas/bodegas (mismo código y nombre,
            // sin distinguir mayúsculas, tildes ni espacios) no cuentan como duplicado.
            const reglas = window.ReglasEdicionJuguete;
            const original = await this.repositorioJuguetes.obtenerFilaParaEdicion(id);
            const empresaReal = original.empresa_id ?? empresaId;
            const filasProducto = reglas.filasDelProducto(
                await this.repositorioJuguetes.buscarFilasPorCodigo(original.codigo, empresaReal),
                original
            );
            const filasCodigoNuevo = reglas.mismoTexto(datosActualizacion.codigo, original.codigo)
                ? []
                : await this.repositorioJuguetes.buscarFilasPorCodigo(datosActualizacion.codigo, empresaReal);
            const validacion = reglas.validarCodigo(filasCodigoNuevo, {
                original,
                codigoNuevo: datosActualizacion.codigo,
                nombreNuevo: datosActualizacion.nombre,
                filasProducto
            });

            if (!validacion.valido) {
                return {
                    exito: false,
                    mensaje: validacion.mensaje
                };
            }

            if (datosActualizacion.cantidad !== undefined) {
                const cantidad = Number(datosActualizacion.cantidad);
                if (!Number.isInteger(cantidad) || cantidad < 0) {
                    return {
                        exito: false,
                        mensaje: 'La cantidad debe ser un número entero mayor o igual a 0'
                    };
                }
            }

            // Ejecutar actualización
            await this.repositorioJuguetes.actualizar(id, datosActualizacion, empresaId);

            return {
                exito: true,
                mensaje: 'Juguete actualizado correctamente'
            };
        } catch (error) {
            console.error('Error en ActualizarJuguete:', error);
            return {
                exito: false,
                mensaje: `Error al actualizar juguete: ${error.message}`
            };
        }
    }
}

// Exportar
window.ActualizarJuguete = ActualizarJuguete;
