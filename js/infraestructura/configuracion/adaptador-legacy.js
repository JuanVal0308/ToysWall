/**
 * Adaptador de Retrocompatibilidad
 * Permite que el código legacy funcione con la nueva arquitectura
 * Principio OCP: Extiende funcionalidad sin modificar código existente
 */

/**
 * Clase: AdaptadorInventarioLegacy
 * Adapta la interfaz legacy a la nueva arquitectura
 */
class AdaptadorInventarioLegacy {
    /**
     * @param {ControladorInventario} controladorInventario
     */
    constructor(controladorInventario) {
        this.controlador = controladorInventario;
    }

    /**
     * Cargar inventario (compatible con código legacy)
     * @returns {Promise<void>}
     */
    async loadInventario() {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user || !user.empresa_id) {
            console.error('Usuario no autenticado');
            return;
        }

        try {
            const inventario = await this.controlador.cargarInventarioDetalle(user.empresa_id);
            
            // Actualizar variable global para compatibilidad
            if (typeof window.inventarioData !== 'undefined') {
                window.inventarioData = inventario || [];
            }
            
            // Renderizar si existe la función
            if (typeof window.renderizarInventario === 'function') {
                window.renderizarInventario();
            }
        } catch (error) {
            console.error('Error al cargar inventario:', error);
        }
    }

    /**
     * Cargar inventario detalle (compatible con código legacy)
     * @returns {Promise<void>}
     */
    async loadInventarioDetalle() {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user || !user.empresa_id) {
            console.error('Usuario no autenticado');
            return;
        }

        try {
            const inventario = await this.controlador.cargarInventarioDetalle(user.empresa_id);
            
            // Actualizar variable global para compatibilidad
            if (typeof window.inventarioDetalleData !== 'undefined') {
                window.inventarioDetalleData = inventario || [];
                window.inventarioDetalleFiltrado = inventario || [];
            }
            
            // Renderizar si existe la función
            if (typeof window.renderizarInventarioDetalle === 'function') {
                window.renderizarInventarioDetalle();
            }
            
            // Actualizar total
            if (typeof window.actualizarTotalDetalle === 'function') {
                window.actualizarTotalDetalle();
            }
        } catch (error) {
            console.error('Error al cargar inventario detalle:', error);
        }
    }
}

/**
 * Función: inicializarArquitectura
 * Inicializa la nueva arquitectura y proporciona compatibilidad con código legacy
 */
function inicializarArquitectura() {
    // Verificar que Supabase esté disponible
    if (!window.supabaseClient) {
        console.error('Cliente de Supabase no disponible');
        return;
    }

    // Configurar dependencias
    const contenedor = configurarDependencias(window.supabaseClient);

    // Obtener controlador de inventario
    const controladorInventario = contenedor.obtener('controladorInventario');

    // Configurar funciones de UI para el controlador
    controladorInventario.mostrarError = function(mensaje) {
        const errorMsg = document.getElementById('editarJugueteErrorMessage');
        if (errorMsg) {
            errorMsg.textContent = mensaje;
            errorMsg.style.display = 'block';
        } else {
            console.error(mensaje);
        }
    };

    controladorInventario.mostrarExito = function(mensaje) {
        const successMsg = document.getElementById('editarJugueteSuccessMessage');
        if (successMsg) {
            successMsg.textContent = mensaje;
            successMsg.style.display = 'block';
        } else {
            console.log(mensaje);
        }
    };

    // Crear adaptador para compatibilidad con código legacy
    const adaptadorInventario = new AdaptadorInventarioLegacy(controladorInventario);

    // Exponer en window para uso global
    window.contenedorDependencias = contenedor;
    window.controladorInventario = controladorInventario;
    window.adaptadorInventario = adaptadorInventario;

    console.log('✅ Arquitectura Clean inicializada correctamente');
    return contenedor;
}

// Exportar
window.AdaptadorInventarioLegacy = AdaptadorInventarioLegacy;
window.inicializarArquitectura = inicializarArquitectura;
