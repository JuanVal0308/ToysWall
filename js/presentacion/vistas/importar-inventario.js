/**
 * Vista "Importar inventario desde Excel" (capa de PRESENTACIÓN).
 * Plantilla → archivo → vista previa con errores por fila → importar → informe.
 * Reglas: ReglasImportacionInventario (dominio). Datos: ServicioImportacionInventario (infraestructura).
 */
(function () {
    'use strict';

    const estado = { contexto: null, validas: [], errores: [], nombreArchivo: '' };

    const $ = id => document.getElementById(id);

    function escaparHtml(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function usuarioActual() {
        try { return JSON.parse(sessionStorage.getItem('user')) || null; } catch (e) { return null; }
    }

    function esAdmin() {
        const u = usuarioActual();
        return !!u && (u.tipo_usuario_id === 1 || u.tipo_usuario_id === 2);
    }

    function mostrarMensaje(texto, tipo = 'error') {
        const el = $('importarMensaje');
        if (!el) return;
        if (!texto) { el.style.display = 'none'; return; }
        el.className = tipo === 'error' ? 'error-message' : 'success-message';
        el.textContent = texto;
        el.style.display = 'flex';
    }

    function limpiarVistaPrevia() {
        estado.validas = [];
        estado.errores = [];
        $('importarVistaPrevia').innerHTML = '';
        $('importarConfirmarBtn').style.display = 'none';
    }

    async function obtenerContexto(forzar = false) {
        if (!estado.contexto || forzar) {
            const user = usuarioActual();
            estado.contexto = await window.servicioImportacionInventario.cargarContexto(user.empresa_id);
        }
        return estado.contexto;
    }

    // ------------------------------------------------------------------ plantilla
    async function descargarPlantilla() {
        if (typeof XLSX === 'undefined') { mostrarMensaje('La librería de Excel no se cargó. Recarga la página.'); return; }
        try {
            const { tiendas, bodegas } = await obtenerContexto(true);
            const R = window.ReglasImportacionInventario;
            const tiendaEjemplo = tiendas[0]?.nombre || 'Nombre de la tienda';
            const bodegaEjemplo = bodegas[0]?.nombre || 'Nombre de la bodega';

            const hojaDatos = XLSX.utils.aoa_to_sheet([
                R.COLUMNAS,
                ['JUG-001', 'Pelota de fútbol', 'ITM-001', 24, 'tienda', tiendaEjemplo, 25000, 20000, 2, 12, ''],
                ['JUG-001', 'Pelota de fútbol', 'ITM-001', 100, 'bodega', bodegaEjemplo, 25000, 20000, '', '', '']
            ]);
            hojaDatos['!cols'] = R.COLUMNAS.map(c => ({ wch: Math.max(14, c.length + 2) }));

            const hojaUbicaciones = XLSX.utils.aoa_to_sheet([
                ['tipo_ubicacion', 'ubicacion'],
                ...tiendas.map(t => ['tienda', t.nombre]),
                ...bodegas.map(b => ['bodega', b.nombre])
            ]);
            hojaUbicaciones['!cols'] = [{ wch: 16 }, { wch: 30 }];

            const hojaInstrucciones = XLSX.utils.aoa_to_sheet([
                ['Columna', 'Obligatoria', 'Descripción'],
                ['codigo', 'Sí', 'Código del juguete. Si ya existe en la ubicación, se actualiza.'],
                ['nombre', 'Sí', 'Nombre del juguete. Debe coincidir con el nombre existente para ese código.'],
                ['item', 'No', 'Código ITEM.'],
                ['cantidad', 'Sí', 'Entero mayor o igual a 0.'],
                ['tipo_ubicacion', 'Sí', '"tienda" o "bodega".'],
                ['ubicacion', 'Sí', 'Nombre exacto de la tienda o bodega (ver hoja Ubicaciones).'],
                ['precio_min', 'No', 'Precio mínimo de venta en pesos (ej. 25000).'],
                ['precio_por_mayor', 'No', 'Precio al por mayor en pesos.'],
                ['numero_bultos', 'No', 'Entero.'],
                ['cantidad_por_bulto', 'No', 'Entero.'],
                ['foto_url', 'No', 'URL de la foto (http:// o https://).'],
                [],
                ['Las columnas opcionales vacías no modifican el valor que ya tenga el juguete.']
            ]);
            hojaInstrucciones['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 80 }];

            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, hojaDatos, 'Inventario');
            XLSX.utils.book_append_sheet(libro, hojaUbicaciones, 'Ubicaciones');
            XLSX.utils.book_append_sheet(libro, hojaInstrucciones, 'Instrucciones');
            XLSX.writeFile(libro, 'plantilla_inventario_toyswalls.xlsx');
        } catch (error) {
            console.error('Error al generar la plantilla:', error);
            mostrarMensaje('No se pudo generar la plantilla: ' + error.message);
        }
    }

    // ------------------------------------------------------------------ lectura y vista previa
    function leerArchivo(archivo) {
        return new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = e => {
                try {
                    const libro = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                    const hoja = libro.Sheets[libro.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true, blankrows: false }));
                } catch (error) {
                    reject(new Error('El archivo no es un Excel válido (' + error.message + ')'));
                }
            };
            lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
            lector.readAsArrayBuffer(archivo);
        });
    }

    async function alSeleccionarArchivo(evento) {
        const archivo = evento.target.files && evento.target.files[0];
        mostrarMensaje('');
        limpiarVistaPrevia();
        $('importarResultado').innerHTML = '';
        if (!archivo) return;
        if (typeof XLSX === 'undefined') { mostrarMensaje('La librería de Excel no se cargó. Recarga la página.'); return; }
        if (archivo.size > 5 * 1024 * 1024) { mostrarMensaje('El archivo supera 5 MB.'); return; }

        try {
            estado.nombreArchivo = archivo.name;
            const R = window.ReglasImportacionInventario;
            const matriz = await leerArchivo(archivo);
            const { filas, faltantes, desconocidas } = R.leerMatriz(matriz);
            if (faltantes.length) {
                mostrarMensaje(`Faltan columnas obligatorias: ${faltantes.join(', ')}. Usa la plantilla.`);
                return;
            }
            if (!filas.length) { mostrarMensaje('El archivo no tiene filas con datos.'); return; }
            if (filas.length > 5000) { mostrarMensaje('Máximo 5000 filas por archivo. Divide el archivo.'); return; }

            const contexto = await obtenerContexto(true);
            const { validas, errores } = R.validar(filas, contexto);
            estado.validas = validas;
            estado.errores = errores;
            renderizarVistaPrevia(desconocidas);
        } catch (error) {
            console.error('Error al procesar el archivo:', error);
            mostrarMensaje(error.message);
        }
    }

    function renderizarVistaPrevia(desconocidas = []) {
        const R = window.ReglasImportacionInventario;
        const modo = $('importarModoSelect').value;
        const plan = R.planificar(estado.validas, estado.contexto.juguetes, modo);
        const crear = plan.filter(p => p.accion === 'crear').length;
        const actualizar = plan.length - crear;

        const filasPlan = plan.map(p => `
            <tr>
                <td>${p.fila.numeroFila}</td>
                <td><span style="color:#10b981;font-weight:600;">✓ ${p.accion === 'crear' ? 'Crear' : 'Actualizar'}</span></td>
                <td>${escaparHtml(p.fila.codigo)}</td>
                <td>${escaparHtml(p.fila.nombre)}</td>
                <td>${escaparHtml((p.fila.tipoUbicacion === 'tienda' ? 'Tienda ' : 'Bodega ') + p.fila.ubicacionNombre)}</td>
                <td>${p.accion === 'crear' ? p.cantidadNueva : `${p.cantidadAnterior} → ${p.cantidadNueva}`}</td>
            </tr>`);
        const filasError = estado.errores.map(e => `
            <tr style="background:#fef2f2;">
                <td>${e.numeroFila}</td>
                <td><span style="color:#ef4444;font-weight:600;">✗ Error</span></td>
                <td>${escaparHtml(e.codigo)}</td>
                <td colspan="3" style="color:#b91c1c;">${e.mensajes.map(escaparHtml).join('<br>')}</td>
            </tr>`);
        const todas = [...filasError, ...filasPlan];

        $('importarVistaPrevia').innerHTML = `
            <div style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;">
                <strong>${escaparHtml(estado.nombreArchivo)}</strong>:
                ${estado.validas.length} fila(s) válida(s) (${crear} por crear, ${actualizar} por actualizar) ·
                <span style="color:${estado.errores.length ? '#ef4444' : '#10b981'};">${estado.errores.length} con errores</span>
                ${estado.errores.length ? '<br><small>Las filas con errores no se importan. Corrígelas en el archivo y vuelve a subirlo, o importa solo las válidas.</small>' : ''}
                ${desconocidas.length ? `<br><small>Columnas ignoradas: ${desconocidas.map(escaparHtml).join(', ')}</small>` : ''}
            </div>
            <div style="max-height:420px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;">
                <table class="data-table" id="importarTablaVistaPrevia" style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead><tr><th>Fila</th><th>Estado</th><th>Código</th><th>Nombre / Error</th><th>Ubicación</th><th>Cantidad</th></tr></thead>
                    <tbody>${todas.join('')}</tbody>
                </table>
            </div>`;

        const boton = $('importarConfirmarBtn');
        boton.style.display = estado.validas.length ? 'block' : 'none';
        boton.innerHTML = `<i class="fas fa-file-import"></i> Importar ${estado.validas.length} fila(s) válida(s)`;
    }

    // ------------------------------------------------------------------ importar
    async function importar() {
        if (!estado.validas.length) return;
        const R = window.ReglasImportacionInventario;
        const modo = $('importarModoSelect').value;
        const mensajeModo = modo === 'sumar' ? 'se SUMARÁN a la cantidad actual' : 'REEMPLAZARÁN la cantidad actual';
        if (!confirm(`Se importarán ${estado.validas.length} fila(s). En los juguetes existentes las cantidades ${mensajeModo}. ¿Continuar?`)) return;

        const boton = $('importarConfirmarBtn');
        boton.disabled = true;
        try {
            // Recalcular el plan con el inventario actual por si cambió desde la vista previa
            const contexto = await obtenerContexto(true);
            const plan = R.planificar(estado.validas, contexto.juguetes, modo);
            const user = usuarioActual();
            const resultado = await window.servicioImportacionInventario.aplicar(plan, modo, user.empresa_id,
                (hechos, total) => { boton.textContent = `Importando ${hechos}/${total}...`; });

            const omitidas = estado.errores.length;
            const fallidos = resultado.fallidos.map(f =>
                `<li>Fila ${f.numeroFila} (código ${escaparHtml(f.codigo)}): ${escaparHtml(f.motivo)}</li>`).join('');
            $('importarResultado').innerHTML = `
                <div class="${resultado.fallidos.length || omitidas ? 'error-message' : 'success-message'}" style="display:block;">
                    <strong>Importación terminada.</strong>
                    ${resultado.creados} creado(s), ${resultado.actualizados} actualizado(s)` +
                    `${resultado.fallidos.length ? `, ${resultado.fallidos.length} fallido(s)` : ''}` +
                    `${omitidas ? `, ${omitidas} omitido(s) por errores de validación` : ''}.
                    ${fallidos ? `<ul style="margin:8px 0 0 18px;">${fallidos}</ul>` : ''}
                </div>`;
            limpiarVistaPrevia();
            $('importarArchivoInput').value = '';
            estado.contexto = null;
            if (typeof window.loadInventario === 'function') window.loadInventario();
            if (typeof window.loadDashboardSummary === 'function') window.loadDashboardSummary();
        } catch (error) {
            console.error('Error al importar:', error);
            mostrarMensaje('Error al importar: ' + error.message);
        } finally {
            boton.disabled = false;
        }
    }

    function inicializar() {
        const seccion = $('importarInventarioSection');
        if (!seccion) return;
        if (!usuarioActual()) {
            // La sesión aún se está validando (Supabase Auth): esperar a dashboard.js
            seccion.style.display = 'none';
            window.addEventListener('toyswall:sesion-lista', inicializar, { once: true });
            return;
        }
        if (!esAdmin()) { seccion.style.display = 'none'; return; }
        seccion.style.display = '';
        $('importarDescargarPlantillaBtn').addEventListener('click', descargarPlantilla);
        $('importarArchivoInput').addEventListener('change', alSeleccionarArchivo);
        $('importarConfirmarBtn').addEventListener('click', importar);
        $('importarModoSelect').addEventListener('change', () => {
            if (estado.contexto && (estado.validas.length || estado.errores.length)) renderizarVistaPrevia();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
