/**
 * Entidad: Ubicación
 * Representa una ubicación física donde se almacena inventario (tienda, bodega, general)
 * Principio SRP: Responsabilidad única de representar una ubicación
 */
class Ubicacion {
    /**
     * @param {number} id - Identificador único
     * @param {string} nombre - Nombre de la ubicación
     * @param {string} tipo - Tipo: 'tienda', 'bodega', 'general'
     * @param {string|null} direccion - Dirección física
     * @param {number} empresaId - ID de la empresa propietaria
     * @param {boolean} activo - Si la ubicación está activa
     * @param {string|null} descripcion - Descripción adicional
     */
    constructor(id, nombre, tipo, direccion, empresaId, activo = true, descripcion = null) {
        this.id = id;
        this.nombre = nombre;
        this.tipo = tipo;
        this.direccion = direccion;
        this.empresaId = empresaId;
        this.activo = activo;
        this.descripcion = descripcion;
    }

    /**
     * Valida que la ubicación tenga datos mínimos requeridos
     * @returns {boolean}
     */
    esValida() {
        return Boolean(
            this.nombre &&
            this.tipo &&
            ['tienda', 'bodega', 'general'].includes(this.tipo) &&
            this.empresaId
        );
    }

    /**
     * Verifica si es una tienda
     * @returns {boolean}
     */
    esTienda() {
        return this.tipo === 'tienda';
    }

    /**
     * Verifica si es una bodega
     * @returns {boolean}
     */
    esBodega() {
        return this.tipo === 'bodega';
    }

    /**
     * Verifica si es ubicación general
     * @returns {boolean}
     */
    esGeneral() {
        return this.tipo === 'general';
    }

    /**
     * Obtiene un icono representativo según el tipo
     * @returns {string}
     */
    obtenerIcono() {
        switch (this.tipo) {
            case 'tienda': return 'fa-store';
            case 'bodega': return 'fa-warehouse';
            case 'general': return 'fa-boxes';
            default: return 'fa-map-marker-alt';
        }
    }

    /**
     * Crea una instancia desde datos de base de datos
     * @param {Object} datos - Datos de la BD
     * @returns {Ubicacion}
     */
    static desdeDatos(datos) {
        return new Ubicacion(
            datos.id,
            datos.nombre,
            datos.tipo,
            datos.direccion || null,
            datos.empresa_id,
            datos.activo !== false,
            datos.descripcion || null
        );
    }

    /**
     * Convierte a formato para la base de datos
     * @returns {Object}
     */
    aDatos() {
        return {
            id: this.id,
            nombre: this.nombre,
            tipo: this.tipo,
            direccion: this.direccion,
            empresa_id: this.empresaId,
            activo: this.activo,
            descripcion: this.descripcion
        };
    }
}

// Exportar
window.Ubicacion = Ubicacion;
