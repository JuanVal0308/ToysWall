/**
 * Ubicación de venta de un empleado (capa de DOMINIO): una tienda o una bodega.
 * En los formularios se usa una clave "tienda-3" / "bodega-1" ('' = sin ubicación).
 */
const ReglasUbicacionEmpleado = {
    /**
     * Empleados que pueden vender desde cualquier tienda o bodega.
     * Deben elegir la ubicación en la pantalla de Venta; el stock solo se
     * descuenta de esa fila (no se toma de otra automáticamente).
     */
    NOMBRES_VENTA_LIBRE: ['Jose', 'Sindy'],

    /** true si el empleado puede elegir de dónde sale el stock. */
    puedeElegirUbicacion(empleado) {
        if (!empleado || !empleado.nombre) return false;
        return this.NOMBRES_VENTA_LIBRE.includes(String(empleado.nombre).trim());
    },

    /**
     * Ubicación desde la que se descontará la venta.
     * - Jose/Sindy: obligatoria la clave elegida en el selector ("tienda-3" / "bodega-1").
     * - Otros empleados: su tienda o bodega asignada (sin selector).
     * - Sin empleado (admin): null → cualquier ubicación con stock.
     * @returns {{ubicacion: {tipo:string,id:number}|null, error: string|null, etiqueta: string}}
     */
    resolverUbicacionVenta(empleado, claveElegida = '') {
        if (!empleado) {
            return { ubicacion: null, error: null, etiqueta: 'disponible' };
        }
        if (this.puedeElegirUbicacion(empleado)) {
            const elegida = this.parsearClave(claveElegida);
            if (!elegida) {
                return {
                    ubicacion: null,
                    error: 'Elige de qué tienda o bodega sale esta venta (obligatorio para ' + empleado.nombre + ').',
                    etiqueta: 'seleccionada'
                };
            }
            return { ubicacion: elegida, error: null, etiqueta: 'seleccionada' };
        }
        const asignada = this.deEmpleado(empleado);
        if (!asignada) {
            return {
                ubicacion: null,
                error: 'El empleado no tiene una ubicación de venta (tienda o bodega) asignada. No puede realizar ventas.',
                etiqueta: 'del empleado'
            };
        }
        return { ubicacion: asignada, error: null, etiqueta: 'del empleado' };
    },

    /** {tipo, id} de la ubicación de venta del empleado o null si no tiene. */
    deEmpleado(empleado) {
        if (!empleado) return null;
        if (empleado.bodega_id) return { tipo: 'bodega', id: Number(empleado.bodega_id) };
        if (empleado.tienda_id) return { tipo: 'tienda', id: Number(empleado.tienda_id) };
        return null;
    },

    /** Clave para el select del formulario ("tienda-3", "bodega-1" o ''). */
    claveDeEmpleado(empleado) {
        const u = this.deEmpleado(empleado);
        return u ? `${u.tipo}-${u.id}` : '';
    },

    /** Convierte la clave del select en {tipo, id} (null si está vacía o no es válida). */
    parsearClave(clave) {
        const m = /^(tienda|bodega)-(\d+)$/.exec(String(clave ?? '').trim());
        return m ? { tipo: m[1], id: Number(m[2]) } : null;
    },

    /**
     * Columnas a guardar en empleados para la clave elegida.
     * @param {string} clave
     * @param {boolean} admiteBodega - false si la BD aún no tiene empleados.bodega_id (migración 08 sin aplicar)
     * @returns {{campos: Object|null, error: string|null}}
     */
    camposParaGuardar(clave, admiteBodega) {
        const u = this.parsearClave(clave);
        if (!u) return { campos: admiteBodega ? { tienda_id: null, bodega_id: null } : { tienda_id: null }, error: null };
        if (u.tipo === 'bodega') {
            if (!admiteBodega) {
                return { campos: null, error: 'Asignar empleados a una bodega requiere aplicar la migración 2026_10_02_08 en Supabase.' };
            }
            return { campos: { tienda_id: null, bodega_id: u.id }, error: null };
        }
        return { campos: admiteBodega ? { tienda_id: u.id, bodega_id: null } : { tienda_id: u.id }, error: null };
    },

    /**
     * Texto para mostrar ("Tienda Campin", "Bodega Santa Isabel", "Sin ubicación asignada").
     * @param {Object} empleado
     * @param {Array<{id, nombre}>} tiendas
     * @param {Array<{id, nombre}>} bodegas
     */
    describir(empleado, tiendas = [], bodegas = []) {
        const u = this.deEmpleado(empleado);
        if (!u) return 'Sin ubicación asignada';
        const lista = u.tipo === 'bodega' ? bodegas : tiendas;
        const encontrada = (lista || []).find(x => Number(x.id) === u.id);
        const nombre = encontrada?.nombre || (u.tipo === 'tienda' ? empleado.tiendas?.nombre : null);
        const tipo = u.tipo === 'bodega' ? 'Bodega' : 'Tienda';
        return nombre ? `${tipo} ${nombre}` : `${tipo} #${u.id}`;
    }
};

if (typeof window !== 'undefined') window.ReglasUbicacionEmpleado = ReglasUbicacionEmpleado;
if (typeof module !== 'undefined') module.exports = ReglasUbicacionEmpleado;
