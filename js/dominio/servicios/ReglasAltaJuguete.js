/**
 * Reglas para "Agregar juguetes" (capa de DOMINIO, sin Supabase ni DOM).
 *
 * Un mismo juguete (código) puede estar en varias tiendas/bodegas: hay una fila de `juguetes`
 * por ubicación, cada una con su propia cantidad y los mismos datos compartidos
 * (nombre, ITEM, foto, precios, bultos).
 *
 * Al agregar un código que ya existe:
 *  - si ya está en la ubicación elegida, se suma la cantidad a esa fila;
 *  - si no, se crea la fila de esa ubicación reutilizando los datos compartidos del juguete.
 * Un código con otro nombre se rechaza. Los nombres se comparan sin distinguir mayúsculas,
 * tildes ni espacios repetidos.
 */
const ReglasAltaJuguete = {
    /** Campos que comparten todas las ubicaciones de un mismo juguete. */
    CAMPOS_COMPARTIDOS: ['item', 'foto_url', 'precio_min', 'precio_por_mayor', 'numero_bultos', 'cantidad_por_bulto'],

    /** Texto en minúsculas, sin tildes y con espacios simples (para comparar nombres y códigos). */
    normalizarTexto(texto) {
        return String(texto ?? '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    },

    mismoTexto(a, b) {
        return this.normalizarTexto(a) === this.normalizarTexto(b);
    },

    /** true si el campo del formulario trae un valor utilizable. */
    tieneValor(valor) {
        if (valor === null || valor === undefined) return false;
        if (typeof valor === 'number') return !Number.isNaN(valor);
        return String(valor).trim() !== '';
    },

    /**
     * Decide qué hacer al agregar un juguete.
     * @param {Array<Object>} filasMismoCodigo filas de `juguetes` con ese código (en cualquier ubicación)
     * @param {Object} datos { codigo, nombre, cantidad, tipoUbicacion: 'tienda'|'bodega', ubicacionId, empresaId, campos }
     *   `campos` trae los valores del formulario para CAMPOS_COMPARTIDOS (null/'' si se dejaron vacíos).
     * @returns {{accion: 'error', mensaje: string}
     *         | {accion: 'sumar', fila: Object, cantidad: number, actualizar: Object}
     *         | {accion: 'crear', registro: Object, cantidad: number, existiaEnOtraUbicacion: boolean}}
     */
    planificar(filasMismoCodigo, datos) {
        const { codigo, nombre, cantidad, tipoUbicacion, ubicacionId, empresaId, campos = {} } = datos;
        const filas = (filasMismoCodigo || []).filter(f => this.mismoTexto(f.codigo, codigo));

        const referencia = filas.find(f => this.mismoTexto(f.nombre, nombre)) || null;
        if (filas.length > 0 && !referencia) {
            return {
                accion: 'error',
                mensaje: `El código "${filas[0].codigo}" ya está registrado como "${filas[0].nombre}". ` +
                    'Usa ese mismo nombre (se completa solo al escribir el código) o un código diferente.'
            };
        }

        const campoUbicacion = tipoUbicacion === 'bodega' ? 'bodega_id' : 'tienda_id';
        const otroCampo = tipoUbicacion === 'bodega' ? 'tienda_id' : 'bodega_id';
        const enUbicacion = filas.find(f => String(f[campoUbicacion]) === String(ubicacionId) && !f[otroCampo]);

        // Valores escritos en el formulario (los vacíos no pisan los existentes)
        const escritos = {};
        this.CAMPOS_COMPARTIDOS.forEach(campo => {
            if (this.tieneValor(campos[campo])) escritos[campo] = campos[campo];
        });

        if (enUbicacion) {
            return { accion: 'sumar', fila: enUbicacion, cantidad, actualizar: escritos };
        }

        const registro = {
            nombre: referencia ? referencia.nombre : nombre,
            codigo: referencia ? referencia.codigo : codigo,
            cantidad,
            empresa_id: empresaId,
            [campoUbicacion]: Number(ubicacionId)
        };
        this.CAMPOS_COMPARTIDOS.forEach(campo => {
            const valor = campo in escritos ? escritos[campo] : (referencia ? referencia[campo] : null);
            if (this.tieneValor(valor)) registro[campo] = valor;
        });
        return { accion: 'crear', registro, cantidad, existiaEnOtraUbicacion: Boolean(referencia) };
    }
};

if (typeof window !== 'undefined') window.ReglasAltaJuguete = ReglasAltaJuguete;
if (typeof module !== 'undefined') module.exports = ReglasAltaJuguete;
