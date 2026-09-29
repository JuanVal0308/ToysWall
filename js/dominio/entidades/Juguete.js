/**
 * Entidad: Juguete
 * Representa un producto/juguete en el sistema de inventario
 * Principio SRP: Responsabilidad única de representar un juguete
 */
class Juguete {
    /**
     * @param {number} id - Identificador único
     * @param {string} codigo - Código del juguete
     * @param {string} nombre - Nombre del juguete
     * @param {string|null} item - Código de ítem alternativo
     * @param {number} precioMinimo - Precio mínimo de venta
     * @param {number|null} precioPorMayor - Precio al por mayor
     * @param {string|null} fotoUrl - URL de la foto del juguete
     * @param {number} empresaId - ID de la empresa propietaria
     */
    constructor(id, codigo, nombre, item, precioMinimo, precioPorMayor, fotoUrl, empresaId) {
        this.id = id;
        this.codigo = codigo;
        this.nombre = nombre;
        this.item = item;
        this.precioMinimo = precioMinimo;
        this.precioPorMayor = precioPorMayor;
        this.fotoUrl = fotoUrl;
        this.empresaId = empresaId;
    }

    /**
     * Valida que el juguete tenga datos mínimos requeridos
     * @returns {boolean}
     */
    esValido() {
        return Boolean(
            this.codigo &&
            this.nombre &&
            this.precioMinimo >= 0 &&
            this.empresaId
        );
    }

    /**
     * Verifica si el juguete tiene precio por mayor configurado
     * @returns {boolean}
     */
    tienePrecioPorMayor() {
        return this.precioPorMayor !== null && this.precioPorMayor > 0;
    }

    /**
     * Obtiene el precio aplicable según el tipo de venta
     * @param {boolean} esPorMayor - Si es venta al por mayor
     * @returns {number}
     */
    obtenerPrecioAplicable(esPorMayor) {
        if (esPorMayor && this.tienePrecioPorMayor()) {
            return this.precioPorMayor;
        }
        return this.precioMinimo;
    }

    /**
     * Crea una instancia desde datos de base de datos
     * @param {Object} datos - Datos de la BD
     * @returns {Juguete}
     */
    static desdeDatos(datos) {
        return new Juguete(
            datos.id,
            datos.codigo,
            datos.nombre,
            datos.item || null,
            datos.precio_min || 0,
            datos.precio_por_mayor || null,
            datos.foto_url || null,
            datos.empresa_id
        );
    }

    /**
     * Convierte a formato para la base de datos
     * @returns {Object}
     */
    aDatos() {
        return {
            id: this.id,
            codigo: this.codigo,
            nombre: this.nombre,
            item: this.item,
            precio_min: this.precioMinimo,
            precio_por_mayor: this.precioPorMayor,
            foto_url: this.fotoUrl,
            empresa_id: this.empresaId
        };
    }
}

// Exportar
window.Juguete = Juguete;
