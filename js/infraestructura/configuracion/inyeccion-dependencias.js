/**
 * Configuración de Inyección de Dependencias
 * Wire up de todas las capas siguiendo Clean Architecture
 * Principio DIP: Las dependencias fluyen hacia el dominio
 */

/**
 * Clase: ContenedorDependencias
 * Maneja la creación e inyección de dependencias
 * Implementa el patrón Service Locator simplificado
 */
class ContenedorDependencias {
    constructor() {
        this.servicios = new Map();
    }

    /**
     * Registrar un servicio
     * @param {string} nombre - Nombre del servicio
     * @param {any} instancia - Instancia del servicio
     */
    registrar(nombre, instancia) {
        this.servicios.set(nombre, instancia);
    }

    /**
     * Obtener un servicio
     * @param {string} nombre - Nombre del servicio
     * @returns {any}
     */
    obtener(nombre) {
        if (!this.servicios.has(nombre)) {
            throw new Error(`Servicio '${nombre}' no registrado`);
        }
        return this.servicios.get(nombre);
    }

    /**
     * Verificar si un servicio está registrado
     * @param {string} nombre - Nombre del servicio
     * @returns {boolean}
     */
    tiene(nombre) {
        return this.servicios.has(nombre);
    }
}

/**
 * Función: configurarDependencias
 * Configura todas las dependencias de la aplicación
 * @param {Object} clienteSupabase - Cliente de Supabase
 * @returns {ContenedorDependencias}
 */
function configurarDependencias(clienteSupabase) {
    const contenedor = new ContenedorDependencias();

    // CAPA DE INFRAESTRUCTURA: Repositorios (implementaciones concretas)
    const repositorioJuguetes = new RepositorioJuguetesSupabase(clienteSupabase);
    const repositorioUbicaciones = new RepositorioUbicacionesSupabase(clienteSupabase);
    const repositorioInventario = new RepositorioInventarioSupabase(clienteSupabase);

    contenedor.registrar('repositorioJuguetes', repositorioJuguetes);
    contenedor.registrar('repositorioUbicaciones', repositorioUbicaciones);
    contenedor.registrar('repositorioInventario', repositorioInventario);

    // CAPA DE DOMINIO: Casos de Uso (reglas de negocio)
    const casoUsoActualizarJuguete = new ActualizarJuguete(repositorioJuguetes);
    const casoUsoObtenerInventario = new ObtenerInventarioConsolidado(repositorioInventario);
    const casoUsoActualizarInventarioUbicacion = new ActualizarInventarioUbicacion(repositorioInventario);
    const casoUsoObtenerUbicaciones = new ObtenerUbicaciones(repositorioUbicaciones);

    contenedor.registrar('casoUsoActualizarJuguete', casoUsoActualizarJuguete);
    contenedor.registrar('casoUsoObtenerInventario', casoUsoObtenerInventario);
    contenedor.registrar('casoUsoActualizarInventarioUbicacion', casoUsoActualizarInventarioUbicacion);
    contenedor.registrar('casoUsoObtenerUbicaciones', casoUsoObtenerUbicaciones);

    // CAPA DE PRESENTACIÓN: Controladores (coordinan UI y casos de uso)
    const controladorInventario = new ControladorInventario(
        casoUsoObtenerInventario,
        casoUsoActualizarJuguete,
        casoUsoActualizarInventarioUbicacion,
        casoUsoObtenerUbicaciones
    );

    contenedor.registrar('controladorInventario', controladorInventario);

    return contenedor;
}

// Exportar
window.ContenedorDependencias = ContenedorDependencias;
window.configurarDependencias = configurarDependencias;
