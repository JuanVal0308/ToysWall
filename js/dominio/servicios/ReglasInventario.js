/**
 * Reglas de negocio puras sobre inventario y ventas (capa de DOMINIO).
 * No dependen de Supabase ni del DOM: reciben datos planos y devuelven resultados,
 * por lo que se pueden probar de forma aislada.
 */
const ReglasInventario = {
    /**
     * Convierte un texto a entero positivo. Devuelve null si no es un entero >= 1.
     * Rechaza decimales ("1.5"), notación científica ("1e3"), texto ("abc") y negativos.
     * @param {string|number} valor
     * @returns {number|null}
     */
    parsearCantidad(valor) {
        const texto = String(valor ?? '').trim();
        if (!/^\d+$/.test(texto)) return null;
        const numero = parseInt(texto, 10);
        return numero >= 1 ? numero : null;
    },

    /**
     * Convierte un precio (posiblemente formateado "1.200.000") a número entero de pesos.
     * Devuelve null si no hay dígitos.
     * @param {string|number} valor
     * @returns {number|null}
     */
    parsearPrecio(valor) {
        const digitos = String(valor ?? '').replace(/[^\d]/g, '');
        if (digitos === '') return null;
        return parseInt(digitos, 10);
    },

    /**
     * Describe la ubicación de un registro de juguete.
     * @param {Object} fila - Registro de la tabla juguetes (con tiendas/bodegas opcionales)
     * @returns {string}
     */
    describirUbicacion(fila) {
        if (!fila) return 'Sin ubicación';
        if (fila.tienda_id) return `Tienda ${fila.tiendas?.nombre || '#' + fila.tienda_id}`;
        if (fila.bodega_id) return `Bodega ${fila.bodegas?.nombre || '#' + fila.bodega_id}`;
        return 'Sin ubicación';
    },

    /**
     * Elige de qué registro (ubicación) se descontará una venta.
     * - Empleado con tienda asignada (y no especial): solo su tienda.
     * - Admin / empleado especial / sin empleado: primero tiendas con stock suficiente,
     *   luego bodegas con stock suficiente.
     * Tiene en cuenta las unidades ya reservadas por otros items de la venta en curso.
     *
     * @param {Array<Object>} filas - Registros del juguete (mismo código) en todas las ubicaciones
     * @param {Object} opciones
     * @param {number} opciones.cantidad - Unidades solicitadas
     * @param {number|null} opciones.tiendaEmpleadoId - Tienda del empleado (null si puede vender en cualquier ubicación)
     * @param {Object<number, number>} [opciones.reservado] - Unidades ya reservadas por id de registro
     * @returns {{fila: Object|null, error: string|null}}
     */
    seleccionarUbicacionVenta(filas, { cantidad, tiendaEmpleadoId = null, reservado = {} }) {
        const disponible = f => (f.cantidad || 0) - (reservado[f.id] || 0);

        if (!filas || filas.length === 0) {
            return { fila: null, error: 'Juguete no encontrado' };
        }

        if (tiendaEmpleadoId) {
            const fila = filas.find(f => String(f.tienda_id) === String(tiendaEmpleadoId));
            if (!fila) {
                return { fila: null, error: 'El juguete no está disponible en la tienda del empleado.' };
            }
            if (disponible(fila) < cantidad) {
                return { fila: null, error: `No hay suficiente cantidad en la tienda del empleado. Disponible: ${Math.max(0, disponible(fila))}` };
            }
            return { fila, error: null };
        }

        const candidatas = [
            ...filas.filter(f => f.tienda_id),
            ...filas.filter(f => !f.tienda_id && f.bodega_id)
        ];
        const fila = candidatas.find(f => disponible(f) >= cantidad);
        if (fila) return { fila, error: null };

        const resumen = candidatas
            .map(f => `${this.describirUbicacion(f)}: ${Math.max(0, disponible(f))}`)
            .join(', ');
        return {
            fila: null,
            error: `No hay suficiente cantidad en una sola ubicación. Disponible por ubicación: ${resumen || 'sin stock'}`
        };
    }
};

if (typeof window !== 'undefined') window.ReglasInventario = ReglasInventario;
if (typeof module !== 'undefined') module.exports = ReglasInventario;
