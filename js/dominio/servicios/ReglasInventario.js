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
     * Clave estable de la ubicación de un registro o item de venta ("tienda-7", "bodega-1").
     * null si no tiene tienda ni bodega.
     */
    claveUbicacion(fila) {
        if (!fila) return null;
        if (fila.bodega_id != null && fila.bodega_id !== '') return `bodega-${Number(fila.bodega_id)}`;
        if (fila.tienda_id != null && fila.tienda_id !== '') return `tienda-${Number(fila.tienda_id)}`;
        if (fila.ubicacion_tipo && fila.ubicacion_id != null && fila.ubicacion_id !== '') {
            return `${fila.ubicacion_tipo}-${Number(fila.ubicacion_id)}`;
        }
        return null;
    },

    /**
     * Una venta no puede mezclar tiendas/bodegas (VENT-20261026-017).
     * @param {Array<Object>} items - items del carrito o filas con tienda_id/bodega_id
     * @returns {{ok: boolean, error: string|null, clave: string|null}}
     */
    validarMismaUbicacionVenta(items) {
        const lista = items || [];
        if (lista.length === 0) return { ok: true, error: null, clave: null };
        const claves = [...new Set(lista.map(i => this.claveUbicacion(i)).filter(Boolean))];
        if (claves.length === 0) {
            return { ok: false, error: 'Cada ítem de la venta debe indicar de qué tienda o bodega sale el stock.', clave: null };
        }
        if (claves.length > 1) {
            return {
                ok: false,
                error: 'Todos los ítems de una venta deben salir de la misma tienda o bodega. Quita los ítems o elige una sola ubicación.',
                clave: null
            };
        }
        return { ok: true, error: null, clave: claves[0] };
    },

    /**
     * Ubicación fija del carrito (la del primer ítem). Se usa para no cambiar
     * de tienda/bodega a mitad de la venta ni caer al fallback admin.
     * @returns {{tipo:'tienda'|'bodega', id:number}|null}
     */
    ubicacionFijaDeCarrito(items) {
        const v = this.validarMismaUbicacionVenta(items);
        if (!v.clave) return null;
        const m = /^(tienda|bodega)-(\d+)$/.exec(v.clave);
        return m ? { tipo: m[1], id: Number(m[2]) } : null;
    },

    /**
     * Elige de qué registro (ubicación) se descontará una venta.
     * - Empleado con ubicación asignada (tienda o bodega): solo esa ubicación.
     * - Admin / sin empleado: primero tiendas con stock suficiente, luego bodegas con stock suficiente.
     * Tiene en cuenta las unidades ya reservadas por otros items de la venta en curso.
     *
     * @param {Array<Object>} filas - Registros del juguete (mismo código) en todas las ubicaciones
     * @param {Object} opciones
     * @param {number} opciones.cantidad - Unidades solicitadas
     * @param {{tipo:'tienda'|'bodega', id:number}|null} [opciones.ubicacionEmpleado] - Ubicación de venta del empleado
     *        (null si puede vender en cualquier ubicación)
     * @param {number|null} [opciones.tiendaEmpleadoId] - Forma anterior: equivale a ubicacionEmpleado {tipo:'tienda'}
     * @param {Object<number, number>} [opciones.reservado] - Unidades ya reservadas por id de registro
     * @returns {{fila: Object|null, error: string|null}}
     */
    seleccionarUbicacionVenta(filas, { cantidad, ubicacionEmpleado = null, tiendaEmpleadoId = null, reservado = {}, etiqueta = 'del empleado' }) {
        const disponible = f => (f.cantidad || 0) - (reservado[f.id] || 0);
        const ubicacion = ubicacionEmpleado || (tiendaEmpleadoId ? { tipo: 'tienda', id: tiendaEmpleadoId } : null);

        if (!filas || filas.length === 0) {
            return { fila: null, error: 'Juguete no encontrado' };
        }

        if (ubicacion) {
            const campo = ubicacion.tipo === 'bodega' ? 'bodega_id' : 'tienda_id';
            const lugar = ubicacion.tipo === 'bodega' ? 'la bodega' : 'la tienda';
            const sufijo = etiqueta === 'seleccionada' ? ' seleccionada' : ` ${etiqueta}`;
            const candidatas = filas.filter(f => String(f[campo]) === String(ubicacion.id));
            if (candidatas.length === 0) {
                return { fila: null, error: `El juguete no está disponible en ${lugar}${sufijo}.` };
            }
            // Si hay filas duplicadas en la misma ubicación, elegir una con stock suficiente
            // (antes se tomaba la primera y podía fallar aunque otra sí tuviera).
            const fila = candidatas.find(f => disponible(f) >= cantidad);
            if (!fila) {
                // Disponible = máximo en una sola fila (una venta descuenta de un solo registro)
                const disp = candidatas.reduce((max, f) => Math.max(max, Math.max(0, disponible(f))), 0);
                return { fila: null, error: `No hay suficiente cantidad en ${lugar}${sufijo}. Disponible: ${disp}` };
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
