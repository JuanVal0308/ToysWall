/**
 * Ubicación de venta de un empleado (capa de DOMINIO): una tienda o una bodega.
 * En los formularios se usa una clave "tienda-3" / "bodega-1" ('' = sin ubicación).
 */
const ReglasUbicacionEmpleado = {
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
