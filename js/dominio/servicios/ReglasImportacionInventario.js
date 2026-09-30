/**
 * Reglas puras para importar inventario desde Excel (capa de DOMINIO).
 * No dependen de Supabase, del DOM ni de la librería XLSX: reciben filas planas y devuelven
 * filas validadas, errores por fila y el plan de cambios (crear / actualizar por código + ubicación).
 */
const ReglasImportacionInventario = {
    /** Columnas de la plantilla, en orden. */
    COLUMNAS: [
        'codigo', 'nombre', 'item', 'cantidad', 'tipo_ubicacion', 'ubicacion',
        'precio_min', 'precio_por_mayor', 'numero_bultos', 'cantidad_por_bulto', 'foto_url'
    ],

    OBLIGATORIAS: ['codigo', 'nombre', 'cantidad', 'tipo_ubicacion', 'ubicacion'],

    /** Encabezados alternativos aceptados (ya normalizados) → columna. */
    SINONIMOS: {
        codigo_juguete: 'codigo', cod: 'codigo', referencia: 'codigo',
        nombre_juguete: 'nombre', juguete: 'nombre', descripcion: 'nombre',
        codigo_item: 'item',
        cant: 'cantidad', unidades: 'cantidad', stock: 'cantidad',
        tipo: 'tipo_ubicacion', tipo_de_ubicacion: 'tipo_ubicacion',
        nombre_ubicacion: 'ubicacion', tienda_o_bodega: 'ubicacion', lugar: 'ubicacion',
        precio_minimo: 'precio_min', precio: 'precio_min',
        precio_mayor: 'precio_por_mayor', precio_al_por_mayor: 'precio_por_mayor', precio_mayorista: 'precio_por_mayor',
        bultos: 'numero_bultos', numero_de_bultos: 'numero_bultos',
        unidades_por_bulto: 'cantidad_por_bulto', cantidad_bulto: 'cantidad_por_bulto',
        foto: 'foto_url', url_foto: 'foto_url', imagen: 'foto_url'
    },

    /** Texto sin tildes, en minúsculas y sin espacios repetidos (para comparar nombres). */
    normalizarTexto(valor) {
        return String(valor ?? '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().trim().replace(/\s+/g, ' ');
    },

    /** "Precio Mínimo" → "precio_min" (usando sinónimos). Devuelve null si no se reconoce. */
    normalizarEncabezado(encabezado) {
        const base = this.normalizarTexto(encabezado).replace(/[*()]/g, '').trim().replace(/[\s.-]+/g, '_');
        if (this.COLUMNAS.includes(base)) return base;
        return this.SINONIMOS[base] || null;
    },

    /** Código como texto: 81 → "81", 81.0 → "81", " A-1 " → "A-1". */
    normalizarCodigo(valor) {
        if (typeof valor === 'number' && Number.isFinite(valor)) {
            return String(valor);
        }
        return String(valor ?? '').trim();
    },

    esVacio(valor) {
        return valor === null || valor === undefined || String(valor).trim() === '';
    },

    /** Entero >= 0 o null si no es válido. Acepta 12, "12", 12.0. */
    parsearEntero(valor) {
        if (typeof valor === 'number') return Number.isInteger(valor) && valor >= 0 ? valor : null;
        const texto = String(valor ?? '').trim().replace(/\.0+$/, '');
        return /^\d+$/.test(texto) ? parseInt(texto, 10) : null;
    },

    /**
     * Precio en pesos (>= 0) o null si no es válido. Acepta 25000, "25000", "$ 25.000", "25.000,50", "25000.5".
     */
    parsearPrecio(valor) {
        if (typeof valor === 'number') return Number.isFinite(valor) && valor >= 0 ? valor : null;
        let texto = String(valor ?? '').trim().replace(/[$\s]/g, '').replace(/COP/i, '');
        if (texto === '' || /[^\d.,]/.test(texto)) return null;
        if (texto.includes('.') && texto.includes(',')) {
            texto = texto.replace(/\./g, '').replace(',', '.');           // 25.000,50
        } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
            texto = texto.replace(/\./g, '');                              // 25.000
        } else if (/^\d{1,3}(,\d{3})+$/.test(texto)) {
            texto = texto.replace(/,/g, '');                               // 25,000
        } else {
            texto = texto.replace(',', '.');                               // 25,5
        }
        const numero = Number(texto);
        return Number.isFinite(numero) && numero >= 0 ? numero : null;
    },

    /**
     * Convierte la hoja (matriz de celdas, primera fila = encabezados) en objetos con columnas normalizadas.
     * @param {Array<Array<*>>} matriz
     * @returns {{filas: Array<{numeroFila:number, valores:Object}>, faltantes: string[], desconocidas: string[]}}
     */
    leerMatriz(matriz) {
        const indiceEncabezado = (matriz || []).findIndex(fila => (fila || []).some(c => !this.esVacio(c)));
        if (indiceEncabezado < 0) return { filas: [], faltantes: [...this.OBLIGATORIAS], desconocidas: [] };

        const encabezados = matriz[indiceEncabezado].map(c => this.normalizarEncabezado(c));
        const desconocidas = matriz[indiceEncabezado]
            .filter((c, i) => !this.esVacio(c) && !encabezados[i])
            .map(c => String(c).trim());
        const faltantes = this.OBLIGATORIAS.filter(col => !encabezados.includes(col));

        const filas = [];
        for (let i = indiceEncabezado + 1; i < matriz.length; i++) {
            const celdas = matriz[i] || [];
            if (!celdas.some(c => !this.esVacio(c))) continue; // fila vacía
            const valores = {};
            encabezados.forEach((col, j) => {
                if (col && valores[col] === undefined) valores[col] = celdas[j];
            });
            filas.push({ numeroFila: i + 1, valores }); // número de fila tal como se ve en Excel
        }
        return { filas, faltantes, desconocidas };
    },

    /**
     * Valida las filas contra las ubicaciones y el inventario actual.
     * @param {Array<{numeroFila:number, valores:Object}>} filas
     * @param {Object} contexto
     * @param {Array<{id:number, nombre:string}>} contexto.tiendas
     * @param {Array<{id:number, nombre:string}>} contexto.bodegas
     * @param {Array<{codigo:string, nombre:string}>} contexto.juguetes - inventario actual
     * @returns {{validas: Array, errores: Array<{numeroFila:number, codigo:string, mensajes:string[]}>}}
     */
    validar(filas, { tiendas = [], bodegas = [], juguetes = [] } = {}) {
        const ubicaciones = {
            tienda: new Map(tiendas.map(t => [this.normalizarTexto(t.nombre), t])),
            bodega: new Map(bodegas.map(b => [this.normalizarTexto(b.nombre), b]))
        };
        const nombrePorCodigo = new Map();
        juguetes.forEach(j => {
            const codigo = this.normalizarCodigo(j.codigo);
            if (!nombrePorCodigo.has(codigo)) nombrePorCodigo.set(codigo, j.nombre);
        });
        const vistos = new Map();          // codigo|tipo|id → número de fila
        const nombreEnArchivo = new Map(); // codigo → {nombre, numeroFila}

        const validas = [];
        const errores = [];

        for (const { numeroFila, valores } of filas) {
            const mensajes = [];
            const codigo = this.normalizarCodigo(valores.codigo);
            const nombre = String(valores.nombre ?? '').trim();

            if (!codigo) mensajes.push('Falta el código');
            else if (codigo.length > 50) mensajes.push('El código supera 50 caracteres');
            if (!nombre) mensajes.push('Falta el nombre');
            else if (nombre.length > 255) mensajes.push('El nombre supera 255 caracteres');

            const cantidad = this.parsearEntero(valores.cantidad);
            if (this.esVacio(valores.cantidad)) mensajes.push('Falta la cantidad');
            else if (cantidad === null) mensajes.push(`Cantidad inválida "${valores.cantidad}" (debe ser un entero mayor o igual a 0)`);

            const tipo = this.normalizarTexto(valores.tipo_ubicacion);
            let ubicacion = null;
            if (!tipo) mensajes.push('Falta el tipo de ubicación (tienda o bodega)');
            else if (!ubicaciones[tipo]) mensajes.push(`Tipo de ubicación inválido "${valores.tipo_ubicacion}" (usa tienda o bodega)`);
            else if (this.esVacio(valores.ubicacion)) mensajes.push('Falta el nombre de la ubicación');
            else {
                ubicacion = ubicaciones[tipo].get(this.normalizarTexto(valores.ubicacion)) || null;
                if (!ubicacion) mensajes.push(`La ${tipo} "${String(valores.ubicacion).trim()}" no existe`);
            }

            const opcionales = {};
            for (const campo of ['precio_min', 'precio_por_mayor']) {
                if (this.esVacio(valores[campo])) continue;
                const precio = this.parsearPrecio(valores[campo]);
                if (precio === null) mensajes.push(`${campo === 'precio_min' ? 'Precio mínimo' : 'Precio por mayor'} inválido "${valores[campo]}"`);
                else opcionales[campo] = precio;
            }
            for (const campo of ['numero_bultos', 'cantidad_por_bulto']) {
                if (this.esVacio(valores[campo])) continue;
                const entero = this.parsearEntero(valores[campo]);
                if (entero === null) mensajes.push(`${campo === 'numero_bultos' ? 'Número de bultos' : 'Cantidad por bulto'} inválido "${valores[campo]}"`);
                else opcionales[campo] = entero;
            }
            if (!this.esVacio(valores.item)) opcionales.item = String(valores.item).trim();
            if (!this.esVacio(valores.foto_url)) {
                const url = String(valores.foto_url).trim();
                if (!/^https?:\/\/\S+$/i.test(url)) mensajes.push('La URL de la foto debe empezar por http:// o https://');
                else opcionales.foto_url = url;
            }

            if (codigo && nombre) {
                const existente = nombrePorCodigo.get(codigo);
                if (existente && this.normalizarTexto(existente) !== this.normalizarTexto(nombre)) {
                    mensajes.push(`El código ${codigo} ya existe en el inventario con otro nombre ("${existente}")`);
                }
                const previo = nombreEnArchivo.get(codigo);
                if (previo && this.normalizarTexto(previo.nombre) !== this.normalizarTexto(nombre)) {
                    mensajes.push(`El código ${codigo} aparece con otro nombre en la fila ${previo.numeroFila}`);
                } else if (!previo) {
                    nombreEnArchivo.set(codigo, { nombre, numeroFila });
                }
            }
            if (codigo && ubicacion) {
                const clave = `${codigo}|${tipo}|${ubicacion.id}`;
                if (vistos.has(clave)) mensajes.push(`Duplicado: el código ${codigo} en esta ${tipo} ya está en la fila ${vistos.get(clave)}`);
                else vistos.set(clave, numeroFila);
            }

            if (mensajes.length) {
                errores.push({ numeroFila, codigo, mensajes });
            } else {
                validas.push({
                    numeroFila,
                    codigo,
                    nombre,
                    cantidad,
                    tipoUbicacion: tipo,
                    ubicacionId: ubicacion.id,
                    ubicacionNombre: ubicacion.nombre,
                    ...opcionales
                });
            }
        }
        return { validas, errores };
    },

    /**
     * Plan de cambios: actualizar si ya existe el código en esa ubicación, crear si no.
     * @param {Array} validas - Resultado de validar()
     * @param {Array} juguetes - Inventario actual (id, codigo, cantidad, tienda_id, bodega_id)
     * @param {'reemplazar'|'sumar'} modo - Qué hacer con la cantidad de un registro existente
     * @returns {Array<{accion:'crear'|'actualizar', fila:Object, jugueteId?:number, cantidadAnterior?:number, cantidadNueva:number}>}
     */
    planificar(validas, juguetes, modo = 'reemplazar') {
        if (!['reemplazar', 'sumar'].includes(modo)) throw new Error(`Modo de importación inválido: ${modo}`);
        const indice = new Map();
        juguetes.forEach(j => {
            const tipo = j.tienda_id ? 'tienda' : (j.bodega_id ? 'bodega' : null);
            if (!tipo) return;
            const clave = `${this.normalizarCodigo(j.codigo)}|${tipo}|${j.tienda_id || j.bodega_id}`;
            if (!indice.has(clave)) indice.set(clave, j); // si hubiera duplicados se usa el primero (menor id)
        });
        return validas.map(fila => {
            const existente = indice.get(`${fila.codigo}|${fila.tipoUbicacion}|${fila.ubicacionId}`);
            if (!existente) return { accion: 'crear', fila, cantidadNueva: fila.cantidad };
            const anterior = existente.cantidad || 0;
            return {
                accion: 'actualizar',
                fila,
                jugueteId: existente.id,
                cantidadAnterior: anterior,
                cantidadNueva: modo === 'sumar' ? anterior + fila.cantidad : fila.cantidad
            };
        });
    }
};

if (typeof window !== 'undefined') window.ReglasImportacionInventario = ReglasImportacionInventario;
if (typeof module !== 'undefined') module.exports = ReglasImportacionInventario;
