/**
 * Entidad: InventarioUbicacion
 * Representa la cantidad de un producto en una ubicación específica
 * Principio SRP: Responsabilidad única de representar inventario en una ubicación
 */
class InventarioUbicacion {
    /**
     * @param {number} id - Identificador único
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} ubicacionId - ID de la ubicación
     * @param {number} cantidad - Cantidad disponible
     * @param {number} empresaId - ID de la empresa
     * @param {number|null} numeroBultos - Número de bultos
     * @param {number|null} cantidadPorBulto - Unidades por bulto
     */
    constructor(id, jugueteCodigo, ubicacionId, cantidad, empresaId, numeroBultos = null, cantidadPorBulto = null) {
        this.id = id;
        this.jugueteCodigo = jugueteCodigo;
        this.ubicacionId = ubicacionId;
        this.cantidad = cantidad;
        this.empresaId = empresaId;
        this.numeroBultos = numeroBultos;
        this.cantidadPorBulto = cantidadPorBulto;
    }

    /**
     * Valida que el inventario tenga datos mínimos requeridos
     * @returns {boolean}
     */
    esValido() {
        return Boolean(
            this.jugueteCodigo &&
            this.ubicacionId &&
            this.cantidad >= 0 &&
            this.empresaId
        );
    }

    /**
     * Verifica si hay stock disponible
     * @returns {boolean}
     */
    tieneStock() {
        return this.cantidad > 0;
    }

    /**
     * Calcula el número de bultos disponibles
     * @param {number} unidadesPorBultoDefault - Valor por defecto si no está configurado
     * @returns {number}
     */
    calcularBultos(unidadesPorBultoDefault = 12) {
        const unidadesPorBulto = this.cantidadPorBulto || unidadesPorBultoDefault;
        return Math.floor(this.cantidad / unidadesPorBulto);
    }

    /**
     * Calcula las unidades sueltas (no completan un bulto)
     * @param {number} unidadesPorBultoDefault - Valor por defecto si no está configurado
     * @returns {number}
     */
    calcularUnidadesSueltas(unidadesPorBultoDefault = 12) {
        const unidadesPorBulto = this.cantidadPorBulto || unidadesPorBultoDefault;
        return this.cantidad % unidadesPorBulto;
    }

    /**
     * Agrega cantidad al inventario
     * @param {number} cantidadAAgregar - Cantidad a agregar
     */
    agregarCantidad(cantidadAAgregar) {
        if (cantidadAAgregar < 0) {
            throw new Error('La cantidad a agregar debe ser positiva');
        }
        this.cantidad += cantidadAAgregar;
    }

    /**
     * Reduce cantidad del inventario
     * @param {number} cantidadAReducir - Cantidad a reducir
     */
    reducirCantidad(cantidadAReducir) {
        if (cantidadAReducir < 0) {
            throw new Error('La cantidad a reducir debe ser positiva');
        }
        if (cantidadAReducir > this.cantidad) {
            throw new Error('No hay suficiente cantidad disponible');
        }
        this.cantidad -= cantidadAReducir;
    }

    /**
     * Crea una instancia desde datos de base de datos
     * @param {Object} datos - Datos de la BD
     * @returns {InventarioUbicacion}
     */
    static desdeDatos(datos) {
        return new InventarioUbicacion(
            datos.id,
            datos.juguete_codigo,
            datos.ubicacion_id,
            datos.cantidad || 0,
            datos.empresa_id,
            datos.numero_bultos || null,
            datos.cantidad_por_bulto || null
        );
    }

    /**
     * Convierte a formato para la base de datos
     * @returns {Object}
     */
    aDatos() {
        return {
            id: this.id,
            juguete_codigo: this.jugueteCodigo,
            ubicacion_id: this.ubicacionId,
            cantidad: this.cantidad,
            empresa_id: this.empresaId,
            numero_bultos: this.numeroBultos,
            cantidad_por_bulto: this.cantidadPorBulto
        };
    }
}

// Exportar
window.InventarioUbicacion = InventarioUbicacion;
