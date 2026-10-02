/**
 * Reglas para EDITAR un juguete del inventario (capa de DOMINIO, sin Supabase ni DOM).
 *
 * Un juguete tiene una fila de `juguetes` por ubicación (tienda o bodega). Todas comparten código,
 * nombre, ITEM, foto, precios y cantidad por bulto; cada una tiene su propia cantidad.
 *
 *  - El "mismo producto" son las filas con el mismo código y el mismo nombre (sin distinguir
 *    mayúsculas, tildes ni espacios, igual que en "Agregar juguetes"), más la fila editada.
 *  - Al guardar, el código solo se rechaza si lo usa un producto realmente distinto.
 *  - Los campos compartidos se copian a todas las filas del producto; la cantidad (y los bultos)
 *    solo se escriben en la fila de la ubicación elegida y son valores absolutos (nunca se suman
 *    ni se restan).
 */
const ReglasEdicionJuguete = (() => {
    const alta = () => (typeof window !== 'undefined' && window.ReglasAltaJuguete)
        || (typeof require === 'function' ? require('./ReglasAltaJuguete') : null);

    const CAMPOS_COMPARTIDOS = ['nombre', 'codigo', 'item', 'foto_url', 'precio_min', 'precio_por_mayor', 'cantidad_por_bulto'];
    const CAMPOS_POR_UBICACION = ['cantidad', 'numero_bultos'];

    const mismoId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
    const claveUbicacion = (f) => f.tienda_id ? `tienda-${f.tienda_id}` : (f.bodega_id ? `bodega-${f.bodega_id}` : null);

    return {
        CAMPOS_COMPARTIDOS,
        CAMPOS_POR_UBICACION,

        normalizar(texto) {
            return alta().normalizarTexto(texto);
        },

        mismoTexto(a, b) {
            return this.normalizar(a) === this.normalizar(b);
        },

        /** Clave de la ubicación de una fila ("tienda-7", "bodega-1") o null. */
        claveUbicacion,

        /**
         * Filas que pertenecen al mismo producto que la fila editada.
         * @param {Array<Object>} filas filas con {id, codigo, nombre, ...}
         * @param {{id, codigo, nombre}} original fila editada tal como está en la BD
         */
        filasDelProducto(filas, original) {
            return (filas || []).filter(f => mismoId(f.id, original.id)
                || (this.mismoTexto(f.codigo, original.codigo) && this.mismoTexto(f.nombre, original.nombre)));
        },

        /**
         * ¿Se puede guardar el código? Solo hay conflicto si lo usa un producto distinto
         * (otro nombre) o si el producto ya tiene una fila con ese código en la misma ubicación.
         * @param {Array<Object>} filasCodigoNuevo filas con el código nuevo (cualquier ubicación)
         * @param {{original: {id, codigo, nombre}, codigoNuevo, nombreNuevo, filasProducto?: Array}} datos
         * @returns {{valido: boolean, mensaje?: string}}
         */
        validarCodigo(filasCodigoNuevo, { original, codigoNuevo, nombreNuevo, filasProducto = [] }) {
            if (!this.normalizar(codigoNuevo)) {
                return { valido: false, mensaje: 'El código es obligatorio' };
            }
            if (this.mismoTexto(codigoNuevo, original.codigo)) {
                return { valido: true };
            }
            const idsProducto = new Set([original, ...filasProducto].map(f => String(f.id)));
            const otras = (filasCodigoNuevo || []).filter(f =>
                this.mismoTexto(f.codigo, codigoNuevo) && !idsProducto.has(String(f.id)));

            const distinta = otras.find(f => !this.mismoTexto(f.nombre, original.nombre)
                && !this.mismoTexto(f.nombre, nombreNuevo));
            if (distinta) {
                return {
                    valido: false,
                    mensaje: `El código "${String(codigoNuevo).trim()}" ya está asignado a otro juguete ("${String(distinta.nombre ?? '').trim()}")`
                };
            }

            const ubicacionesProducto = new Set([original, ...filasProducto].map(claveUbicacion).filter(Boolean));
            const choca = otras.find(f => claveUbicacion(f) && ubicacionesProducto.has(claveUbicacion(f)));
            if (choca) {
                return {
                    valido: false,
                    mensaje: `Ya hay un registro de "${String(choca.nombre ?? '').trim()}" con el código "${String(codigoNuevo).trim()}" en la misma ubicación`
                };
            }
            return { valido: true };
        },

        /**
         * Separa los datos del formulario en campos compartidos (todas las filas del producto)
         * y campos de la ubicación (solo la fila elegida). Los campos ausentes (undefined) no se tocan.
         */
        separarCampos(datos) {
            const compartidos = {};
            const porUbicacion = {};
            Object.keys(datos || {}).forEach(campo => {
                if (datos[campo] === undefined) return;
                if (CAMPOS_COMPARTIDOS.includes(campo)) compartidos[campo] = datos[campo];
                else if (CAMPOS_POR_UBICACION.includes(campo)) porUbicacion[campo] = datos[campo];
            });
            return { compartidos, porUbicacion };
        },

        /**
         * Fila a preseleccionar en el modal de edición.
         * @param {Array<Object>} filasProducto
         * @param {string} claveVista 'general' o "tienda-7"/"bodega-1"
         * @returns {Object|null} la fila, o null si hay que pedir que se elija
         */
        filaPreseleccionada(filasProducto, claveVista) {
            const filas = filasProducto || [];
            const m = /^(tienda|bodega)-(\d+)$/.exec(String(claveVista || ''));
            if (m) {
                const enVista = filas.filter(f => claveUbicacion(f) === `${m[1]}-${m[2]}`);
                return enVista.length === 1 ? enVista[0] : null;
            }
            return filas.length === 1 ? filas[0] : null;
        },

        /**
         * Valida la cantidad nueva (absoluta) de la ubicación.
         * @returns {{valido: boolean, valor?: number, mensaje?: string}}
         */
        validarCantidad(texto) {
            const t = String(texto ?? '').trim();
            if (!/^\d+$/.test(t)) {
                return { valido: false, mensaje: 'La cantidad debe ser un número entero mayor o igual a 0' };
            }
            return { valido: true, valor: parseInt(t, 10) };
        }
    };
})();

if (typeof window !== 'undefined') window.ReglasEdicionJuguete = ReglasEdicionJuguete;
if (typeof module !== 'undefined') module.exports = ReglasEdicionJuguete;
