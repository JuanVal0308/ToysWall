/**
 * Controlador: ControladorInventario
 * Maneja las interacciones del usuario con el inventario
 * Principio SRP: Responsabilidad única de coordinar UI de inventario
 * Principio DIP: Depende de abstracciones (casos de uso) no de implementaciones
 */
class ControladorInventario {
    /**
     * @param {ObtenerInventarioConsolidado} casoUsoObtenerInventario
     * @param {ActualizarJuguete} casoUsoActualizarJuguete
     * @param {ActualizarInventarioUbicacion} casoUsoActualizarInventarioUbicacion
     * @param {ObtenerUbicaciones} casoUsoObtenerUbicaciones
     */
    constructor(
        casoUsoObtenerInventario,
        casoUsoActualizarJuguete,
        casoUsoActualizarInventarioUbicacion,
        casoUsoObtenerUbicaciones
    ) {
        this.casoUsoObtenerInventario = casoUsoObtenerInventario;
        this.casoUsoActualizarJuguete = casoUsoActualizarJuguete;
        this.casoUsoActualizarInventarioUbicacion = casoUsoActualizarInventarioUbicacion;
        this.casoUsoObtenerUbicaciones = casoUsoObtenerUbicaciones;
        
        this.inventarioActual = [];
        this.ubicacionesDisponibles = [];
    }

    /**
     * Cargar inventario detalle
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<void>}
     */
    async cargarInventarioDetalle(empresaId) {
        try {
            const resultado = await this.casoUsoObtenerInventario.ejecutar(empresaId);
            
            if (!resultado.exito) {
                this.mostrarError(resultado.mensaje);
                return;
            }

            this.inventarioActual = resultado.datos || [];
            return this.inventarioActual;
        } catch (error) {
            console.error('Error al cargar inventario detalle:', error);
            this.mostrarError('Error al cargar el inventario: ' + error.message);
            throw error;
        }
    }

    /**
     * Cargar ubicaciones disponibles
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Ubicacion[]>}
     */
    async cargarUbicaciones(empresaId) {
        try {
            const resultado = await this.casoUsoObtenerUbicaciones.ejecutar(empresaId, true);
            
            if (!resultado.exito) {
                this.mostrarError(resultado.mensaje);
                return [];
            }

            this.ubicacionesDisponibles = resultado.datos || [];
            return this.ubicacionesDisponibles;
        } catch (error) {
            console.error('Error al cargar ubicaciones:', error);
            this.mostrarError('Error al cargar ubicaciones: ' + error.message);
            return [];
        }
    }

    /**
     * Actualizar juguete
     * @param {number} jugueteId - ID del juguete
     * @param {Object} datosActualizacion - Datos a actualizar
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<{exito: boolean, mensaje: string}>}
     */
    async actualizarJuguete(jugueteId, datosActualizacion, empresaId) {
        try {
            const resultado = await this.casoUsoActualizarJuguete.ejecutar(
                jugueteId,
                datosActualizacion,
                empresaId
            );

            if (resultado.exito) {
                this.mostrarExito(resultado.mensaje);
            } else {
                this.mostrarError(resultado.mensaje);
            }

            return resultado;
        } catch (error) {
            console.error('Error al actualizar juguete:', error);
            const mensaje = 'Error al actualizar juguete: ' + error.message;
            this.mostrarError(mensaje);
            return { exito: false, mensaje };
        }
    }

    /**
     * Actualizar cantidad en ubicación
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} ubicacionId - ID de la ubicación
     * @param {number} cantidad - Nueva cantidad
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<{exito: boolean, mensaje: string}>}
     */
    async actualizarCantidadEnUbicacion(jugueteCodigo, ubicacionId, cantidad, empresaId) {
        try {
            const resultado = await this.casoUsoActualizarInventarioUbicacion.ejecutar(
                jugueteCodigo,
                ubicacionId,
                cantidad,
                empresaId
            );

            if (resultado.exito) {
                this.mostrarExito(resultado.mensaje);
            } else {
                this.mostrarError(resultado.mensaje);
            }

            return resultado;
        } catch (error) {
            console.error('Error al actualizar cantidad:', error);
            const mensaje = 'Error al actualizar cantidad: ' + error.message;
            this.mostrarError(mensaje);
            return { exito: false, mensaje };
        }
    }

    /**
     * Mostrar mensaje de error en la UI
     * @param {string} mensaje - Mensaje a mostrar
     */
    mostrarError(mensaje) {
        // Esta función será sobrescrita o implementada en el contexto específico de la UI
        console.error(mensaje);
    }

    /**
     * Mostrar mensaje de éxito en la UI
     * @param {string} mensaje - Mensaje a mostrar
     */
    mostrarExito(mensaje) {
        // Esta función será sobrescrita o implementada en el contexto específico de la UI
        console.log(mensaje);
    }
}

// Exportar
window.ControladorInventario = ControladorInventario;
