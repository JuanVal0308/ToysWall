/**
 * Inventario por ubicación (capa de DOMINIO, sin Supabase ni DOM).
 *
 * El inventario general agrupa cada juguete (código + nombre) con sus ubicaciones. Estas reglas
 * permiten ver una sola tienda o bodega: qué productos tiene registrados, cuántas unidades de cada
 * uno y el total de esa ubicación.
 */
const ReglasInventarioUbicacion = {
    GENERAL: 'general',

    /** Clave de una ubicación para el selector: "tienda-7", "bodega-1". */
    clave(tipo, id) {
        return `${tipo}-${id}`;
    },

    /** Convierte la clave del selector en {tipo, id}; null para "general" o una clave inválida. */
    parsearClave(clave) {
        const m = /^(tienda|bodega)-(\d+)$/.exec(String(clave || ''));
        return m ? { tipo: m[1], id: Number(m[2]) } : null;
    },

    /**
     * Productos a mostrar para la ubicación elegida, con `cantidadMostrada`:
     *  - "general": todos los productos con su cantidad total;
     *  - una ubicación: solo los productos que tienen fila en esa tienda/bodega (aunque estén en 0),
     *    con la cantidad de esa ubicación.
     * Las ubicaciones que el inventario general agrega en 0 para mostrar (sin fila real) se marcan
     * con `registro: false` y no cuentan.
     */
    filtrar(productos, clave) {
        const lista = productos || [];
        const ubicacion = this.parsearClave(clave);
        if (!ubicacion) {
            return lista.map(p => ({ ...p, cantidadMostrada: Number(p.cantidadTotal) || 0 }));
        }
        return lista.flatMap(p => {
            const u = (p.ubicaciones || []).find(x =>
                x.registro !== false && x.tipo === ubicacion.tipo && Number(x.id) === ubicacion.id);
            return u ? [{ ...p, cantidadMostrada: Number(u.cantidad) || 0 }] : [];
        });
    },

    /** Suma de unidades de los productos filtrados. */
    total(productosFiltrados) {
        return (productosFiltrados || []).reduce((suma, p) => suma + (Number(p.cantidadMostrada) || 0), 0);
    },

    /** Nombre legible de la clave ("Tienda San victoriano") o null para general. */
    describir(clave, tiendas, bodegas) {
        const ubicacion = this.parsearClave(clave);
        if (!ubicacion) return null;
        const lista = ubicacion.tipo === 'tienda' ? (tiendas || []) : (bodegas || []);
        const encontrada = lista.find(x => Number(x.id) === ubicacion.id);
        const tipoTexto = ubicacion.tipo === 'tienda' ? 'Tienda' : 'Bodega';
        return encontrada ? `${tipoTexto} ${encontrada.nombre}` : null;
    }
};

if (typeof window !== 'undefined') window.ReglasInventarioUbicacion = ReglasInventarioUbicacion;
if (typeof module !== 'undefined') module.exports = ReglasInventarioUbicacion;
