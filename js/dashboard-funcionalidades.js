// ============================================
// FUNCIONALIDADES COMPLETAS DEL DASHBOARD
// ============================================

// Variables globales
let ventaItems = []; // Array para almacenar items de la venta actual
let currentFacturaData = null; // Datos de la factura actual

// Variables para deshacer operaciones
let ultimaVenta = null; // Última venta registrada (para deshacer)

// Función para capitalizar la primera letra
function capitalizarPrimeraLetra(texto) {
    if (!texto || typeof texto !== 'string') return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

// ============================================
// DASHBOARD - RESUMEN
// ============================================

async function loadDashboardSummary() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user || !user.empresa_id) {
            console.error('Usuario no válido');
            return;
        }
        const isEmpleado = user.tipo_usuario_id === 3;
        
        // Cargar totales (optimizado: solo counts)
        // Para empleados, las ventas solo cuentan las NO mayoristas (es_por_mayor = false)
        let ventasTotalesQuery = window.supabaseClient
            .from('ventas')
            .select('precio_venta')
            .eq('empresa_id', user.empresa_id);
        if (isEmpleado) {
            ventasTotalesQuery = ventasTotalesQuery.eq('es_por_mayor', false);
        }

        const [tiendas, bodegas, usuarios, ventas] = await Promise.all([
            window.supabaseClient.from('tiendas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('bodegas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('usuarios').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            ventasTotalesQuery
        ]);

        // Verificar errores
        if (tiendas.error) {
            console.error('Error al cargar tiendas:', tiendas.error);
        }
        if (bodegas.error) {
            console.error('Error al cargar bodegas:', bodegas.error);
        }
        if (usuarios.error) {
            console.error('Error al cargar usuarios:', usuarios.error);
        }
        if (ventas.error) {
            console.error('Error al cargar ventas:', ventas.error);
        }

        const totalTiendasEl = document.getElementById('totalTiendas');
        const totalBodegasEl = document.getElementById('totalBodegas');
        const totalUsuariosEl = document.getElementById('totalUsuarios');
        const totalGananciasEl = document.getElementById('totalGanancias');

        if (totalTiendasEl) {
            totalTiendasEl.textContent = tiendas.count || 0;
        }
        if (totalBodegasEl) {
            totalBodegasEl.textContent = bodegas.count || 0;
        }
        if (totalUsuariosEl) {
            totalUsuariosEl.textContent = usuarios.count || 0;
        }
        
        // Calcular ganancias
        const totalGanancias = (ventas.data || []).reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
        if (totalGananciasEl) {
            totalGananciasEl.textContent = '$' + totalGanancias.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // Cargar ventas recientes (cargar sin relaciones automáticas, usar juguete_codigo)
        const ventasList = document.getElementById('ventasRecientes');
        try {
            // Cargar ventas sin relaciones (ya no hay foreign key)
            let ventasRecientesQuery = window.supabaseClient
                .from('ventas')
                .select('*')
                .eq('empresa_id', user.empresa_id)
                .order('created_at', { ascending: false })
                .limit(5);
            // Empleados NO deben ver ventas al por mayor
            if (isEmpleado) {
                ventasRecientesQuery = ventasRecientesQuery.eq('es_por_mayor', false);
            }
            const { data: ventasSimples, error: errorSimple } = await ventasRecientesQuery;
            
            if (errorSimple) {
                throw errorSimple;
            }

            // Cargar juguetes y empleados por separado (usando código)
            if (ventasSimples && ventasSimples.length > 0) {
                const jugueteCodigos = [...new Set(ventasSimples.map(v => v.juguete_codigo).filter(c => c))];
                const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
                
                const [juguetesData, empleadosData] = await Promise.all([
                    jugueteCodigos.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id) : { data: [] },
                    empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
                ]);

                const juguetesMap = new Map((juguetesData.data || []).map(j => [j.codigo, j]));
                const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

                ventasList.innerHTML = ventasSimples.map(v => {
                    const juguete = juguetesMap.get(v.juguete_codigo);
                    const empleado = empleadosMap.get(v.empleado_id);
                    return `
                        <div class="venta-item">
                            <div class="venta-info">
                                <strong>${juguete?.nombre || 'N/A'}</strong>
                                <span>${v.codigo_venta}</span>
                            </div>
                            <div class="venta-precio">$${parseFloat(v.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                    `;
                }).join('');
            } else {
                ventasList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas recientes</p>';
            }
        } catch (error) {
            console.error('Error al cargar ventas recientes:', error);
            if (ventasList) {
                ventasList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas recientes</p>';
            }
        }

        // Cargar gráfico de ventas del mes en el dashboard
        await cargarGraficoVentasDashboard();
    } catch (error) {
        console.error('Error al cargar resumen del dashboard:', error);
    }
}

// ============================================
// UTILIDADES: PREVENIR CLICS MÚLTIPLES
// ============================================

/**
 * Función utilitaria para prevenir clics múltiples en botones críticos
 * @param {HTMLElement|string} button - El botón o selector del botón
 * @param {Function} asyncFunction - La función async a ejecutar
 * @param {Object} options - Opciones de configuración
 */
async function preventDoubleClick(button, asyncFunction, options = {}) {
    const {
        loadingText = 'Procesando...',
        disabledClass = 'btn-disabled',
        showSpinner = true,
        spinnerHTML = '<i class="fas fa-spinner fa-spin"></i>'
    } = options;
    
    // Obtener el elemento del botón
    const btnElement = typeof button === 'string' 
        ? document.querySelector(button) 
        : button;
    
    if (!btnElement) {
        console.error('Botón no encontrado:', button);
        return;
    }
    
    // Si ya está procesando, ignorar el clic
    if (btnElement.dataset.processing === 'true') {
        return;
    }
    
    // Marcar como procesando
    btnElement.dataset.processing = 'true';
    btnElement.disabled = true;
    btnElement.classList.add(disabledClass);
    
    // Guardar el contenido original
    const originalHTML = btnElement.innerHTML;
    const originalText = btnElement.textContent || btnElement.innerText;
    
    // Mostrar estado de carga
    if (showSpinner) {
        btnElement.innerHTML = `${spinnerHTML} ${loadingText}`;
    } else {
        btnElement.textContent = loadingText;
    }
    
    try {
        // Ejecutar la función
        await asyncFunction();
    } catch (error) {
        console.error('Error en función protegida:', error);
        throw error; // Re-lanzar el error para que el código que llama pueda manejarlo
    } finally {
        // Restaurar el botón
        btnElement.dataset.processing = 'false';
        btnElement.disabled = false;
        btnElement.classList.remove(disabledClass);
        btnElement.innerHTML = originalHTML;
    }
}

/**
 * Wrapper para formularios que previene envíos múltiples
 */
function preventFormDoubleSubmit(form, submitHandler) {
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Si ya está procesando, ignorar
        if (form.dataset.processing === 'true') {
            return;
        }
        
        // Obtener el botón de submit
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        
        if (submitButton) {
            await preventDoubleClick(submitButton, async () => {
                await submitHandler.call(form, e);
            }, {
                loadingText: 'Procesando...',
                showSpinner: true
            }).catch(() => { /* el error ya se registró en consola */ });
        } else {
            // Si no hay botón de submit, marcar el formulario directamente
            form.dataset.processing = 'true';
            try {
                await submitHandler.call(form, e);
            } finally {
                form.dataset.processing = 'false';
            }
        }
    });
}

/**
 * Oculta los mensajes de un formulario a los 6 s. Si se muestra un mensaje nuevo antes,
 * se reinicia el temporizador (antes el temporizador del mensaje anterior ocultaba el nuevo
 * casi de inmediato y el usuario no alcanzaba a leer el error).
 */
const temporizadoresMensajes = new WeakMap();
function programarOcultarMensajes(errorMsg, successMsg) {
    if (!errorMsg) return;
    clearTimeout(temporizadoresMensajes.get(errorMsg));
    temporizadoresMensajes.set(errorMsg, setTimeout(() => {
        errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
    }, 6000));
}
window.programarOcultarMensajes = programarOcultarMensajes;

// Hacer funciones disponibles globalmente
window.preventDoubleClick = preventDoubleClick;
window.preventFormDoubleSubmit = preventFormDoubleSubmit;

// ============================================
// REGISTRAR VENTA
// ============================================

let registrarVentaInitialized = false;

function initRegistrarVenta() {
    const form = document.getElementById('registrarVentaForm');
    const jugueteCodigoInput = document.getElementById('ventaJugueteCodigo');
    const jugueteItemInput = document.getElementById('ventaJugueteItem');
    const empleadoCodigoInput = document.getElementById('ventaEmpleadoCodigo');
    const agregarItemBtn = document.getElementById('agregarItemBtn');
    const facturarBtn = document.getElementById('facturarBtn');
    
    if (!form || !jugueteCodigoInput || !empleadoCodigoInput || !agregarItemBtn || !facturarBtn) {
        return; // Elementos no disponibles aún
    }

    // Solo inicializar una vez
    if (registrarVentaInitialized) {
        return;
    }
    
    registrarVentaInitialized = true;
    ventaItems = []; // Reiniciar items

    // Verificar tipo de usuario para restringir edición de precio
    const user = JSON.parse(sessionStorage.getItem('user'));
    const isAdmin = user.tipo_usuario_id === 1 || user.tipo_usuario_id === 2;
    const isEmpleado = user.tipo_usuario_id === 3;

    // Configurar formato de precio con separadores de miles
    const ventaPrecioInput = document.getElementById('ventaPrecio');
    // Precio en pesos colombianos ($28.000); el número queda en dataset.numericValue
    window.FormatoMoneda.configurarInput(ventaPrecioInput);

    // Buscar juguete por código
    jugueteCodigoInput.addEventListener('blur', async function() {
        const codigo = this.value.trim();
        if (!codigo) {
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            // Buscar TODOS los juguetes con ese código (puede haber múltiples registros en diferentes ubicaciones)
            const { data: juguetes, error } = await window.supabaseClient
                .from('juguetes')
                .select(`
                    *,
                    tiendas(nombre),
                    bodegas(nombre)
                `)
                .eq('codigo', codigo)
                .eq('empresa_id', user.empresa_id);

            if (error) throw error;

            const jugueteInfo = document.getElementById('jugueteInfo');
            if (juguetes && juguetes.length > 0) {
                // Agrupar por nombre (deben tener el mismo nombre si tienen el mismo código)
                const juguetePrincipal = juguetes[0];
                const nombreJuguete = juguetePrincipal.nombre;
                const fotoUrl = juguetePrincipal.foto_url;
                const precioMin = juguetePrincipal.precio_min;
                const item = juguetePrincipal.item;
                
                // Autocompletar ITEM si existe
                if (jugueteItemInput && item) {
                    jugueteItemInput.value = item;
                }
                
                // Calcular cantidad total sumando todas las ubicaciones
                const cantidadTotal = juguetes.reduce((sum, j) => sum + (j.cantidad || 0), 0);
                
                // Obtener todas las ubicaciones donde está disponible (solo las que tienen cantidad > 0)
                const ubicaciones = [];
                juguetes.forEach(j => {
                    const cantidad = j.cantidad || 0;
                    if (cantidad > 0) {
                        if (j.tienda_id && j.tiendas) {
                            ubicaciones.push({ tipo: 'Tienda', nombre: j.tiendas.nombre, cantidad: cantidad });
                        } else if (j.bodega_id && j.bodegas) {
                            ubicaciones.push({ tipo: 'Bodega', nombre: j.bodegas.nombre, cantidad: cantidad });
                        }
                    }
                });
                
                let ubicacionInfo = '';
                if (ubicaciones.length > 0) {
                    ubicacionInfo = '<br><small style="color: #64748b;">Ubicaciones disponibles:</small><br>';
                    ubicaciones.forEach(ubic => {
                        if (ubic.tipo === 'Tienda') {
                            ubicacionInfo += `<small style="color: #10b981;">✓ ${ubic.tipo}: ${ubic.nombre} (${ubic.cantidad})</small><br>`;
                        } else {
                            ubicacionInfo += `<small style="color: #3b82f6;">📦 ${ubic.tipo}: ${ubic.nombre} (${ubic.cantidad})</small><br>`;
                        }
                    });
                } else {
                    ubicacionInfo = '<br><small style="color: #ef4444;">✗ Sin stock disponible</small>';
                }

                // Mostrar precio mínimo con formato mejorado
                let precioInfo = '';
                if (precioMin !== null && precioMin !== undefined) {
                    const precioFormateado = precioMin.toLocaleString('es-CO', { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 0 
                    });
                    precioInfo = `<br><small style="color: #64748b; font-size: 14px; font-weight: 600;">💰 Precio mínimo: <span style="color: #ef4444; font-size: 16px; font-weight: bold;">$${precioFormateado}</span></small>`;
                }

                // Mostrar imagen si existe
                let imagenHTML = '';
                const fotoUrlLimpia = fotoUrl ? fotoUrl.trim() : '';
                if (fotoUrlLimpia && fotoUrlLimpia !== '') {
                    // Validar que sea una URL válida
                    try {
                        new URL(fotoUrlLimpia);
                        imagenHTML = `<div style="margin-bottom: 10px; text-align: center;" id="jugueteImagenContainer">
                            <img src="${fotoUrlLimpia}" alt="${nombreJuguete}" 
                                 style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 2px solid #e2e8f0; object-fit: cover; display: block; margin: 0 auto; background: #f1f5f9;"
                                 onerror="const container = document.getElementById('jugueteImagenContainer'); if(container) { container.innerHTML='<div style=\\'padding: 20px; background: #f1f5f9; border-radius: 8px; color: #64748b; border: 2px solid #e2e8f0;\\'><i class=\\'fas fa-image\\' style=\\'font-size: 24px; display: block; margin-bottom: 5px;\\'></i><small>Imagen no disponible</small></div>'; }"
                                 onload="this.style.background='transparent';">
                        </div>`;
                    } catch (e) {
                        // URL inválida
                        imagenHTML = `<div style="margin-bottom: 10px; text-align: center; padding: 20px; background: #f1f5f9; border-radius: 8px; border: 2px solid #e2e8f0;">
                            <i class="fas fa-image" style="font-size: 24px; color: #cbd5e1; display: block; margin-bottom: 5px;"></i>
                            <small style="color: #64748b;">URL inválida</small>
                        </div>`;
                    }
                } else {
                    imagenHTML = `<div style="margin-bottom: 10px; text-align: center; padding: 20px; background: #f1f5f9; border-radius: 8px; border: 2px solid #e2e8f0;">
                        <i class="fas fa-image" style="font-size: 32px; color: #cbd5e1; display: block; margin-bottom: 5px;"></i>
                        <small style="color: #64748b;">Sin imagen</small>
                    </div>`;
                }
                
                jugueteInfo.innerHTML = `
                    <div class="info-box success" style="display: flex; flex-direction: column; gap: 8px;">
                        ${imagenHTML}
                        <div>
                            <strong>${nombreJuguete}</strong><br>
                            <small>Cantidad total disponible: ${cantidadTotal}</small>
                            ${precioInfo}
                            ${ubicacionInfo}
                        </div>
                    </div>
                `;
                jugueteInfo.style.display = 'block';
            } else {
                jugueteInfo.innerHTML = `
                    <div class="info-box error">
                        Juguete no encontrado
                    </div>
                `;
                jugueteInfo.style.display = 'block';
            }
        } catch (error) {
            console.error('Error al buscar juguete:', error);
        }
    });

    // Buscar juguete por ITEM (autocompletar código)
    if (jugueteItemInput) {
        jugueteItemInput.addEventListener('blur', async function() {
            const item = this.value.trim();
            if (!item) return;

            try {
                const user = JSON.parse(sessionStorage.getItem('user'));
                const { data: juguetes, error } = await window.supabaseClient
                    .from('juguetes')
                    .select('codigo, item')
                    .eq('item', item)
                    .eq('empresa_id', user.empresa_id)
                    .limit(1);

                if (error) throw error;

                if (juguetes && juguetes.length > 0) {
                    const juguete = juguetes[0];
                    // Autocompletar código
                    if (jugueteCodigoInput && juguete.codigo) {
                        jugueteCodigoInput.value = juguete.codigo;
                        // Disparar evento blur para buscar el juguete completo
                        jugueteCodigoInput.dispatchEvent(new Event('blur'));
                    }
                }
            } catch (error) {
                console.error('Error al buscar juguete por ITEM:', error);
            }
        });
    }

    // Buscar empleado por código
    empleadoCodigoInput.addEventListener('blur', async function() {
        const codigo = this.value.trim();
        if (!codigo) return;

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            const { data: empleados, error } = await window.supabaseClient
                .from('empleados')
                .select('*')
                .eq('codigo', codigo)
                .eq('empresa_id', user.empresa_id)
                .limit(1);

            if (error) throw error;

            const empleadoInfo = document.getElementById('empleadoInfo');
            if (empleados && empleados.length > 0) {
                const empleado = empleados[0];
                let tiendaInfo = '';
                const empleadosEspeciales = ['Jose', 'Sindy'];
                const esEmpleadoEspecial = empleadosEspeciales.includes(empleado.nombre);
                
                if (esEmpleadoEspecial) {
                    tiendaInfo = '<br><small style="color: #8b5cf6;">⭐ Puede vender en cualquier ubicación</small>';
                } else if (empleado.bodega_id) {
                    // Empleado que vende desde una bodega
                    try {
                        const { data: bodega } = await window.supabaseClient
                            .from('bodegas')
                            .select('nombre')
                            .eq('id', empleado.bodega_id)
                            .limit(1);
                        const nombreBodega = bodega && bodega.length > 0 ? escaparHtmlTienda(bodega[0].nombre) : '';
                        tiendaInfo = `<br><small style="color: #10b981;">✓ Bodega: ${nombreBodega || 'asignada'}</small>`;
                    } catch (error) {
                        tiendaInfo = '<br><small style="color: #10b981;">✓ Asignado a una bodega</small>';
                    }
                } else if (empleado.tienda_id) {
                    // Obtener nombre de la tienda
                    try {
                        const { data: tienda } = await window.supabaseClient
                            .from('tiendas')
                            .select('nombre')
                            .eq('id', empleado.tienda_id)
                            .limit(1);
                        if (tienda && tienda.length > 0) {
                            tiendaInfo = `<br><small style="color: #10b981;">✓ Tienda: ${tienda[0].nombre}</small>`;
                        } else {
                            tiendaInfo = '<br><small style="color: #10b981;">✓ Asignado a una tienda</small>';
                        }
                    } catch (error) {
                        tiendaInfo = '<br><small style="color: #10b981;">✓ Asignado a una tienda</small>';
                    }
                } else {
                    tiendaInfo = '<br><small style="color: #ef4444;">✗ Sin ubicación de venta asignada</small>';
                }
                empleadoInfo.innerHTML = `
                    <div class="info-box success">
                        <strong>${empleado.nombre}</strong><br>
                        <small>Código: ${empleado.codigo}</small>
                        ${tiendaInfo}
                    </div>
                `;
                empleadoInfo.style.display = 'block';
            } else {
                empleadoInfo.innerHTML = `
                    <div class="info-box error">
                        Empleado no encontrado
                    </div>
                `;
                empleadoInfo.style.display = 'block';
            }
        } catch (error) {
            console.error('Error al buscar empleado:', error);
        }
    });

    // Agregar item a la venta (solo una vez). Se protege contra doble clic para no duplicar items.
    agregarItemBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        await preventDoubleClick(agregarItemBtn, agregarItemVenta, { loadingText: 'Agregando...' }).catch(() => {});
    });

    async function agregarItemVenta() {
        const jugueteCodigo = jugueteCodigoInput.value.trim();
        const empleadoCodigo = empleadoCodigoInput.value.trim();
        const cantidadTexto = document.getElementById('ventaCantidad')?.value ?? '1';
        const cantidad = ReglasInventario.parsearCantidad(cantidadTexto);
        // Obtener el valor numérico real del campo de precio (puede estar formateado)
        const precioInput = document.getElementById('ventaPrecio');
        const precio = ReglasInventario.parsearPrecio(precioInput?.dataset.numericValue || precioInput?.value);
        const metodoPago = document.getElementById('ventaMetodoPago').value;

        if (!jugueteCodigo) {
            showVentaMessage('Ingresa el código del juguete', 'error');
            return;
        }
        if (cantidad === null) {
            showVentaMessage('La cantidad debe ser un número entero mayor o igual a 1', 'error');
            return;
        }
        if (!precio || precio <= 0) {
            showVentaMessage('Ingresa un precio unitario válido (solo números, mayor a 0)', 'error');
            return;
        }
        if (!metodoPago) {
            showVentaMessage('Selecciona el método de pago', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            let empleado = null;
            let esEmpleadoEspecial = false;
            
            // Si se proporcionó código de empleado, validarlo
            if (empleadoCodigo) {
                const { data: empleadosData, error: empleadoError } = await window.supabaseClient
                    .from('empleados')
                    .select('*')
                    .eq('codigo', empleadoCodigo)
                    .eq('empresa_id', user.empresa_id)
                    .limit(1);

                if (empleadoError) {
                    console.error('Error al buscar empleado:', empleadoError);
                    showVentaMessage('Error al buscar empleado: ' + empleadoError.message, 'error');
                    return;
                }

                if (!empleadosData || empleadosData.length === 0) {
                    showVentaMessage('Empleado no encontrado', 'error');
                    return;
                }

                empleado = empleadosData[0];
                
                // Empleados especiales que pueden vender en cualquier parte: Jose y Sindy
                const empleadosEspeciales = ['Jose', 'Sindy'];
                esEmpleadoEspecial = empleadosEspeciales.includes(empleado.nombre);

                if (!esEmpleadoEspecial && !ReglasUbicacionEmpleado.deEmpleado(empleado)) {
                    showVentaMessage('El empleado no tiene una ubicación de venta (tienda o bodega) asignada. No puede realizar ventas.', 'error');
                    return;
                }
            }
            // Sin empleado: el usuario actual (admin) puede vender desde cualquier ubicación

            // Buscar TODOS los registros con ese código (uno por ubicación)
            const { data: juguetesData, error: jugueteError } = await window.supabaseClient
                .from('juguetes')
                .select('*, tiendas(nombre), bodegas(nombre)')
                .eq('codigo', jugueteCodigo)
                .eq('empresa_id', user.empresa_id);

            if (jugueteError) {
                console.error('Error al buscar juguete:', jugueteError);
                showVentaMessage('Error al buscar juguete: ' + jugueteError.message, 'error');
                return;
            }

            // Unidades ya reservadas por items anteriores de esta misma venta (por registro)
            const reservado = {};
            ventaItems.forEach(it => {
                if (it.juguete_id) reservado[it.juguete_id] = (reservado[it.juguete_id] || 0) + it.cantidad;
            });

            // Seleccionar la ubicación de la que se descontará (regla de dominio)
            const { fila: juguete, error: errorUbicacion } = ReglasInventario.seleccionarUbicacionVenta(juguetesData, {
                cantidad,
                // Tienda o bodega del empleado (null = puede vender desde cualquier ubicación)
                ubicacionEmpleado: empleado && !esEmpleadoEspecial ? ReglasUbicacionEmpleado.deEmpleado(empleado) : null,
                reservado
            });
            if (!juguete) {
                showVentaMessage(errorUbicacion, 'error');
                return;
            }

            // Validar precio según tipo de usuario
            if (juguete.precio_min !== null && juguete.precio_min !== undefined) {
                if (isEmpleado && precio < juguete.precio_min) {
                    // Empleados solo pueden usar precio mayor o igual al precio mínimo
                    const fmt = n => Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    showVentaMessage(
                        `El precio debe ser mayor o igual al precio mínimo ($${fmt(juguete.precio_min)}). Precio ingresado: $${fmt(precio)}`,
                        'error'
                    );
                    return;
                }
                // Administradores pueden usar cualquier precio (mayor, igual o menor al mínimo) - sin validación
            } else if (isEmpleado) {
                // Si es empleado y no hay precio mínimo, no puede vender
                showVentaMessage('Este juguete no tiene precio mínimo configurado. Contacta a un administrador.', 'error');
                return;
            }

            // Agregar item (se guarda el registro/ubicación exacta de la que se descontará)
            ventaItems.push({
                juguete_id: juguete.id,
                ubicacion_nombre: ReglasInventario.describirUbicacion(juguete),
                juguete_codigo: juguete.codigo,
                juguete_nombre: juguete.nombre,
                juguete_item: juguete.item || null,
                juguete_foto_url: juguete.foto_url || null,
                empleado_id: empleado ? empleado.id : null,
                empleado_nombre: empleado ? empleado.nombre : 'Sin empleado',
                empleado_codigo: empleado ? empleado.codigo : null,
                cantidad: cantidad,
                precio: precio,
                metodo_pago: metodoPago
            });

            // Actualizar lista de items (esto también removerá los atributos required)
            updateVentaItemsList();
            
            // Asegurarse de que el formulario tenga novalidate cuando hay items
            const form = document.getElementById('registrarVentaForm');
            if (form && ventaItems.length > 0) {
                form.setAttribute('novalidate', 'novalidate');
            }
            
            // Limpiar campos del juguete (se conservan empleado y método de pago para agilizar)
            jugueteCodigoInput.value = '';
            if (jugueteItemInput) jugueteItemInput.value = '';
            document.getElementById('ventaCantidad').value = '1';
            if (precioInput) {
                precioInput.value = '';
                precioInput.dataset.numericValue = '';
            }
            const jugueteInfo = document.getElementById('jugueteInfo');
            if (jugueteInfo) jugueteInfo.style.display = 'none';

            showVentaMessage(`Item agregado correctamente (se descontará de ${ReglasInventario.describirUbicacion(juguete)})`, 'success');
        } catch (error) {
            console.error('Error al agregar item:', error);
            showVentaMessage('Error al agregar item: ' + error.message, 'error');
        }
    }


    // Registrar venta - con protección contra clics múltiples
    preventFormDoubleSubmit(form, async function(e) {
        if (ventaItems.length === 0) {
            showVentaMessage('Debes agregar al menos un item a la venta', 'error');
            return;
        }

        // El formulario ya debería tener novalidate y los campos sin required
        // si hay items (manejado en updateVentaItemsList)
        if (!form.hasAttribute('novalidate')) {
            form.setAttribute('novalidate', 'novalidate');
        }

        // Array para almacenar información de cada venta registrada (para deshacer)
        const ventasRegistradas = [];
        let codigoVenta = null;

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));

            if (window.usarStockRpc && window.usarStockRpc()) {
                // Una sola transacción en la BD: descuenta stock y registra todas las líneas (o nada)
                const resultado = await window.servicioStockRpc.registrarVenta({
                    items: ventaItems.map(item => ({
                        juguete_id: item.juguete_id,
                        cantidad: item.cantidad,
                        precio_unitario: item.precio,
                        empleado_id: item.empleado_id,
                        metodo_pago: item.metodo_pago
                    })),
                    metodoPago: ventaItems[0].metodo_pago
                });
                codigoVenta = resultado.codigo_venta;
                (resultado.ventas || []).forEach(v => ventasRegistradas.push({
                    venta_id: v.venta_id,
                    codigo_venta: codigoVenta,
                    juguete_info: {
                        juguete_id: v.juguete_id,
                        juguete_codigo: v.juguete_codigo,
                        juguete_nombre: v.juguete_nombre,
                        tienda_id: v.tienda_id,
                        bodega_id: v.bodega_id
                    },
                    cantidad_vendida: v.cantidad,
                    precio_venta: v.precio_venta,
                    empleado_id: v.empleado_id,
                    metodo_pago: v.metodo_pago
                }));
                showVentaMessage(`Venta ${codigoVenta} registrada correctamente`, 'success');
                ventaItems = [];
                updateVentaItemsList();
                form.reset();
                if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
                return;
            }
            
            // Generar un solo código de venta para todos los items
            codigoVenta = await generarCodigoVenta();
            
            // Registrar cada item como parte de la misma venta
            for (const item of ventaItems) {
                const cantidad = item.cantidad;

                // 1. Descontar del registro exacto elegido al agregar el item (valida stock y concurrencia)
                const { anterior, fila } = await window.servicioStock.descontar(item.juguete_id, cantidad);

                // 2. Registrar venta; si falla, devolver el stock descontado
                const { data: ventaInsertada, error } = await window.supabaseClient
                    .from('ventas')
                    .insert({
                        codigo_venta: codigoVenta,
                        juguete_codigo: item.juguete_codigo,
                        empleado_id: item.empleado_id,
                        precio_venta: item.precio * cantidad,
                        cantidad: cantidad,
                        metodo_pago: item.metodo_pago,
                        empresa_id: user.empresa_id
                    })
                    .select()
                    .single();

                if (error) {
                    await window.servicioStock.reponer(item.juguete_id, cantidad, fila).catch(err => console.error('No se pudo reponer el stock:', err));
                    throw error;
                }
                
                // Guardar información de la venta registrada (para deshacer y logging)
                ventasRegistradas.push({
                    venta_id: ventaInsertada.id,
                    codigo_venta: codigoVenta,
                    juguete_info: {
                        juguete_id: fila.id,
                        juguete_codigo: fila.codigo,
                        juguete_nombre: fila.nombre,
                        cantidad_original: anterior,
                        bodega_id: fila.bodega_id,
                        tienda_id: fila.tienda_id,
                        fila_respaldo: fila
                    },
                    cantidad_vendida: cantidad,
                    precio_venta: item.precio * cantidad,
                    empleado_id: item.empleado_id,
                    empleado_codigo: item.empleado_codigo,
                    metodo_pago: item.metodo_pago
                });
            }

            showVentaMessage(`Venta ${codigoVenta} registrada correctamente`, 'success');
            ventaItems = [];
            updateVentaItemsList(); // Esto restaurará los atributos required automáticamente
            form.reset();
            
            // Recargar resumen
            if (typeof loadDashboardSummary === 'function') {
                loadDashboardSummary();
            }
        } catch (error) {
            console.error('Error al registrar venta:', error);
            if (ventasRegistradas.length > 0) {
                // Registro parcial: quitar de la lista los items ya guardados y permitir deshacerlos
                const guardados = ventasRegistradas.length;
                ventaItems = ventaItems.slice(guardados);
                updateVentaItemsList();
                showVentaMessage(`Se registraron ${guardados} item(s) de la venta ${codigoVenta}, pero falló el siguiente: ${error.message}. Puedes deshacer lo registrado o corregir y volver a intentar.`, 'error');
            } else {
                showVentaMessage('Error al registrar la venta: ' + error.message, 'error');
            }
        } finally {
            // Guardar información de la última venta (completa o parcial) para poder deshacerla
            if (ventasRegistradas.length > 0) {
                ultimaVenta = {
                    codigo_venta: codigoVenta,
                    ventas: ventasRegistradas,
                    timestamp: new Date().toISOString()
                };
                actualizarBotonDeshacerVenta(true);
            }
        }
    });

    // Botón facturar - ahora permite facturar ventas ya registradas
    facturarBtn.addEventListener('click', async function() {
        // Si hay items sin registrar, pedir registrar primero: antes se facturaban items que nunca
        // se guardaban como venta ni descontaban stock (factura sin venta).
        if (ventaItems.length > 0) {
            showVentaMessage('Primero registra la venta con "Registrar Venta" y luego usa "Facturar" para seleccionarla.', 'error');
            return;
        }
        
        // Si no hay items, mostrar lista de ventas registradas para facturar
        await showVentasParaFacturar();
    });
    
    // Inicializar botón deshacer
    inicializarBotonDeshacerVenta();
}

// Función global para remover item
window.removeVentaItem = function(index) {
    ventaItems.splice(index, 1);
    updateVentaItemsList();
};

// ============================================
// FUNCIONES PARA DESHACER VENTA
// ============================================

// Función para actualizar la visibilidad del botón deshacer venta
function actualizarBotonDeshacerVenta(mostrar) {
    const botonDeshacer = document.getElementById('deshacerVentaBtn');
    if (botonDeshacer) {
        botonDeshacer.style.display = mostrar ? 'inline-flex' : 'none';
    }
}

// Función para deshacer la última venta
async function deshacerUltimaVenta() {
    if (!ultimaVenta) {
        showVentaMessage('No hay venta para deshacer', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que deseas deshacer la última venta? Esta acción revertirá todos los cambios realizados.')) {
        return;
    }
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));

        if (window.usarStockRpc && window.usarStockRpc()) {
            // La BD repone cada línea en su ubicación de origen, registra el log y elimina la venta (todo o nada)
            await window.servicioStockRpc.deshacerVenta(ultimaVenta.codigo_venta);
            ultimaVenta = null;
            actualizarBotonDeshacerVenta(false);
            showVentaMessage('Venta deshecha correctamente', 'success');
            if (typeof loadDashboardSummary === 'function') await loadDashboardSummary();
            return;
        }
        
        // Revertir cada venta en orden inverso
        for (let i = ultimaVenta.ventas.length - 1; i >= 0; i--) {
            const ventaInfo = ultimaVenta.ventas[i];
            
            // 1. Registrar log de deshacer antes de revertir cambios
            try {
                // Obtener código del empleado si no está en ventaInfo
                let codigoVendedor = ventaInfo.empleado_codigo;
                if (!codigoVendedor && ventaInfo.empleado_id) {
                    const { data: empleadoData } = await window.supabaseClient
                        .from('empleados')
                        .select('codigo')
                        .eq('id', ventaInfo.empleado_id)
                        .eq('empresa_id', user.empresa_id)
                        .limit(1)
                        .single();
                    if (empleadoData) {
                        codigoVendedor = empleadoData.codigo;
                    }
                }
                
                // Registrar en logs_deshacer_ventas
                const datosLog = {
                    empresa_id: user.empresa_id,
                    usuario_id: user.id || null,
                    codigo_venta: ultimaVenta.codigo_venta,
                    codigo_vendedor: codigoVendedor || null,
                    empleado_id: ventaInfo.empleado_id || null,
                    juguete_codigo: ventaInfo.juguete_info?.juguete_codigo || null,
                    juguete_nombre: ventaInfo.juguete_info?.juguete_nombre || null,
                    precio_venta: ventaInfo.precio_venta || 0,
                    cantidad: ventaInfo.cantidad_vendida || 1
                };
                let { data: logInsertado, error: logError } = await window.supabaseClient
                    .from('logs_deshacer_ventas')
                    .insert(datosLog)
                    .select()
                    .single();
                // Sin la migración 2026_09_30_03 la columna usuario_id es INTEGER y los usuarios tienen id UUID
                // (error 22P02): reintentar sin usuario para que el log no se pierda.
                if (logError && logError.code === '22P02') {
                    ({ data: logInsertado, error: logError } = await window.supabaseClient
                        .from('logs_deshacer_ventas')
                        .insert({ ...datosLog, usuario_id: null })
                        .select()
                        .single());
                }
                
                if (logError) {
                    console.error('Error al registrar log de deshacer venta:', logError);
                    // Mostrar advertencia pero no bloquear el deshacer
                    console.warn('El deshacer se completó pero no se pudo registrar el log:', logError.message);
                } else {
                    console.log('Log de deshacer registrado correctamente:', logInsertado);
                }
            } catch (logError) {
                console.error('Error inesperado al registrar log de deshacer venta:', logError);
                // No bloquear el deshacer por un error de log
            }

            // 2. Eliminar el registro de venta (si falla, no se toca el stock)
            const { error: errorEliminar } = await window.supabaseClient
                .from('ventas')
                .delete()
                .eq('id', ventaInfo.venta_id);
            if (errorEliminar) throw errorEliminar;

            // 3. Devolver las unidades al mismo registro/ubicación de donde salieron.
            //    Se suma a la cantidad ACTUAL (no se sobrescribe con la original) para no pisar
            //    ventas o movimientos hechos después; si el registro ya no existe, se recrea.
            await window.servicioStock.reponer(
                ventaInfo.juguete_info.juguete_id,
                ventaInfo.cantidad_vendida,
                ventaInfo.juguete_info.fila_respaldo || null
            );

            // Quitar de la lista las ventas ya revertidas (por si falla una intermedia)
            ultimaVenta.ventas.splice(i, 1);
        }
        
        // Limpiar última venta
        ultimaVenta = null;
        actualizarBotonDeshacerVenta(false);
        
        showVentaMessage('Venta deshecha correctamente', 'success');
        
        // Recargar resumen
        if (typeof loadDashboardSummary === 'function') {
            await loadDashboardSummary();
        }
    } catch (error) {
        console.error('Error al deshacer venta:', error);
        showVentaMessage('Error al deshacer la venta: ' + error.message, 'error');
    }
}

// Función para inicializar el botón deshacer venta
function inicializarBotonDeshacerVenta() {
    const botonDeshacer = document.getElementById('deshacerVentaBtn');
    if (botonDeshacer) {
        // Remover listeners anteriores si existen (clonar y reemplazar)
        const nuevoBtn = botonDeshacer.cloneNode(true);
        botonDeshacer.parentNode.replaceChild(nuevoBtn, botonDeshacer);
        
        // Agregar event listener
        nuevoBtn.addEventListener('click', async function() {
            // Protegido contra doble clic para no revertir dos veces
            await preventDoubleClick(nuevoBtn, deshacerUltimaVenta, { loadingText: 'Deshaciendo...' }).catch(() => {});
        });
        // Ocultar inicialmente
        nuevoBtn.style.display = ultimaVenta ? 'inline-flex' : 'none';
    }
}

// Función para actualizar lista de items (debe ser global)
window.updateVentaItemsList = function() {
    const itemsList = document.getElementById('ventaItemsList');
    const form = document.getElementById('registrarVentaForm');
    if (!itemsList) return;
    
    if (ventaItems.length === 0) {
        itemsList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay items agregados</p>';
        
        // Restaurar atributos required cuando no hay items
        if (form) {
            const requiredFields = form.querySelectorAll('[data-was-required="true"]');
            requiredFields.forEach(field => {
                field.setAttribute('required', 'required');
                field.removeAttribute('data-was-required');
            });
            form.removeAttribute('novalidate');
        }
        return;
    }

    // Calcular total de la venta
    const totalVenta = ventaItems.reduce((sum, item) => sum + (item.precio * (item.cantidad || 1)), 0);
    
    itemsList.innerHTML = ventaItems.map((item, index) => {
        const cantidad = item.cantidad || 1;
        const subtotal = item.precio * cantidad;
        
        // Generar HTML de imagen
        let imagenHTML = '';
        const fotoUrlLimpia = item.juguete_foto_url ? item.juguete_foto_url.trim() : '';
        if (fotoUrlLimpia && fotoUrlLimpia !== '') {
            try {
                new URL(fotoUrlLimpia);
                imagenHTML = `<div style="flex-shrink: 0; margin-right: 12px;">
                    <img src="${fotoUrlLimpia}" alt="${item.juguete_nombre}" 
                         style="width: 60px; height: 60px; border-radius: 6px; border: 2px solid #e2e8f0; object-fit: cover; background: #f1f5f9;"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width: 60px; height: 60px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;\\'><i class=\\'fas fa-image\\' style=\\'color: #cbd5e1; font-size: 20px;\\'></i></div>';"
                         onload="this.style.background='transparent';">
                </div>`;
            } catch (e) {
                imagenHTML = `<div style="flex-shrink: 0; margin-right: 12px; width: 60px; height: 60px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-image" style="color: #cbd5e1; font-size: 20px;"></i>
                </div>`;
            }
        } else {
            imagenHTML = `<div style="flex-shrink: 0; margin-right: 12px; width: 60px; height: 60px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-image" style="color: #cbd5e1; font-size: 20px;"></i>
            </div>`;
        }
        
        const itemCode = item.juguete_item ? ` | ITEM: ${item.juguete_item}` : '';
        return `
        <div class="venta-item-card" style="display: flex; align-items: center; gap: 12px;">
            ${imagenHTML}
            <div class="item-info" style="flex: 1;">
                <strong>${item.juguete_nombre}</strong> (${item.juguete_codigo})${itemCode}<br>
                <small>Precio Unitario: $${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} | Cantidad: ${cantidad} | Empleado: ${item.empleado_nombre} | Método: ${item.metodo_pago}${item.ubicacion_nombre ? ` | Sale de: ${item.ubicacion_nombre}` : ''}</small>
            </div>
            <div class="item-actions">
                <span class="item-precio">$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <button type="button" class="btn-remove" onclick="removeVentaItem(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    }).join('') + `
        <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-top: 2px solid #8b5cf6;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: #1e293b; font-size: 16px;">Total de la Venta:</strong>
                <strong style="color: #10b981; font-size: 20px;">$${totalVenta.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
        </div>
    `;

    // Si hay items, remover atributos required y agregar novalidate
    if (form) {
        const requiredFields = form.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            if (!field.hasAttribute('data-was-required')) {
                field.setAttribute('data-was-required', 'true');
                field.removeAttribute('required');
            }
        });
        form.setAttribute('novalidate', 'novalidate');
    }
};

function showVentaMessage(message, type) {
    const errorMsg = document.getElementById('ventaErrorMessage');
    const successMsg = document.getElementById('ventaSuccessMessage');
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
    
    // Reiniciar el temporizador: antes un mensaje anterior ocultaba antes de tiempo al nuevo
    clearTimeout(showVentaMessage._temporizador);
    showVentaMessage._temporizador = setTimeout(() => {
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
    }, 6000);
}

async function generarCodigoVenta() {
    const { data } = await window.supabaseClient.rpc('generar_codigo_venta');
    return data || 'VENT-' + Date.now();
}

// ============================================
// FACTURAR
// ============================================

// Función para mostrar ventas registradas que se pueden facturar
async function showVentasParaFacturar() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const isEmpleado = user.tipo_usuario_id === 3;
        
        // Buscar ventas que NO han sido facturadas
        // Cargar ventas sin relaciones automáticas (usar juguete_codigo)
        let ventasParaFacturarQuery = window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .eq('facturada', false) // Solo ventas no facturadas
            .order('created_at', { ascending: false })
            .limit(50); // Últimas 50 ventas
        // Empleados solo pueden ver ventas normales (no mayoristas)
        if (isEmpleado) {
            ventasParaFacturarQuery = ventasParaFacturarQuery.eq('es_por_mayor', false);
        }
        const { data: ventasSimples, error: errorSimple } = await ventasParaFacturarQuery;

        if (errorSimple) throw errorSimple;
        
        // Cargar juguetes y empleados por separado
        let ventas = [];
        if (ventasSimples && ventasSimples.length > 0) {
            const jugueteCodigos = [...new Set(ventasSimples.map(v => v.juguete_codigo).filter(c => c))];
            const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
            
            const [juguetesData, empleadosData] = await Promise.all([
                jugueteCodigos.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id) : { data: [] },
                empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
            ]);

            const juguetesMap = new Map((juguetesData.data || []).map(j => [j.codigo, j]));
            const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

            ventas = ventasSimples.map(v => ({
                ...v,
                juguetes: juguetesMap.get(v.juguete_codigo) || null,
                empleados: empleadosMap.get(v.empleado_id) || null
            }));
        }

        // Crear modal o vista para seleccionar ventas
        const ventaView = document.getElementById('ventaView');
        const facturarView = document.getElementById('facturarView');
        
        // Crear contenedor para lista de ventas si no existe
        let ventasListContainer = document.getElementById('ventasParaFacturarList');
        if (!ventasListContainer) {
            ventasListContainer = document.createElement('div');
            ventasListContainer.id = 'ventasParaFacturarList';
            ventasListContainer.className = 'ventas-list-container';
            ventaView.appendChild(ventasListContainer);
        }

        if (!ventas || ventas.length === 0) {
            ventasListContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #64748b; margin-bottom: 20px;">No hay ventas registradas para facturar.</p>
                    <button type="button" class="btn-secondary" onclick="document.getElementById('ventasParaFacturarList').style.display='none'">
                        Cerrar
                    </button>
                </div>
            `;
            ventasListContainer.style.display = 'block';
            return;
        }

        // Agrupar ventas por código_venta para mostrar como grupos facturables
        const ventasAgrupadas = {};
        ventas.forEach(venta => {
            if (!ventasAgrupadas[venta.codigo_venta]) {
                ventasAgrupadas[venta.codigo_venta] = [];
            }
            ventasAgrupadas[venta.codigo_venta].push(venta);
        });

        ventasListContainer.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-height: 600px; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>Seleccionar Venta para Facturar</h2>
                    <button type="button" class="btn-secondary" onclick="document.getElementById('ventasParaFacturarList').style.display='none'">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                </div>
                <div class="ventas-grid" style="display: grid; gap: 15px;">
                    ${Object.keys(ventasAgrupadas).map(codigoVenta => {
                        const grupoVentas = ventasAgrupadas[codigoVenta];
                        const total = grupoVentas.reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
                        const fecha = new Date(grupoVentas[0].created_at).toLocaleString('es-CO');
                        const empleado = grupoVentas[0].empleados?.nombre || 'N/A';
                        
                        return `
                            <div class="venta-card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s;" 
                                 onmouseover="this.style.borderColor='#8b5cf6'; this.style.boxShadow='0 2px 8px rgba(139,92,246,0.2)'"
                                 onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'"
                                 onclick="facturarVentaRegistrada('${codigoVenta}')">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                                    <div>
                                        <strong style="color: #8b5cf6;">${codigoVenta}</strong>
                                        <p style="color: #64748b; font-size: 14px; margin: 5px 0;">${fecha}</p>
                                        <p style="color: #64748b; font-size: 14px;">Empleado: ${empleado}</p>
                                    </div>
                                    <strong style="color: #10b981; font-size: 18px;">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </div>
                                <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px;">
                                    <small style="color: #64748b;">${grupoVentas.length} item(s)</small>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        ventasListContainer.style.display = 'block';
    } catch (error) {
        console.error('Error al cargar ventas para facturar:', error);
        showVentaMessage('Error al cargar las ventas: ' + error.message, 'error');
    }
}

// Función para facturar una venta ya registrada
async function facturarVentaRegistrada(codigoVenta) {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const isEmpleado = user.tipo_usuario_id === 3;
        
        // Obtener todas las ventas con ese código que NO estén facturadas
        // Cargar ventas sin relaciones automáticas (usar juguete_codigo)
        let ventasPorCodigoQuery = window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('codigo_venta', codigoVenta)
            .eq('empresa_id', user.empresa_id)
            .eq('facturada', false); // Solo ventas no facturadas
        // Empleados no deben poder facturar ventas al por mayor
        if (isEmpleado) {
            ventasPorCodigoQuery = ventasPorCodigoQuery.eq('es_por_mayor', false);
        }
        const { data: ventasSimples, error: errorSimple } = await ventasPorCodigoQuery;

        if (errorSimple) throw errorSimple;
        
        // Cargar juguetes y empleados por separado
        let ventas = [];
        if (ventasSimples && ventasSimples.length > 0) {
            const jugueteCodigos = [...new Set(ventasSimples.map(v => v.juguete_codigo).filter(c => c))];
            const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
            
            const [juguetesData, empleadosData] = await Promise.all([
                jugueteCodigos.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id) : { data: [] },
                empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
            ]);

            const juguetesMap = new Map((juguetesData.data || []).map(j => [j.codigo, j]));
            const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

            ventas = ventasSimples.map(v => ({
                ...v,
                juguetes: juguetesMap.get(v.juguete_codigo) || null,
                empleados: empleadosMap.get(v.empleado_id) || null
            }));
        }

        if (!ventas || ventas.length === 0) {
            // Verificar si la venta existe pero ya fue facturada
            const { data: ventasFacturadas } = await window.supabaseClient
                .from('ventas')
                .select('id')
                .eq('codigo_venta', codigoVenta)
                .eq('empresa_id', user.empresa_id)
                .eq('facturada', true)
                .limit(1);
            
            if (ventasFacturadas && ventasFacturadas.length > 0) {
                showVentaMessage('Esta venta ya fue facturada anteriormente. No se puede facturar dos veces.', 'error');
            } else {
                showVentaMessage('Venta no encontrada', 'error');
            }
            return;
        }

        // Convertir ventas a formato de items para facturar
        const itemsParaFacturar = ventas.map(venta => ({
            juguete_nombre: venta.juguetes?.nombre || 'N/A',
            juguete_codigo: venta.juguetes?.codigo || 'N/A',
            precio: parseFloat(venta.precio_venta) / (venta.cantidad || 1),
            cantidad: venta.cantidad || 1,
            subtotal: parseFloat(venta.precio_venta)
        }));

        // Calcular total (con IVA incluido - precio original)
        const total = itemsParaFacturar.reduce((sum, item) => sum + item.subtotal, 0);

        // Generar código de factura
        const codigoFactura = 'FACT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + 
            String(Math.floor(Math.random() * 1000)).padStart(3, '0');

        // Mostrar vista de facturar
        const facturarView = document.getElementById('facturarView');
        const ventaView = document.getElementById('ventaView');
        const ventasListContainer = document.getElementById('ventasParaFacturarList');
        
        if (ventasListContainer) ventasListContainer.style.display = 'none';
        ventaView.style.display = 'none';
        facturarView.style.display = 'block';
        
        // Llenar datos de factura
        document.getElementById('facturaCodigo').textContent = codigoFactura;
        document.getElementById('facturaFecha').textContent = new Date().toLocaleString('es-CO');
        
        // Calcular IVA
        const totalConIva = total; // Total con IVA (precio original)
        const totalBase = itemsParaFacturar.reduce((sum, item) => {
            const precioConIva = item.precio;
            const precioBase = precioConIva / 1.19;
            return sum + (precioBase * item.cantidad);
        }, 0);
        const ivaTotal = totalConIva - totalBase;
        
        // Llenar items (sin código)
        const itemsBody = document.getElementById('facturaItemsBody');
        itemsBody.innerHTML = itemsParaFacturar.map(item => {
            const precioConIva = item.precio;
            const precioBase = precioConIva / 1.19;
            const subtotal = precioBase * item.cantidad; // Subtotal = precio sin IVA × cantidad
            return `
            <tr>
                <td>${item.juguete_nombre}</td>
                <td>$${precioBase.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${item.cantidad}</td>
                <td>$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
        }).join('');
        
        // Actualizar totales con IVA
        const facturaIvaElement = document.getElementById('facturaIva');
        const facturaTotalElement = document.getElementById('facturaTotal');
        if (facturaIvaElement) {
            facturaIvaElement.textContent = '$' + ivaTotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (facturaTotalElement) {
            facturaTotalElement.textContent = '$' + totalConIva.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        // Guardar datos para enviar (total con IVA incluido)
        currentFacturaData = {
            codigo_factura: codigoFactura,
            items: itemsParaFacturar,
            total: totalConIva, // Total con IVA (precio original)
            codigo_venta: codigoVenta, // Guardar para referencia
            ventas_ids: ventas.map(v => v.id) // Guardar IDs de las ventas para marcarlas como facturadas
        };
    } catch (error) {
        console.error('Error al facturar venta registrada:', error);
        showVentaMessage('Error al facturar la venta: ' + error.message, 'error');
    }
}

// Exportar función global
window.facturarVentaRegistrada = facturarVentaRegistrada;

function showFacturarView() {
    if (ventaItems.length === 0) return;

    // Calcular total
    const total = ventaItems.reduce((sum, item) => sum + (item.precio * (item.cantidad || 1)), 0);
    
    // Generar código de factura
    const codigoFactura = 'FACT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + 
        String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    // Mostrar vista de facturar
    const facturarView = document.getElementById('facturarView');
    const ventaView = document.getElementById('ventaView');
    const ventasListContainer = document.getElementById('ventasParaFacturarList');
    
    if (ventasListContainer) ventasListContainer.style.display = 'none';
    ventaView.style.display = 'none';
    facturarView.style.display = 'block';
    
    // Llenar datos de factura
    document.getElementById('facturaCodigo').textContent = codigoFactura;
    document.getElementById('facturaFecha').textContent = new Date().toLocaleString('es-CO');
    
    // Calcular IVA
    const totalConIva = total; // Total con IVA (precio original)
    const totalBase = ventaItems.reduce((sum, item) => {
        const cantidad = item.cantidad || 1;
        const precioConIva = item.precio;
        const precioBase = precioConIva / 1.19;
        return sum + (precioBase * cantidad);
    }, 0);
    const ivaTotal = totalConIva - totalBase;
    
    // Llenar items (con código e ITEM)
    const itemsBody = document.getElementById('facturaItemsBody');
    itemsBody.innerHTML = ventaItems.map(item => {
        const cantidad = item.cantidad || 1;
        const precioConIva = item.precio;
        const precioBase = precioConIva / 1.19;
        const subtotal = precioBase * cantidad; // Subtotal = precio sin IVA × cantidad
        const itemCode = item.juguete_item ? ` (ITEM: ${item.juguete_item})` : '';
        return `
        <tr>
            <td>${item.juguete_nombre} (${item.juguete_codigo})${itemCode}</td>
            <td>$${precioBase.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>${cantidad}</td>
            <td>$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
    `;
    }).join('');
    
    // Actualizar totales con IVA
    const facturaIvaElement = document.getElementById('facturaIva');
    const facturaTotalElement = document.getElementById('facturaTotal');
    if (facturaIvaElement) {
        facturaIvaElement.textContent = '$' + ivaTotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (facturaTotalElement) {
        facturaTotalElement.textContent = '$' + totalConIva.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // Guardar datos para enviar (total con IVA incluido)
    // Nota: Cuando se factura desde items nuevos (no desde ventas registradas),
    // no hay codigo_venta, así que no se marca nada como facturado
    currentFacturaData = {
        codigo_factura: codigoFactura,
        items: ventaItems,
        total: totalConIva, // Total con IVA (precio original)
        codigo_venta: null // No hay código de venta porque son items nuevos
    };
}

function initFacturar() {
    const form = document.getElementById('enviarFacturaForm');
    const cancelarBtn = document.getElementById('cancelarFacturaBtn');
    
    cancelarBtn.addEventListener('click', function() {
        const facturarView = document.getElementById('facturarView');
        const ventaView = document.getElementById('ventaView');
        const ventasListContainer = document.getElementById('ventasParaFacturarList');
        
        if (ventasListContainer) ventasListContainer.style.display = 'none';
        if (facturarView) facturarView.style.display = 'none';
        if (ventaView) ventaView.style.display = 'block';
    });
    
    // Facturar - con protección contra clics múltiples
    preventFormDoubleSubmit(form, async function(e) {
        if (!currentFacturaData) {
            showFacturaMessage('No hay datos de factura', 'error');
            return;
        }
        
        const clienteNombre = document.getElementById('clienteNombre').value.trim();
        const clienteDocumento = document.getElementById('clienteDocumento').value.trim();
        const clienteEmail = document.getElementById('clienteEmail').value.trim();
        
        if (!clienteNombre || !clienteDocumento || !clienteEmail) {
            showFacturaMessage('Por favor, completa todos los campos del cliente', 'error');
            return;
        }
        
        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            const usarAuth = window.APP_CONFIG?.USAR_SUPABASE_AUTH === true;

            // 1. Generar y subir el XML primero: así la factura se guarda con su ruta en una sola escritura
            //    (con RLS, un empleado puede crear facturas pero no modificarlas después).
            const fechaISO = new Date().toISOString();
            const totales = calcularTotalesFactura(currentFacturaData);
            const facturaXML = generarXMLFactura(currentFacturaData, clienteNombre, clienteDocumento, clienteEmail,
                fechaISO, totales.totalConIva, totales.totalBase, totales.ivaTotal);
            const estadoXml = window.servicioFacturaXml
                ? await window.servicioFacturaXml.subir(currentFacturaData.codigo_factura, facturaXML)
                : { ok: false, ruta: null, url: null, motivo: 'servicio de almacenamiento no disponible' };
            if (!estadoXml.ok) console.error('No se pudo subir el XML de la factura:', estadoXml.motivo);

            // 2. Crear factura
            const datosFactura = {
                codigo_factura: currentFacturaData.codigo_factura,
                cliente_nombre: clienteNombre,
                cliente_documento: clienteDocumento,
                cliente_email: clienteEmail,
                total: currentFacturaData.total,
                empresa_id: user.empresa_id
            };
            if (usarAuth && estadoXml.ok) {
                datosFactura.xml_path = estadoXml.ruta; // columna creada por la migración 2026_09_30_05
            }
            const { data: factura, error: facturaError } = await window.supabaseClient
                .from('facturas')
                .insert(datosFactura)
                .select()
                .single();
            
            if (facturaError) throw facturaError;
            
            // 3. Crear items de factura en un solo INSERT (todo o nada); antes los errores se ignoraban
            const filasItems = currentFacturaData.items.map(item => {
                const cantidad = item.cantidad || 1;
                const precio = item.precio || 0;
                return {
                    factura_id: factura.id,
                    juguete_nombre: item.juguete_nombre,
                    juguete_codigo: item.juguete_codigo,
                    precio: precio,
                    cantidad: cantidad,
                    subtotal: item.subtotal || (precio * cantidad)
                };
            });
            const { error: itemsError } = await window.supabaseClient.from('facturas_items').insert(filasItems);
            if (itemsError) {
                console.error('Error al guardar los items de la factura:', itemsError);
                throw new Error(`la factura ${currentFacturaData.codigo_factura} se creó, pero no se guardaron sus items (${itemsError.message}). ` +
                    'Pide a un administrador que la revise antes de volver a facturar.');
            }
            
            // 4. Marcar las ventas como facturadas para evitar que se facturen nuevamente
            let avisoVentas = '';
            if (currentFacturaData.codigo_venta) {
                const { error: updateError } = await window.supabaseClient
                    .from('ventas')
                    .update({ facturada: true })
                    .eq('codigo_venta', currentFacturaData.codigo_venta)
                    .eq('empresa_id', user.empresa_id)
                    .eq('facturada', false); // Solo actualizar las que no estén facturadas
                
                if (updateError) {
                    console.error('Error al marcar ventas como facturadas:', updateError);
                    avisoVentas = ` · Ventas: no se pudieron marcar como facturadas (${updateError.message})`;
                }
            }
            
            // 5. Enviar correo electrónico con la factura (usa el enlace del XML si se subió)
            let estadoCorreo = { ok: true, motivo: null };
            try {
                await enviarFacturaPorCorreo(clienteEmail, clienteNombre, clienteDocumento, currentFacturaData, factura.id, {
                    facturaXML,
                    xmlDownloadUrl: estadoXml.url
                });
            } catch (emailError) {
                console.error('Error al enviar correo:', emailError);
                estadoCorreo = { ok: false, motivo: emailError.message };
            }

            // 6. Informar el estado real de cada paso
            const partes = [
                `Factura ${currentFacturaData.codigo_factura} guardada ✓`,
                estadoXml.ok
                    ? (estadoXml.motivo ? `XML subido, pero ${estadoXml.motivo}` : 'XML subido ✓')
                    : `XML no subido ✗ (${estadoXml.motivo}); el correo incluye el XML como texto`,
                estadoCorreo.ok ? 'Correo enviado ✓' : `Correo no enviado ✗ (${estadoCorreo.motivo})`
            ];
            const todoOk = estadoXml.ok && !estadoXml.motivo && estadoCorreo.ok && !avisoVentas;
            showFacturaMessage(partes.join(' · ') + avisoVentas, todoOk ? 'success' : 'error');
            
            setTimeout(() => {
                document.getElementById('facturarView').style.display = 'none';
                document.getElementById('ventaView').style.display = 'block';
                form.reset();
                ventaItems = [];
                currentFacturaData = null;
            }, todoOk ? 2000 : 6000);
            
        } catch (error) {
            console.error('Error al crear factura:', error);
            showFacturaMessage('Error al crear la factura: ' + error.message, 'error');
        }
    });
}

function showFacturaMessage(message, type) {
    const errorMsg = document.getElementById('facturaErrorMessage');
    const successMsg = document.getElementById('facturaSuccessMessage');
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
}

// Función para generar XML de factura
function generarXMLFactura(facturaData, clienteNombre, clienteDocumento, clienteEmail, fechaISO, totalConIva, totalBase, ivaTotal) {
    const fecha = new Date(fechaISO);
    const fechaFormateada = fecha.toISOString().split('T')[0];
    const horaFormateada = fecha.toISOString().split('T')[1].split('.')[0];
    
    let itemsXML = '';
    facturaData.items.forEach((item, index) => {
        const cantidad = item.cantidad || 1;
        const precioConIva = item.precio || 0;
        const precioBase = precioConIva / 1.19;
        const subtotal = precioBase * cantidad;
        const ivaItem = (precioConIva * cantidad) - subtotal;
        
        itemsXML += `
        <Item>
            <Numero>${index + 1}</Numero>
            <Nombre>${escapeXML(item.juguete_nombre)}</Nombre>
            <Codigo>${escapeXML(item.juguete_codigo || 'N/A')}</Codigo>
            <Cantidad>${cantidad}</Cantidad>
            <PrecioUnitario>${precioBase.toFixed(2)}</PrecioUnitario>
            <Subtotal>${subtotal.toFixed(2)}</Subtotal>
            <IVA>${ivaItem.toFixed(2)}</IVA>
            <TotalItem>${(precioConIva * cantidad).toFixed(2)}</TotalItem>
        </Item>`;
    });
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica>
    <InformacionGeneral>
        <CodigoFactura>${escapeXML(facturaData.codigo_factura)}</CodigoFactura>
        <Fecha>${fechaFormateada}</Fecha>
        <Hora>${horaFormateada}</Hora>
        <TipoFactura>01</TipoFactura>
    </InformacionGeneral>
    <Emisor>
        <Nombre>ToysWalls - Sistema de Inventario</Nombre>
    </Emisor>
    <Receptor>
        <Nombre>${escapeXML(clienteNombre)}</Nombre>
        <Documento>${escapeXML(clienteDocumento || 'N/A')}</Documento>
        <Email>${escapeXML(clienteEmail)}</Email>
    </Receptor>
    <Items>
        ${itemsXML}
    </Items>
    <Totales>
        <Subtotal currencyID="COP">${totalBase.toFixed(2)}</Subtotal>
        <IVA currencyID="COP">${ivaTotal.toFixed(2)}</IVA>
        <Total currencyID="COP">${totalConIva.toFixed(2)}</Total>
    </Totales>
</FacturaElectronica>`;
    
    return xml;
}

// Función auxiliar para escapar caracteres XML
function escapeXML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Función para enviar factura por correo
/** Totales de la factura: los precios ingresados incluyen IVA (19%). */
function calcularTotalesFactura(facturaData) {
    const totalConIva = facturaData.total;
    const totalBase = facturaData.items.reduce((sum, item) => {
        const cantidad = item.cantidad || 1;
        const precioConIva = item.precio || 0;
        return sum + ((precioConIva / 1.19) * cantidad);
    }, 0);
    return { totalConIva, totalBase, ivaTotal: totalConIva - totalBase };
}

/**
 * @param {Object} [opciones]
 * @param {string} [opciones.facturaXML] - XML ya generado (si no, se genera aquí)
 * @param {string|null} [opciones.xmlDownloadUrl] - Enlace de descarga del XML subido a Storage
 */
async function enviarFacturaPorCorreo(clienteEmail, clienteNombre, clienteDocumento, facturaData, facturaId, opciones = {}) {
    // Validar que el correo del cliente no esté vacío
    if (!clienteEmail || clienteEmail.trim() === '') {
        throw new Error('El correo del cliente no puede estar vacío');
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clienteEmail.trim())) {
        throw new Error('El formato del correo del cliente no es válido');
    }

    console.log('Enviando factura a:', clienteEmail);
    
    // Calcular IVA: precio ingresado - 19% = precio base
    // El precio que se ingresa es el precio con IVA incluido
    // Precio base = precio / 1.19
    // IVA = precio - precio base
    // Total = precio original (el que se ingresó)
    
    // Generar HTML detallado de los items (sin columna código)
    const itemsHTML = facturaData.items.map((item, index) => {
        const cantidad = item.cantidad || 1;
        const precioConIva = item.precio || 0; // Precio ingresado (con IVA incluido)
        const precioBase = precioConIva / 1.19; // Precio sin IVA
        const subtotal = precioBase * cantidad; // Subtotal = precio sin IVA × cantidad
        return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 13px;">${index + 1}</td>
                <td style="padding: 10px 8px; font-weight: 600; color: #1e293b; font-size: 13px; word-wrap: break-word;">${item.juguete_nombre}</td>
                <td style="padding: 10px 8px; text-align: right; color: #1e293b; font-size: 13px;">$${precioBase.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 600; font-size: 13px;">${cantidad}</td>
                <td style="padding: 10px 8px; text-align: right; color: #10b981; font-weight: 700; font-size: 14px;">$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');
    
    // Calcular totales
    const { totalConIva, totalBase, ivaTotal } = calcularTotalesFactura(facturaData);

    const fecha = new Date().toLocaleString('es-CO');
    const fechaISO = new Date().toISOString();
    // URL del logo - debe ser accesible públicamente
    const logoUrl = 'https://i.imgur.com/RBbjVnp.jpeg';
    
    // XML de la factura (la subida a Storage se hace antes, en initFacturar, para informar su estado real)
    const facturaXML = opciones.facturaXML ||
        generarXMLFactura(facturaData, clienteNombre, clienteDocumento, clienteEmail, fechaISO, totalConIva, totalBase, ivaTotal);
    const xmlDownloadUrl = opciones.xmlDownloadUrl || null;
    
    // Generar HTML solo con el contenido del body (sin DOCTYPE, html, head)
    // Usar estilos inline para mejor compatibilidad con clientes de correo
    const facturaHTML = `
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center;">
                <div style="margin-bottom: 15px;">
                    <img src="${logoUrl}" alt="ToysWalls Logo" style="max-width: 150px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); display: block; margin: 0 auto;" />
                </div>
                <h1 style="font-size: 28px; margin: 0 0 8px 0; font-weight: 700; color: white;">TOYS WALLS</h1>
                <p style="font-size: 14px; margin: 0; opacity: 0.9;">Sistema de Inventario</p>
            </div>
            <div style="padding: 25px 20px;">
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #8b5cf6;">
                    <h2 style="color: #8b5cf6; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">FACTURA ELECTRÓNICA</h2>
                    <p style="margin: 6px 0; color: #495057; font-size: 14px; word-break: break-word;"><strong style="color: #1e293b; font-weight: 600;">Código de Factura:</strong> ${facturaData.codigo_factura}</p>
                    <p style="margin: 6px 0; color: #495057; font-size: 14px; word-break: break-word;"><strong style="color: #1e293b; font-weight: 600;">Fecha y Hora:</strong> ${fecha}</p>
                    <p style="margin: 6px 0; color: #495057; font-size: 14px; word-break: break-word;"><strong style="color: #1e293b; font-weight: 600;">Cliente:</strong> ${clienteNombre}</p>
                    <p style="margin: 6px 0; color: #495057; font-size: 14px; word-break: break-word;"><strong style="color: #1e293b; font-weight: 600;">Documento:</strong> ${clienteDocumento || 'N/A'}</p>
                    <p style="margin: 6px 0; color: #495057; font-size: 14px; word-break: break-word;"><strong style="color: #1e293b; font-weight: 600;">Correo:</strong> ${clienteEmail}</p>
                </div>
                
                <div style="margin: 25px 0;">
                    <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Detalle de la Compra</h3>
                    <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -5px;">
                        <table style="width: 100%; min-width: 500px; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); table-layout: fixed;">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #8b5cf6 0%, #667eea 100%);">
                                    <th style="color: white; padding: 10px 8px; text-align: center; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; width: 8%;">#</th>
                                    <th style="color: white; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; width: 40%;">Juguete</th>
                                    <th style="color: white; padding: 10px 8px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; width: 22%;">Precio Unit.</th>
                                    <th style="color: white; padding: 10px 8px; text-align: center; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; width: 15%;">Cant.</th>
                                    <th style="color: white; padding: 10px 8px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; width: 15%;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                            </tbody>
                            <tfoot style="background: #f8f9fa; border-top: 3px solid #8b5cf6;">
                                <tr>
                                    <td colspan="4" style="text-align: right; padding: 12px 10px; color: #1e293b; font-size: 15px; font-weight: 600;">IVA (19%):</td>
                                    <td style="text-align: right; padding: 12px 10px; color: #64748b; font-size: 15px; font-weight: 600;">$${ivaTotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right; padding: 15px 10px; color: #1e293b; font-size: 16px; font-weight: 700;">TOTAL A PAGAR:</td>
                                    <td style="text-align: right; padding: 15px 10px; color: #10b981; font-size: 20px; font-weight: 700;">$${totalConIva.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 13px;">
                    <p style="margin: 6px 0; color: #8b5cf6; font-weight: 600; font-size: 15px;">ToysWalls - Sistema de Inventario</p>
                    <p style="margin: 6px 0;">Gracias por su compra. Esperamos verlo pronto.</p>
                    <p style="margin: 21px 0 0 0; font-size: 12px; color: #94a3b8;">
                        Este es un correo automático, por favor no responda a este mensaje.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Usar EmailJS para enviar el correo
    if (typeof emailjs === 'undefined') {
        throw new Error('EmailJS no está cargado. Verifica que el script esté incluido en el HTML.');
    }

    if (!window.EMAILJS_CONFIG) {
        throw new Error('EmailJS no está configurado. Verifica js/email-config.js');
        }

        try {
        const config = window.EMAILJS_CONFIG;
        
        // Verificar que la configuración esté completa
        if (config.SERVICE_ID === 'YOUR_SERVICE_ID' || 
            config.TEMPLATE_ID === 'YOUR_TEMPLATE_ID' || 
            config.PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
            throw new Error('EmailJS no está configurado. Por favor, configura tus credenciales en js/email-config.js');
        }

        // Inicializar EmailJS si no está inicializado
        try {
            emailjs.init(config.PUBLIC_KEY);
        } catch (initError) {
            console.warn('EmailJS ya estaba inicializado o error en init:', initError);
        }

        // Generar texto plano de los items para el asunto/cuerpo alternativo
        const itemsTexto = facturaData.items.map((item, index) => {
            const cantidad = item.cantidad || 1;
            const precio = item.precio || 0;
            const subtotal = item.subtotal || (precio * cantidad);
            return `${index + 1}. ${item.juguete_nombre} (${item.juguete_codigo}) - Cantidad: ${cantidad} x $${precio.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = $${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }).join('\n');

        // Preparar parámetros para EmailJS
        // IMPORTANTE: El nombre de las variables debe coincidir con las de tu plantilla en EmailJS
        
        // Crear un ID único para el XML que se pueda usar en JavaScript
        const xmlId = `xml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // HTML mejorado con enlace de descarga directa del XML
        const xmlSectionHTML = xmlDownloadUrl ? `
            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h4 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">
                    <i class="fas fa-file-code"></i> Archivo XML de Factura Adjunto
                </h4>
                <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0; line-height: 1.6;">
                    El archivo XML de tu factura está disponible para descarga. Haz clic en el botón de abajo para descargarlo directamente:
                </p>
                
                <!-- Enlace de descarga directa -->
                <div style="text-align: center; margin-bottom: 20px;">
                    <a href="${xmlDownloadUrl}" 
                       download="factura_${facturaData.codigo_factura}.xml"
                       style="display: inline-block; padding: 15px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); transition: all 0.3s;">
                        <i class="fas fa-download" style="margin-right: 8px;"></i> Descargar Archivo XML de Factura
                    </a>
                </div>
                
                <div style="background: #e0f2fe; padding: 12px; border-radius: 6px; border-left: 4px solid #3b82f6; margin-top: 15px;">
                    <p style="color: #1e40af; font-size: 13px; margin: 0; line-height: 1.6;">
                        <i class="fas fa-info-circle" style="margin-right: 6px;"></i>
                        <strong>Nota importante:</strong> Este archivo XML contiene toda la información de tu factura en formato digital. 
                        Puedes descargarlo haciendo clic en el botón de arriba. El archivo se descargará automáticamente cuando hagas clic.
                    </p>
                </div>
                
                <!-- XML también como texto plano para respaldo -->
                <details style="margin-top: 20px;">
                    <summary style="color: #64748b; font-size: 13px; cursor: pointer; padding: 10px; background: white; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <i class="fas fa-code"></i> Ver contenido XML (texto plano)
                    </summary>
                    <div style="background: #1e293b; padding: 15px; border-radius: 6px; overflow-x: auto; margin-top: 10px;">
                        <pre style="color: #10b981; font-size: 11px; font-family: 'Courier New', monospace; margin: 0; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5;">${facturaXML.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    </div>
                </details>
            </div>
        ` : `
            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h4 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">
                    <i class="fas fa-file-code"></i> Archivo XML de Factura
                </h4>
                <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0; line-height: 1.6;">
                    El archivo XML de tu factura está incluido a continuación. Puedes descargarlo usando el botón de abajo:
                </p>
                
                <!-- Botón de descarga con JavaScript (funciona en navegadores) -->
                <div style="text-align: center; margin-bottom: 20px;">
                    <a href="javascript:void(0);" onclick="
                        (function() {
                            var xmlContent = ${JSON.stringify(facturaXML)};
                            var blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            a.download = 'factura_${facturaData.codigo_factura}.xml';
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(function() {
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }, 100);
                        })();
                        return false;
                    " 
                    style="display: inline-block; padding: 15px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <i class="fas fa-download" style="margin-right: 8px;"></i> Descargar Archivo XML de Factura
                    </a>
                </div>
                
                <!-- XML como texto plano -->
                <details style="margin-top: 20px;">
                    <summary style="color: #64748b; font-size: 13px; cursor: pointer; padding: 10px; background: white; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <i class="fas fa-code"></i> Ver contenido XML (texto plano)
                    </summary>
                    <div style="background: #1e293b; padding: 15px; border-radius: 6px; overflow-x: auto; margin-top: 10px;">
                        <pre style="color: #10b981; font-size: 11px; font-family: 'Courier New', monospace; margin: 0; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5;">${facturaXML.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    </div>
                </details>
            </div>
        `;
        
        const templateParams = {
            to_email: clienteEmail.trim(), // Campo principal del destinatario
            to_name: clienteNombre || 'Cliente',
            reply_to: config.FROM_EMAIL, // Email de respuesta
            from_name: config.FROM_NAME,
            subject: `Factura ${facturaData.codigo_factura} - ToysWalls`,
            message_html: facturaHTML + xmlSectionHTML,
            message: facturaHTML + `\n\nARCHIVO XML DE FACTURA:\n\n${facturaXML}\n\nPara guardar el XML, copia el texto de arriba y guárdalo en un archivo con extensión .xml`, // Versión texto plano
            factura_codigo: facturaData.codigo_factura,
            factura_total: `$${facturaData.total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            factura_fecha: new Date().toLocaleString('es-CO'),
            items_detalle: itemsTexto,
            cliente_nombre: clienteNombre || 'Cliente',
            cliente_email: clienteEmail.trim(), // Duplicado por si la plantilla lo requiere
            factura_xml: facturaXML // XML como texto plano
        };

        console.log('Enviando correo con parámetros:', {
            service_id: config.SERVICE_ID,
            template_id: config.TEMPLATE_ID,
            to_email: templateParams.to_email,
            to_name: templateParams.to_name
        });

        // Enviar correo usando EmailJS
        const result = await emailjs.send(
            config.SERVICE_ID,
            config.TEMPLATE_ID,
            templateParams
        );

        console.log('Correo enviado exitosamente:', result);
        return result;
    } catch (emailjsError) {
        console.error('Error completo al enviar correo con EmailJS:', emailjsError);
        const errorMessage = emailjsError.text || emailjsError.message || 'Error desconocido al enviar correo';
        throw new Error('Error al enviar correo: ' + errorMessage);
    }
}

// ============================================
// JUGUETES - CON FOTO
// ============================================

// ============================================
// TIENDAS - CON EMPLEADOS Y JUGUETES
// ============================================

// Variables de paginación para tiendas
let paginaActualTiendas = 1;
const itemsPorPaginaTiendas = 10;
let todasLasTiendas = [];

async function loadTiendas() {
    const tiendasList = document.getElementById('tiendasList');
    if (!tiendasList) {
        console.warn('loadTiendas: No se encontró el elemento tiendasList');
        return;
    }
    
    console.log('loadTiendas: Iniciando carga de tiendas...');
    tiendasList.innerHTML = '<p style="text-align: center; color: #64748b;">Cargando tiendas...</p>';
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user || !user.empresa_id) {
            throw new Error('Usuario no válido o sin empresa_id');
        }
        
        console.log('loadTiendas: Consultando tiendas para empresa_id:', user.empresa_id);
        const { data: tiendas, error } = await window.supabaseClient
            .from('tiendas')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .order('nombre');

        if (error) {
            console.error('loadTiendas: Error en consulta:', error);
            throw error;
        }
        
        console.log('loadTiendas: Tiendas encontradas:', tiendas?.length || 0);

        // Optimización: Cargar todos los empleados y juguetes de una vez
        const tiendaIds = (tiendas || []).map(t => t.id);
        if (tiendaIds && tiendaIds.length > 0) {
            try {
                const [empleadosResult, juguetesResult] = await Promise.all([
                    window.supabaseClient.from('empleados').select('*').in('tienda_id', tiendaIds),
                    window.supabaseClient.from('juguetes').select('*').in('tienda_id', tiendaIds)
                ]);
                
                const todosEmpleados = empleadosResult.data || [];
                const todosJuguetes = juguetesResult.data || [];
                
                // Agrupar por tienda_id
                tiendas.forEach(tienda => {
                    tienda.empleados = todosEmpleados.filter(e => e.tienda_id === tienda.id);
                    tienda.juguetes = todosJuguetes.filter(j => j.tienda_id === tienda.id);
                });
            } catch (error) {
                console.error('Error al cargar empleados/juguetes de tiendas:', error);
                // Fallback: cargar individualmente si falla la consulta optimizada
                for (const tienda of tiendas) {
                    const [empleados, juguetes] = await Promise.all([
                        window.supabaseClient.from('empleados').select('*').eq('tienda_id', tienda.id),
                        window.supabaseClient.from('juguetes').select('*').eq('tienda_id', tienda.id)
                    ]);
                    tienda.empleados = empleados.data || [];
                    tienda.juguetes = juguetes.data || [];
                }
            }
        } else {
            if (tiendas && tiendas.length > 0) {
                tiendas.forEach(tienda => {
                    tienda.empleados = [];
                    tienda.juguetes = [];
                });
            }
        }

        todasLasTiendas = tiendas || [];
        paginaActualTiendas = 1;
        console.log('loadTiendas: Total tiendas a renderizar:', todasLasTiendas.length);
        
        if (tiendas && tiendas.length > 0) {
            console.log('loadTiendas: Llamando a renderizarPaginaTiendas()');
            renderizarPaginaTiendas();
        } else {
            console.log('loadTiendas: No hay tiendas, mostrando mensaje');
            tiendasList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay tiendas registradas.</p>';
            const paginationContainer = document.getElementById('tiendasPagination');
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Error al cargar tiendas:', error);
        const tiendasList = document.getElementById('tiendasList');
        if (tiendasList) {
            tiendasList.innerHTML = `<p style="text-align: center; color: #ef4444;">Error al cargar las tiendas: ${error.message}</p>`;
        }
    }
}

function renderizarPaginaTiendas() {
    const tiendasList = document.getElementById('tiendasList');
    if (!tiendasList) {
        console.warn('renderizarPaginaTiendas: No se encontró el elemento tiendasList');
        return;
    }
    
    console.log('renderizarPaginaTiendas: Total tiendas:', todasLasTiendas?.length || 0);
    
    if (!todasLasTiendas || todasLasTiendas.length === 0) {
        console.log('renderizarPaginaTiendas: No hay tiendas para renderizar');
        tiendasList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay tiendas registradas.</p>';
        const paginationContainer = document.getElementById('tiendasPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // Calcular paginación
    const totalPaginas = Math.ceil(todasLasTiendas.length / itemsPorPaginaTiendas);
    const inicio = (paginaActualTiendas - 1) * itemsPorPaginaTiendas;
    const fin = inicio + itemsPorPaginaTiendas;
    const tiendasPagina = todasLasTiendas.slice(inicio, fin);

    console.log('renderizarPaginaTiendas: Renderizando', tiendasPagina.length, 'tiendas de la página', paginaActualTiendas);

    // Renderizar tiendas de la página actual
    tiendasList.innerHTML = '';
    tiendasPagina.forEach((tienda, index) => {
        try {
            const tiendaCard = createTiendaCard(tienda);
            tiendasList.appendChild(tiendaCard);
            console.log(`renderizarPaginaTiendas: Tienda ${index + 1} renderizada:`, tienda.nombre);
        } catch (error) {
            console.error(`renderizarPaginaTiendas: Error al crear card para tienda ${tienda.id}:`, error);
        }
    });

    renderizarPaginacionTiendas(totalPaginas, todasLasTiendas.length);
    console.log('renderizarPaginaTiendas: Renderización completada');
}

function renderizarPaginacionTiendas(totalPaginas, totalTiendas) {
    const paginationContainer = document.getElementById('tiendasPagination');
    if (!paginationContainer) return;
    
    if (totalPaginas <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginacionHTML = '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">';
    
    // Botón Anterior
    if (paginaActualTiendas > 1) {
        paginacionHTML += `
            <button onclick="cambiarPaginaTiendas(${paginaActualTiendas - 1})" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
        `;
    }

    // Pestañas de páginas (mostrar máximo 7 pestañas)
    const maxPestañas = 7;
    let inicioPestañas = Math.max(1, paginaActualTiendas - Math.floor(maxPestañas / 2));
    let finPestañas = Math.min(totalPaginas, inicioPestañas + maxPestañas - 1);
    
    if (finPestañas - inicioPestañas < maxPestañas - 1) {
        inicioPestañas = Math.max(1, finPestañas - maxPestañas + 1);
    }

    // Primera página si no está visible
    if (inicioPestañas > 1) {
        paginacionHTML += `
            <button onclick="cambiarPaginaTiendas(1)" 
                    style="padding: 8px 12px; background: ${paginaActualTiendas === 1 ? '#3b82f6' : 'white'}; color: ${paginaActualTiendas === 1 ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                1
            </button>
        `;
        if (inicioPestañas > 2) {
            paginacionHTML += `<span style="padding: 8px 4px; color: #64748b;">...</span>`;
        }
    }

    // Pestañas visibles
    for (let i = inicioPestañas; i <= finPestañas; i++) {
        paginacionHTML += `
            <button onclick="cambiarPaginaTiendas(${i})" 
                    style="padding: 8px 12px; background: ${paginaActualTiendas === i ? '#3b82f6' : 'white'}; color: ${paginaActualTiendas === i ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                ${i}
            </button>
        `;
    }

    // Última página si no está visible
    if (finPestañas < totalPaginas) {
        if (finPestañas < totalPaginas - 1) {
            paginacionHTML += `<span style="padding: 8px 4px; color: #64748b;">...</span>`;
        }
        paginacionHTML += `
            <button onclick="cambiarPaginaTiendas(${totalPaginas})" 
                    style="padding: 8px 12px; background: ${paginaActualTiendas === totalPaginas ? '#3b82f6' : 'white'}; color: ${paginaActualTiendas === totalPaginas ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                ${totalPaginas}
            </button>
        `;
    }

    // Botón Siguiente
    if (paginaActualTiendas < totalPaginas) {
        paginacionHTML += `
            <button onclick="cambiarPaginaTiendas(${paginaActualTiendas + 1})" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    paginacionHTML += '</div>';
    paginationContainer.innerHTML = paginacionHTML;
}

window.cambiarPaginaTiendas = function(nuevaPagina) {
    paginaActualTiendas = nuevaPagina;
    renderizarPaginaTiendas();
};

function createTiendaCard(tienda) {
    const card = document.createElement('div');
    card.className = 'bodega-card';
    const direccion = tienda.direccion || tienda.ubicacion || 'Sin dirección';
    const empleadosCount = tienda.empleados?.length || 0;
    // Agrupar juguetes por código y sumar cantidades para evitar duplicados
    const juguetesAgrupados = new Map();
    if (tienda.juguetes && tienda.juguetes.length > 0) {
        tienda.juguetes.forEach(juguete => {
            const codigo = juguete.codigo;
            const cantidad = juguete.cantidad || 0;
            if (juguetesAgrupados.has(codigo)) {
                juguetesAgrupados.set(codigo, juguetesAgrupados.get(codigo) + cantidad);
            } else {
                juguetesAgrupados.set(codigo, cantidad);
            }
        });
    }
    const juguetesCount = Array.from(juguetesAgrupados.values()).reduce((sum, cantidad) => sum + cantidad, 0);
    card.innerHTML = `
        <div class="bodega-info">
            <h3>${tienda.nombre}</h3>
            <p><i class="fas fa-map-marker-alt"></i> ${direccion}</p>
            <div class="tienda-stats">
                <span><i class="fas fa-user-tie"></i> ${empleadosCount} Empleados</span>
                <span><i class="fas fa-boxes"></i> ${juguetesCount} Juguetes</span>
            </div>
        </div>
        <div class="bodega-actions">
            <button class="menu-toggle" data-tienda-id="${tienda.id}">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="dropdown-menu" id="menu-tienda-${tienda.id}" style="display: none;">
                <button class="dropdown-item" data-action="edit" data-tienda-id="${tienda.id}">
                    <i class="fas fa-edit"></i> Actualizar
                </button>
                <button class="dropdown-item danger" data-action="delete" data-tienda-id="${tienda.id}">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
    return card;
}

// ============================================
// EMPLEADOS - ACTUALIZADO CON DOCUMENTO Y TIENDA
// ============================================

async function loadTiendasForEmpleados() {
    // Mismo cargador que el formulario de Empleados (dashboard.js): tiendas y bodegas con
    // valores "tienda-3" / "bodega-1", para que el alta guarde la ubicación de venta correcta.
    if (typeof window.cargarUbicacionesVentaEmpleado === 'function') {
        await window.cargarUbicacionesVentaEmpleado('empleadoTienda');
    }
}


// ============================================
// USUARIOS - CRUD COMPLETO
// ============================================

// Variables de paginación para usuarios
let paginaActualUsuarios = 1;
const itemsPorPaginaUsuarios = 10;
let todosLosUsuarios = [];

async function loadUsuarios() {
    const usuariosList = document.getElementById('usuariosList');
    if (!usuariosList) return;
    
    usuariosList.innerHTML = '<p style="text-align: center; color: #64748b;">Cargando usuarios...</p>';
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const { data: usuarios, error } = await window.supabaseClient
            .from('usuarios')
            .select(`
                id, nombre, email, empresa_id, tipo_usuario_id, activo, created_at,
                tipo_usuarios(nombre),
                empresas(nombre)
            `)
            .eq('empresa_id', user.empresa_id)
            .order('nombre');

        if (error) throw error;

        todosLosUsuarios = usuarios || [];
        paginaActualUsuarios = 1;
        renderizarPaginaUsuarios();
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        usuariosList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar los usuarios</p>';
    }
}

function renderizarPaginaUsuarios() {
    const usuariosList = document.getElementById('usuariosList');
    if (!usuariosList) return;
    
    if (!todosLosUsuarios || todosLosUsuarios.length === 0) {
            usuariosList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay usuarios registrados.</p>';
        const paginationContainer = document.getElementById('usuariosPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

    // Calcular paginación
    const totalPaginas = Math.ceil(todosLosUsuarios.length / itemsPorPaginaUsuarios);
    const inicio = (paginaActualUsuarios - 1) * itemsPorPaginaUsuarios;
    const fin = inicio + itemsPorPaginaUsuarios;
    const usuariosPagina = todosLosUsuarios.slice(inicio, fin);

    // Renderizar usuarios de la página actual
        usuariosList.innerHTML = '';
    usuariosPagina.forEach(usuario => {
            const usuarioCard = createUsuarioCard(usuario);
            usuariosList.appendChild(usuarioCard);
        });

    renderizarPaginacionUsuarios(totalPaginas, todosLosUsuarios.length);
}

function renderizarPaginacionUsuarios(totalPaginas, totalUsuarios) {
    const paginationContainer = document.getElementById('usuariosPagination');
    if (!paginationContainer) return;
    
    if (totalPaginas <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginacionHTML = '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">';
    
    // Botón Anterior
    if (paginaActualUsuarios > 1) {
        paginacionHTML += `
            <button onclick="cambiarPaginaUsuarios(${paginaActualUsuarios - 1})" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
        `;
    }

    // Pestañas de páginas (mostrar máximo 7 pestañas)
    const maxPestañas = 7;
    let inicioPestañas = Math.max(1, paginaActualUsuarios - Math.floor(maxPestañas / 2));
    let finPestañas = Math.min(totalPaginas, inicioPestañas + maxPestañas - 1);
    
    if (finPestañas - inicioPestañas < maxPestañas - 1) {
        inicioPestañas = Math.max(1, finPestañas - maxPestañas + 1);
    }

    // Primera página si no está visible
    if (inicioPestañas > 1) {
        paginacionHTML += `
            <button onclick="cambiarPaginaUsuarios(1)" 
                    style="padding: 8px 12px; background: ${paginaActualUsuarios === 1 ? '#3b82f6' : 'white'}; color: ${paginaActualUsuarios === 1 ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                1
            </button>
        `;
        if (inicioPestañas > 2) {
            paginacionHTML += `<span style="padding: 8px 4px; color: #64748b;">...</span>`;
        }
    }

    // Pestañas visibles
    for (let i = inicioPestañas; i <= finPestañas; i++) {
        paginacionHTML += `
            <button onclick="cambiarPaginaUsuarios(${i})" 
                    style="padding: 8px 12px; background: ${paginaActualUsuarios === i ? '#3b82f6' : 'white'}; color: ${paginaActualUsuarios === i ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                ${i}
            </button>
        `;
    }

    // Última página si no está visible
    if (finPestañas < totalPaginas) {
        if (finPestañas < totalPaginas - 1) {
            paginacionHTML += `<span style="padding: 8px 4px; color: #64748b;">...</span>`;
        }
        paginacionHTML += `
            <button onclick="cambiarPaginaUsuarios(${totalPaginas})" 
                    style="padding: 8px 12px; background: ${paginaActualUsuarios === totalPaginas ? '#3b82f6' : 'white'}; color: ${paginaActualUsuarios === totalPaginas ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                ${totalPaginas}
            </button>
        `;
    }

    // Botón Siguiente
    if (paginaActualUsuarios < totalPaginas) {
        paginacionHTML += `
            <button onclick="cambiarPaginaUsuarios(${paginaActualUsuarios + 1})" 
                    style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    paginacionHTML += '</div>';
    paginationContainer.innerHTML = paginacionHTML;
}

window.cambiarPaginaUsuarios = function(nuevaPagina) {
    paginaActualUsuarios = nuevaPagina;
    renderizarPaginaUsuarios();
};

function createUsuarioCard(usuario) {
    const card = document.createElement('div');
    card.className = 'bodega-card';
    const nombreCapitalizado = capitalizarPrimeraLetra(usuario.nombre);
    const tipoUsuarioNombre = usuario.tipo_usuarios?.nombre || 'N/A';
    card.innerHTML = `
        <div class="bodega-info">
            <h3>${nombreCapitalizado}</h3>
            <p><i class="fas fa-envelope"></i> ${usuario.email || 'Sin email'}</p>
            <p><i class="fas fa-user-tag"></i> ${capitalizarPrimeraLetra(tipoUsuarioNombre)}</p>
            <p><i class="fas fa-circle" style="color: ${usuario.activo ? '#10b981' : '#ef4444'}; font-size: 8px;"></i> ${usuario.activo ? 'Activo' : 'Inactivo'}</p>
        </div>
        <div class="bodega-actions">
            <button class="menu-toggle" data-usuario-id="${usuario.id}">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="dropdown-menu" id="menu-usuario-${usuario.id}" style="display: none;">
                <button class="dropdown-item" data-action="edit" data-usuario-id="${usuario.id}">
                    <i class="fas fa-edit"></i> Actualizar
                </button>
                <button class="dropdown-item danger" data-action="delete" data-usuario-id="${usuario.id}">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
    return card;
}

// Manejar clicks en el menú de usuarios
document.addEventListener('click', function(e) {
    if (e.target.closest('.menu-toggle[data-usuario-id]')) {
        const menuToggle = e.target.closest('.menu-toggle');
        const usuarioId = menuToggle.getAttribute('data-usuario-id');
        const menu = document.getElementById(`menu-usuario-${usuarioId}`);
        
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            if (m.id !== `menu-usuario-${usuarioId}`) {
                m.style.display = 'none';
            }
        });
        
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
    
    if (e.target.closest('.dropdown-item[data-usuario-id]')) {
        const item = e.target.closest('.dropdown-item');
        const action = item.getAttribute('data-action');
        const usuarioId = item.getAttribute('data-usuario-id');
        
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.style.display = 'none';
        });
        
        if (action === 'edit') {
            openEditUsuarioModal(usuarioId);
        } else if (action === 'delete') {
            deleteUsuario(usuarioId);
        }
    }
});

// ============================================
// ABASTECER TIENDA
// ============================================
// La función initAbastecer está definida más abajo (línea 1734)
// con la lógica corregida para evitar duplicados

async function loadUbicacionesPorTipo(tipo, selectElement) {
    if (!tipo) {
        selectElement.innerHTML = '<option value="">Selecciona el tipo primero</option>';
        return;
    }

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const table = tipo === 'bodega' ? 'bodegas' : 'tiendas';
        
        const { data, error } = await window.supabaseClient
            .from(table)
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .order('nombre');

        if (error) throw error;

        selectElement.innerHTML = '<option value="">Selecciona una opción</option>';
        if (data) {
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.nombre;
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error al cargar ubicaciones:', error);
    }
}

// Variables globales para abastecer
// - juguetesDisponiblesAbastecer: lista de juguetes en el origen seleccionado
// - itemsMovimientoAbastecer: lista de juguetes que el usuario decidió mover (tabla inferior)
let juguetesDisponiblesAbastecer = [];
let itemsMovimientoAbastecer = [];

async function loadJuguetesDisponibles() {
    const origenTipo = document.getElementById('origenTipo').value;
    const origenId = document.getElementById('origenSelect').value;
    const container = document.getElementById('juguetesDisponiblesList');
    const buscarInput = document.getElementById('buscarJugueteAbastecer');
    const movimientoContainer = document.getElementById('movimientoAbastecerItems');

    // Reiniciar tabla de movimientos cuando cambia el origen
    itemsMovimientoAbastecer = [];
    if (movimientoContainer) {
        movimientoContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 12px;">Agrega juguetes desde la lista superior para preparar el movimiento.</p>';
    }

    // Limpiar búsqueda al cambiar origen
    if (buscarInput) {
        buscarInput.value = '';
    }

    if (!origenTipo || !origenId) {
        juguetesDisponiblesAbastecer = [];
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Selecciona origen y destino para ver juguetes disponibles</p>';
        return;
    }

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const campo = origenTipo === 'bodega' ? 'bodega_id' : 'tienda_id';
        
        const { data: juguetes, error } = await window.supabaseClient
            .from('juguetes')
            .select('*')
            .eq(campo, origenId)
            .eq('empresa_id', user.empresa_id)
            .gt('cantidad', 0);

        if (error) throw error;

        if (!juguetes || juguetes.length === 0) {
            juguetesDisponiblesAbastecer = [];
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay juguetes disponibles en el origen seleccionado</p>';
            return;
        }

        // Guardar juguetes en variable global para filtrado
        juguetesDisponiblesAbastecer = juguetes;
        
        // Renderizar la lista
        renderizarJuguetesAbastecer(juguetes);
    } catch (error) {
        console.error('Error al cargar juguetes:', error);
        container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar juguetes</p>';
    }
}

// Función para renderizar la lista de juguetes
function renderizarJuguetesAbastecer(juguetes) {
    const container = document.getElementById('juguetesDisponiblesList');
    
    if (!juguetes || juguetes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No se encontraron juguetes</p>';
            return;
        }

        container.innerHTML = juguetes.map(juguete => {
            const itemText = juguete.item ? ` | ITEM: ${juguete.item}` : '';

            // Imagen del juguete (si existe)
            let imagenHTML = '';
            const fotoUrlLimpia = juguete.foto_url ? juguete.foto_url.trim() : '';
            if (fotoUrlLimpia) {
                try {
                    new URL(fotoUrlLimpia);
                    imagenHTML = `<div class="juguete-imagen" style="flex-shrink:0; margin-right:12px;">
                        <img src="${fotoUrlLimpia}" alt="${juguete.nombre}" 
                             style="width:60px; height:60px; border-radius:6px; border:2px solid #e2e8f0; object-fit:cover; background:#f1f5f9;"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:60px; height:60px; background:#f1f5f9; border-radius:6px; border:2px solid #e2e8f0; display:flex; align-items:center; justify-content:center;\\'><i class=\\'fas fa-image\\' style=\\'color:#cbd5e1; font-size:20px;\\'></i></div>';"
                        >
                    </div>`;
                } catch (e) {
                    imagenHTML = `<div class="juguete-imagen" style="flex-shrink:0; margin-right:12px; width:60px; height:60px; background:#f1f5f9; border-radius:6px; border:2px solid #e2e8f0; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-image" style="color:#cbd5e1; font-size:20px;"></i>
                    </div>`;
                }
            } else {
                imagenHTML = `<div class="juguete-imagen" style="flex-shrink:0; margin-right:12px; width:60px; height:60px; background:#f1f5f9; border-radius:6px; border:2px solid #e2e8f0; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-image" style="color:#cbd5e1; font-size:20px;"></i>
                </div>`;
            }

            return `
            <div class="juguete-movimiento-item">
                ${imagenHTML}
                <div class="juguete-info">
                    <strong>${juguete.nombre}</strong> (${juguete.codigo})
                    ${juguete.item ? `<br><small style="color: #92400e; font-weight: 600;">ITEM: ${juguete.item}</small>` : ''}
                    <br><small>Cantidad disponible: ${juguete.cantidad}</small>
                </div>
                <div class="juguete-cantidad">
                    <input 
                        type="number" 
                        class="cantidad-input" 
                        data-juguete-id="${juguete.id}"
                        min="0" 
                        max="${juguete.cantidad}" 
                        value="0"
                        placeholder="0"
                    >
                    <button 
                        type="button" 
                        class="btn-secondary" 
                        style="margin-left: 8px; padding: 6px 10px;" 
                        onclick="agregarItemMovimientoAbastecer(${juguete.id})"
                        title="Agregar a movimiento"
                    >
                        <i class="fas fa-arrow-down"></i>
                    </button>
                </div>
            </div>
        `;
        }).join('');
}

// Función para filtrar juguetes por nombre, código o ITEM (código/ITEM exactos si coinciden)
window.filtrarJuguetesAbastecer = function() {
    const buscarInput = document.getElementById('buscarJugueteAbastecer');
    const termino = buscarInput ? buscarInput.value.toLowerCase().trim() : '';
    
    if (!termino) {
        // Si no hay término de búsqueda, mostrar todos
        renderizarJuguetesAbastecer(juguetesDisponiblesAbastecer);
        return;
    }
    
    const terminoNormalizado = termino.replace(/\s+/g, '');

    // Buscar coincidencias exactas por código o ITEM
    const exactMatches = juguetesDisponiblesAbastecer.filter(juguete => {
        const codigo = (juguete.codigo || '').toLowerCase().replace(/\s+/g, '');
        const item = (juguete.item || '').toLowerCase().replace(/\s+/g, '');
        return codigo === terminoNormalizado || item === terminoNormalizado;
    });

    let juguetesFiltrados;
    if (exactMatches.length > 0) {
        // Si hay coincidencias exactas, mostrar solo esas
        juguetesFiltrados = exactMatches;
    } else {
        // Si no, filtrar por nombre, código o ITEM que contengan el término
        juguetesFiltrados = juguetesDisponiblesAbastecer.filter(juguete => {
            const nombre = (juguete.nombre || '').toLowerCase();
            const codigo = (juguete.codigo || '').toLowerCase();
            const item = (juguete.item || '').toLowerCase();
            return nombre.includes(termino) || codigo.includes(termino) || item.includes(termino);
        });
    }
    
    renderizarJuguetesAbastecer(juguetesFiltrados);
}

// Agregar un juguete desde la lista superior a la tabla de movimiento
window.agregarItemMovimientoAbastecer = function(jugueteId) {
    const input = document.querySelector(`.cantidad-input[data-juguete-id="${jugueteId}"]`);
    if (!input) return;

    const cantidad = parseInt(input.value, 10) || 0;
    const juguete = juguetesDisponiblesAbastecer.find(j => j.id === jugueteId);

    if (!juguete) {
        showAbastecerMessage('Juguete no encontrado en la lista de origen', 'error');
        return;
    }

    if (cantidad <= 0) {
        showAbastecerMessage('Ingresa una cantidad mayor a 0 para agregar el juguete al movimiento', 'error');
        return;
    }

    if (cantidad > (juguete.cantidad || 0)) {
        showAbastecerMessage(`No puedes mover más de la cantidad disponible (${juguete.cantidad}) para el juguete ${juguete.nombre}`, 'error');
        return;
    }

    // Agregar o actualizar en la tabla de movimiento
    const existente = itemsMovimientoAbastecer.find(i => i.juguete_id === jugueteId);
    if (existente) {
        existente.cantidad = cantidad;
    } else {
        itemsMovimientoAbastecer.push({
            juguete_id: juguete.id,
            codigo: juguete.codigo,
            item: juguete.item || null,
            nombre: juguete.nombre,
            cantidad: cantidad
        });
    }

    renderMovimientoAbastecerTabla();
};

// Renderizar la tabla inferior con los juguetes a mover
window.renderMovimientoAbastecerTabla = function() {
    const container = document.getElementById('movimientoAbastecerItems');
    if (!container) return;

    if (!itemsMovimientoAbastecer.length) {
        container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 12px;">Agrega juguetes desde la lista superior para preparar el movimiento.</p>';
        return;
    }

    const totalUnidades = itemsMovimientoAbastecer.reduce((sum, it) => sum + (it.cantidad || 0), 0);

    container.innerHTML = `
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <table class="inventario-table" style="min-width: 600px; width: 100%;">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>ITEM</th>
                    <th>Juguete</th>
                    <th style="width: 120px; text-align: center;">Cantidad a Mover</th>
                    <th style="width: 60px;"></th>
                </tr>
            </thead>
            <tbody>
                ${itemsMovimientoAbastecer.map((it, index) => `
                    <tr>
                        <td><code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #3b82f6;">${it.codigo}</code></td>
                        <td>${it.item ? `<code style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #92400e;">${it.item}</code>` : '<span style="color: #94a3b8;">-</span>'}</td>
                        <td>${it.nombre}</td>
                        <td style="text-align: center;">
                            <input 
                                type="number" 
                                min="1" 
                                value="${it.cantidad}" 
                                style="width: 80px; text-align: center;" 
                                onchange="actualizarCantidadMovimientoAbastecer(${it.juguete_id}, this.value)"
                            >
                        </td>
                        <td style="text-align: center;">
                            <button type="button" class="btn-secondary" style="padding: 4px 8px;" onclick="eliminarItemMovimientoAbastecer(${index})" title="Quitar">
                                <i class="fas fa-times"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="text-align: right; font-weight: bold;">Total unidades:</td>
                    <td colspan="2" style="text-align: left; font-weight: bold; color: #10b981;">${totalUnidades}</td>
                </tr>
            </tfoot>
        </table>
        </div>
    `;
};

// Actualizar cantidad desde la tabla inferior
window.actualizarCantidadMovimientoAbastecer = function(jugueteId, valor) {
    const cantidad = parseInt(valor, 10) || 0;
    const item = itemsMovimientoAbastecer.find(i => i.juguete_id === jugueteId);
    const juguete = juguetesDisponiblesAbastecer.find(j => j.id === jugueteId);

    if (!item || !juguete) return;

    if (cantidad <= 0) {
        showAbastecerMessage('La cantidad debe ser mayor a 0', 'error');
        item.cantidad = 1;
    } else if (cantidad > (juguete.cantidad || 0)) {
        showAbastecerMessage(`No puedes mover más de la cantidad disponible (${juguete.cantidad}) para el juguete ${juguete.nombre}`, 'error');
        item.cantidad = juguete.cantidad;
    } else {
        item.cantidad = cantidad;
    }

    renderMovimientoAbastecerTabla();
};

// Eliminar item de la tabla de movimiento
window.eliminarItemMovimientoAbastecer = function(index) {
    itemsMovimientoAbastecer.splice(index, 1);
    renderMovimientoAbastecerTabla();
};

// Variable global para el plan actual
let planActualData = null;

// Función para generar el plan de movimiento
window.generarPlanMovimiento = function() {
    const origenTipo = document.getElementById('origenTipo');
    const origenSelect = document.getElementById('origenSelect');
    const destinoTipo = document.getElementById('destinoTipo');
    const destinoSelect = document.getElementById('destinoSelect');
    const planContainer = document.getElementById('planMovimientoContainer');
    const planContent = document.getElementById('planMovimientoContent');
    
    // Validar que haya origen y destino seleccionados
    if (!origenTipo?.value || !origenSelect?.value || !destinoTipo?.value || !destinoSelect?.value) {
        showAbastecerMessage('Selecciona origen y destino para generar el plan', 'error');
        return;
    }
    
    // Obtener juguetes desde la tabla de movimiento (itemsMovimientoAbastecer)
    const juguetesSeleccionados = (itemsMovimientoAbastecer || []).map(it => ({
        juguete_codigo: it.codigo,
        nombre: it.nombre,
        codigo: it.codigo,
        item: it.item || null,
        cantidad: it.cantidad || 0
    })).filter(j => j.cantidad > 0);
    
    if (juguetesSeleccionados.length === 0) {
        showAbastecerMessage('Ingresa cantidad en al menos un juguete para generar el plan', 'error');
        return;
    }
    
    // Obtener nombres de origen y destino
    const origenNombre = origenSelect.options[origenSelect.selectedIndex]?.text || 'N/A';
    const destinoNombre = destinoSelect.options[destinoSelect.selectedIndex]?.text || 'N/A';
    const origenTipoTexto = origenTipo.value === 'bodega' ? 'Bodega' : 'Tienda';
    const destinoTipoTexto = destinoTipo.value === 'bodega' ? 'Bodega' : 'Tienda';
    
    // Guardar datos del plan actual
    planActualData = {
        tipo_origen: origenTipo.value,
        origen_id: parseInt(origenSelect.value),
        origen_nombre: origenNombre,
        tipo_destino: destinoTipo.value,
        destino_id: parseInt(destinoSelect.value),
        destino_nombre: destinoNombre,
        items: juguetesSeleccionados,
        total_items: juguetesSeleccionados.length,
        total_unidades: juguetesSeleccionados.reduce((sum, j) => sum + j.cantidad, 0)
    };
    
    // Generar fecha actual
    const fechaActual = new Date().toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Generar HTML del plan (formato simple para guardar)
    const planHTML = `
        <div id="planParaImprimir" style="background: white; padding: 20px; border-radius: 8px;">
            <h3 style="color: #6366f1; margin-bottom: 20px;">Plan de Movimiento</h3>
            <p><strong>Fecha:</strong> ${fechaActual}</p>
            <p><strong>Estado:</strong> PENDIENTE</p>
            
            <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px;">
                <p><strong>Origen:</strong> ${origenNombre} (${origenTipoTexto})</p>
                <p><strong>Destino:</strong> ${destinoNombre} (${destinoTipoTexto})</p>
            </div>
            
            <h4>Items (${juguetesSeleccionados.length}):</h4>
            <ul style="list-style: none; padding: 0;">
                ${juguetesSeleccionados.map(i => `
                    <li style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                        <strong>${i.nombre}</strong> (${i.codigo}${i.item ? `, ITEM: ${i.item}` : ''}) - ${i.cantidad} unidades
                    </li>
                `).join('')}
            </ul>
            
            <p style="margin-top: 15px;"><strong>Total:</strong> ${planActualData.total_unidades} unidades</p>
        </div>
        
        <!-- Botones de acción -->
        <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
            <button type="button" onclick="guardarPlanMovimiento()" class="btn-primary" style="background: #6366f1; flex: 1; min-width: 150px;">
                <i class="fas fa-save"></i> Guardar Plan
            </button>
            <button type="button" onclick="imprimirPlanMovimiento()" class="btn-secondary" style="background: #10b981; color: white; flex: 1; min-width: 150px;">
                <i class="fas fa-print"></i> Imprimir
            </button>
        </div>
    `;
    
    planContent.innerHTML = planHTML;
    planContainer.style.display = 'block';
    
    // Scroll al plan
    planContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Función para guardar el plan de movimiento en la base de datos
window.guardarPlanMovimiento = async function() {
    // Protección contra doble clic: sin esto se guardaban dos planes idénticos
    const boton = document.querySelector('button[onclick="guardarPlanMovimiento()"]');
    if (boton) {
        return preventDoubleClick(boton, guardarPlanMovimientoInterno, { loadingText: 'Guardando plan...' }).catch(() => {});
    }
    return guardarPlanMovimientoInterno();
};

async function guardarPlanMovimientoInterno() {
    if (!planActualData) {
        showAbastecerMessage('No hay un plan para guardar', 'error');
        return;
    }
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Generar código único para el plan
        const codigoPlan = 'PLAN-' + Date.now().toString(36).toUpperCase();
        
        const planData = {
            codigo_plan: codigoPlan,
            tipo_origen: planActualData.tipo_origen,
            origen_id: planActualData.origen_id,
            origen_nombre: planActualData.origen_nombre,
            tipo_destino: planActualData.tipo_destino,
            destino_id: planActualData.destino_id,
            destino_nombre: planActualData.destino_nombre,
            items: planActualData.items,
            estado: 'pendiente',
            total_items: planActualData.total_items,
            total_unidades: planActualData.total_unidades,
            empresa_id: user.empresa_id,
            creado_por: user.nombre
        };
        
        const { data, error } = await window.supabaseClient
            .from('planes_movimiento')
            .insert(planData)
            .select()
            .single();
        
        if (error) throw error;
        
        showAbastecerMessage(`Plan guardado correctamente con código: ${codigoPlan}`, 'success');
        
        // Actualizar badge de notificación
        await actualizarBadgePlanesPendientes();
        
        // Limpiar plan actual
        planActualData = null;
        document.getElementById('planMovimientoContainer').style.display = 'none';
        
        // Limpiar formulario
        document.getElementById('origenTipo').value = '';
        document.getElementById('origenSelect').innerHTML = '<option value="">Primero selecciona el tipo</option>';
        document.getElementById('destinoTipo').value = '';
        document.getElementById('destinoSelect').innerHTML = '<option value="">Primero selecciona el tipo</option>';
        document.getElementById('juguetesDisponiblesList').innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">Selecciona origen y destino para ver juguetes disponibles</p>';
        
    } catch (error) {
        console.error('Error al guardar plan:', error);
        showAbastecerMessage('Error al guardar el plan: ' + error.message, 'error');
    }
}

// Función para actualizar el badge de planes pendientes
async function actualizarBadgePlanesPendientes() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user) return;
        
        const { count, error } = await window.supabaseClient
            .from('planes_movimiento')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', user.empresa_id)
            .eq('estado', 'pendiente');
        
        if (error) {
            console.error('Error al contar planes pendientes:', error);
            return;
        }
        
        const badge = document.getElementById('badgePlanesPendientes');
        const countPendientes = document.getElementById('countPendientes');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
        
        if (countPendientes) {
            countPendientes.textContent = count || 0;
        }
    } catch (error) {
        console.error('Error al actualizar badge:', error);
    }
}

// Función para cargar planes pendientes
async function cargarPlanesPendientes() {
    const container = document.getElementById('listaPlanessPendientes');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; padding: 40px; color: #64748b;">Cargando planes...</p>';
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        const { data: planes, error } = await window.supabaseClient
            .from('planes_movimiento')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!planes || planes.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: #64748b; padding: 40px;">
                    <i class="fas fa-clipboard-check" style="font-size: 48px; margin-bottom: 15px; display: block; opacity: 0.3;"></i>
                    No hay planes de movimiento pendientes.
                </p>
            `;
            return;
        }
        
        container.innerHTML = planes.map(plan => renderizarPlanCard(plan, true)).join('');
        
    } catch (error) {
        console.error('Error al cargar planes:', error);
        container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">Error al cargar planes</p>';
    }
}

// Función para cargar historial de movimientos
async function cargarHistorialMovimientos() {
    const container = document.getElementById('listaHistorialMovimientos');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; padding: 40px; color: #64748b;">Cargando historial...</p>';
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Obtener fechas de filtro
        const fechaDesde = document.getElementById('historialFechaDesde')?.value;
        const fechaHasta = document.getElementById('historialFechaHasta')?.value;
        
        let query = window.supabaseClient
            .from('planes_movimiento')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .in('estado', ['ejecutado', 'cancelado'])
            .order('ejecutado_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (fechaDesde) {
            query = query.gte('created_at', fechaDesde + 'T00:00:00');
        }
        if (fechaHasta) {
            query = query.lte('created_at', fechaHasta + 'T23:59:59');
        }
        
        const { data: planes, error } = await query;
        
        if (error) throw error;
        
        if (!planes || planes.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: #64748b; padding: 40px;">
                    <i class="fas fa-history" style="font-size: 48px; margin-bottom: 15px; display: block; opacity: 0.3;"></i>
                    No hay movimientos en el historial.
                </p>
            `;
            return;
        }
        
        container.innerHTML = planes.map(plan => renderizarPlanCard(plan, false)).join('');
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">Error al cargar historial</p>';
    }
}

// Función para renderizar una tarjeta de plan
function renderizarPlanCard(plan, esPendiente) {
    const fecha = new Date(plan.created_at).toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const estadoClass = plan.estado === 'ejecutado' ? 'ejecutado' : (plan.estado === 'cancelado' ? 'cancelado' : '');
    const estadoBadge = plan.estado === 'ejecutado' 
        ? '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">EJECUTADO</span>'
        : (plan.estado === 'cancelado' 
            ? '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">CANCELADO</span>'
            : '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">PENDIENTE</span>');
    
    const items = plan.items || [];
    const itemsPreview = items.slice(0, 3).map(i => `${i.nombre} (${i.cantidad})`).join(', ');
    const masItems = items.length > 3 ? ` y ${items.length - 3} más...` : '';
    
    return `
        <div class="plan-card ${estadoClass}">
            <div class="plan-header">
                <div>
                    <span class="plan-codigo">${plan.codigo_plan}</span>
                    ${estadoBadge}
                    <p class="plan-fecha">${fecha}</p>
                </div>
            </div>
            
            <div class="plan-ubicaciones">
                <div class="plan-ubicacion">
                    <p class="plan-ubicacion-tipo">${plan.tipo_origen === 'bodega' ? 'Bodega' : 'Tienda'}</p>
                    <p class="plan-ubicacion-nombre">${plan.origen_nombre}</p>
                </div>
                <div class="plan-flecha">
                    <i class="fas fa-arrow-right"></i>
                </div>
                <div class="plan-ubicacion">
                    <p class="plan-ubicacion-tipo">${plan.tipo_destino === 'bodega' ? 'Bodega' : 'Tienda'}</p>
                    <p class="plan-ubicacion-nombre">${plan.destino_nombre}</p>
                </div>
            </div>
            
            <div class="plan-items-resumen">
                <span><i class="fas fa-box"></i> ${plan.total_items} items</span>
                <span><i class="fas fa-cubes"></i> ${plan.total_unidades} unidades</span>
            </div>
            
            <p style="font-size: 13px; color: #64748b; margin-bottom: 15px;">
                ${itemsPreview}${masItems}
            </p>
            
            ${esPendiente ? `
                <div class="plan-actions">
                    <button type="button" onclick="ejecutarPlanMovimiento(${plan.id})" class="btn-primary" style="background: #10b981;">
                        <i class="fas fa-check"></i> Ejecutar Movimiento
                    </button>
                    <button type="button" onclick="verDetallePlan(${plan.id})" class="btn-secondary">
                        <i class="fas fa-eye"></i> Ver Detalle
                    </button>
                    <button type="button" onclick="cancelarPlan(${plan.id})" class="btn-secondary" style="color: #ef4444;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            ` : `
                <div class="plan-actions">
                    <button type="button" onclick="verDetallePlan(${plan.id})" class="btn-secondary">
                        <i class="fas fa-eye"></i> Ver Detalle
                    </button>
                </div>
                ${plan.ejecutado_por ? `<p style="font-size: 11px; color: #64748b; margin-top: 10px;">Ejecutado por: ${plan.ejecutado_por}</p>` : ''}
            `}
        </div>
    `;
}

// Función para cambiar entre tabs
window.cambiarTabPlanes = function(tab) {
    const tabPendientes = document.getElementById('tabPendientes');
    const tabHistorial = document.getElementById('tabHistorial');
    const contentPendientes = document.getElementById('planesPendientesContent');
    const contentHistorial = document.getElementById('historialMovimientosContent');
    
    if (tab === 'pendientes') {
        tabPendientes.style.background = '#6366f1';
        tabPendientes.style.color = 'white';
        tabHistorial.style.background = '#e2e8f0';
        tabHistorial.style.color = '#64748b';
        contentPendientes.style.display = 'block';
        contentHistorial.style.display = 'none';
        cargarPlanesPendientes();
    } else {
        tabHistorial.style.background = '#6366f1';
        tabHistorial.style.color = 'white';
        tabPendientes.style.background = '#e2e8f0';
        tabPendientes.style.color = '#64748b';
        contentHistorial.style.display = 'block';
        contentPendientes.style.display = 'none';
        cargarHistorialMovimientos();
    }
};

// Función para filtrar historial
window.filtrarHistorialMovimientos = function() {
    cargarHistorialMovimientos();
};

// Función para ejecutar un plan de movimiento - con protección contra clics múltiples
window.ejecutarPlanMovimiento = async function(planId) {
    if (!confirm('¿Estás seguro de que deseas ejecutar este plan de movimiento?\n\nEsto moverá los juguetes del origen al destino en el sistema.')) {
        return;
    }
    
    // Obtener el botón que ejecutó la acción (si se llama desde onclick)
    let button = null;
    try {
        // Intentar obtener el botón desde el evento
        const event = window.event || (arguments.length > 1 ? arguments[1] : null);
        if (event && event.target) {
            button = event.target.closest('button');
        }
    } catch (e) {
        // Si no se puede obtener, buscar el botón por el planId
        const buttonSelector = `button[onclick*="ejecutarPlanMovimiento(${planId})"]`;
        button = document.querySelector(buttonSelector);
    }
    
    // Si hay un botón, proteger contra clics múltiples
    if (button) {
        await preventDoubleClick(button, async () => {
            await ejecutarPlanMovimientoInterno(planId);
        }, {
            loadingText: 'Ejecutando plan...',
            showSpinner: true
        });
    } else {
        // Si no hay botón, ejecutar directamente
        await ejecutarPlanMovimientoInterno(planId);
    }
};

// Función interna para ejecutar el plan
async function ejecutarPlanMovimientoInterno(planId) {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Obtener el plan
        const { data: plan, error: planError } = await window.supabaseClient
            .from('planes_movimiento')
            .select('*')
            .eq('id', planId)
            .single();
        
        if (planError) throw planError;
        
        if (plan.estado !== 'pendiente') {
            alert('Este plan ya fue ejecutado o cancelado');
            cargarPlanesPendientes();
            return;
        }

        if (window.usarStockRpc && window.usarStockRpc()) {
            // La BD mueve los items con stock, registra movimientos y marca el plan (una transacción)
            const resultado = await window.servicioStockRpc.ejecutarPlan(planId);
            const omitidos = resultado.omitidos || [];
            if (!resultado.ejecutado) {
                alert('No se pudo ejecutar ningún item del plan; sigue pendiente.\n\n' + omitidos.join('\n'));
                return;
            }
            alert(`Plan ejecutado. ${resultado.procesados} de ${resultado.total} items procesados.` +
                (omitidos.length ? `\n\nItems omitidos:\n${omitidos.join('\n')}` : ''));
            await actualizarBadgePlanesPendientes();
            cargarPlanesPendientes();
            if (typeof loadInventario === 'function') await loadInventario();
            if (typeof loadDashboardSummary === 'function') await loadDashboardSummary();
            return;
        }
        
        const items = plan.items || [];
        let itemsProcesados = 0;
        const itemsOmitidos = [];
        
        // Procesar cada item del plan
        for (const item of items) {
            try {
                // Obtener juguete actual del origen (buscar por código)
                const jugueteCodigo = item.juguete_codigo || item.codigo;
                if (!jugueteCodigo) {
                    console.warn(`Item sin código de juguete, saltando...`);
                    continue;
                }
                
                // Filtrar juguete por código y por ubicación de origen del plan
                const campoOrigen = plan.tipo_origen === 'bodega' ? 'bodega_id' : 'tienda_id';
                const { data: jugueteActualData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', jugueteCodigo)
                    .eq(campoOrigen, plan.origen_id)
                    .eq('empresa_id', user.empresa_id)
                    .limit(1);

                if (!jugueteActualData || jugueteActualData.length === 0) {
                    console.warn(`Juguete con código ${jugueteCodigo} no encontrado, saltando...`);
                    itemsOmitidos.push(`${jugueteCodigo}: no está en el origen`);
                    continue;
                }

                const jugueteActual = jugueteActualData[0];

                if (jugueteActual.cantidad < item.cantidad) {
                    console.warn(`No hay suficiente cantidad del juguete ${jugueteActual.nombre}`);
                    itemsOmitidos.push(`${jugueteActual.nombre}: stock insuficiente (${jugueteActual.cantidad} de ${item.cantidad})`);
                    continue;
                }

                // Mover unidades actualizando los registros en su lugar (servicio compartido con Abastecer)
                await window.servicioStock.transferir({
                    jugueteOrigenId: jugueteActual.id,
                    cantidad: item.cantidad,
                    destinoTipo: plan.tipo_destino,
                    destinoId: plan.destino_id,
                    empresaId: user.empresa_id
                });

                // Registrar movimiento
                await window.supabaseClient
                    .from('movimientos')
                    .insert({
                        tipo_origen: plan.tipo_origen,
                        origen_id: plan.origen_id,
                        tipo_destino: plan.tipo_destino,
                        destino_id: plan.destino_id,
                        juguete_codigo: item.juguete_codigo || item.codigo,
                        cantidad: item.cantidad,
                        empresa_id: user.empresa_id
                    });

                itemsProcesados++;
            } catch (itemError) {
                console.error('Error procesando item:', itemError);
                itemsOmitidos.push(`${item.nombre || item.codigo || 'item'}: ${itemError.message}`);
            }
        }
        
        // Si no se pudo mover nada, el plan queda pendiente para corregirlo y reintentar
        if (itemsProcesados === 0 && items.length > 0) {
            alert('No se pudo ejecutar ningún item del plan; sigue pendiente.\n\n' + itemsOmitidos.join('\n'));
            return;
        }

        // Actualizar estado del plan
        const { error: errorEstado } = await window.supabaseClient
            .from('planes_movimiento')
            .update({
                estado: 'ejecutado',
                ejecutado_por: user.nombre,
                ejecutado_at: new Date().toISOString()
            })
            .eq('id', planId);
        if (errorEstado) console.error('No se pudo actualizar el estado del plan:', errorEstado);
        
        alert(`Plan ejecutado. ${itemsProcesados} de ${items.length} items procesados.` +
            (itemsOmitidos.length ? `\n\nItems omitidos:\n${itemsOmitidos.join('\n')}` : ''));
        
        // Limpiar tabla de juguetes a mover en la vista de abastecer
        itemsMovimientoAbastecer = [];
        const containerTabla = document.getElementById('movimientoAbastecerItems');
        if (containerTabla) {
            containerTabla.innerHTML = '<p style="text-align: center; color: #64748b; padding: 12px;">Agrega juguetes desde la lista superior para preparar el movimiento.</p>';
        }
        // También llamar a la función de renderizado si está disponible
        if (typeof window.renderMovimientoAbastecerTabla === 'function') {
            window.renderMovimientoAbastecerTabla();
        }
        
        // Actualizar vistas
        await actualizarBadgePlanesPendientes();
        cargarPlanesPendientes();
        
    } catch (error) {
        console.error('Error al ejecutar plan:', error);
        alert('Error al ejecutar el plan: ' + error.message);
    }
};

// Función para cancelar un plan
window.cancelarPlan = async function(planId) {
    if (!confirm('¿Estás seguro de que deseas cancelar este plan?')) {
        return;
    }
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        await window.supabaseClient
            .from('planes_movimiento')
            .update({
                estado: 'cancelado',
                ejecutado_por: user.nombre,
                ejecutado_at: new Date().toISOString()
            })
            .eq('id', planId);
        
        await actualizarBadgePlanesPendientes();
        cargarPlanesPendientes();
        
    } catch (error) {
        console.error('Error al cancelar plan:', error);
        alert('Error al cancelar el plan: ' + error.message);
    }
};

// Función para ver detalle de un plan (formato de impresión con checkboxes interactivos)
window.verDetallePlan = async function(planId) {
    try {
        const { data: plan, error } = await window.supabaseClient
            .from('planes_movimiento')
            .select('*')
            .eq('id', planId)
            .single();
        
        if (error) throw error;
        
        const items = plan.items || [];
        const fecha = new Date(plan.created_at).toLocaleString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const origenTipoTexto = plan.tipo_origen === 'bodega' ? 'Bodega' : 'Tienda';
        const destinoTipoTexto = plan.tipo_destino === 'bodega' ? 'Bodega' : 'Tienda';
        
        // Generar IDs únicos para cada checkbox
        const checkboxIds = items.map((_, idx) => `checkbox-plan-${planId}-${idx}`);
        
        const detalleHTML = `
            <div id="planDetalleParaImprimir" style="background: white; padding: 20px; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
                    <h2 style="margin: 0 0 5px 0; color: #1e293b;">📦 Plan de Movimiento de Inventario</h2>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">${fecha}</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0 0 5px 0; color: #92400e; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                            <i class="fas fa-arrow-right"></i> ORIGEN
                        </p>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: bold;">${plan.origen_nombre}</p>
                        <p style="margin: 0; color: #64748b; font-size: 12px;">${origenTipoTexto}</p>
                    </div>
                    <div style="background: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                        <p style="margin: 0 0 5px 0; color: #065f46; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                            <i class="fas fa-arrow-left"></i> DESTINO
                        </p>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: bold;">${plan.destino_nombre}</p>
                        <p style="margin: 0; color: #64748b; font-size: 12px;">${destinoTipoTexto}</p>
                    </div>
                </div>
                
                <h4 style="margin: 0 0 10px 0; color: #1e293b;">
                    <i class="fas fa-list"></i> Juguetes a Mover (${items.length})
                </h4>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569;">✓</th>
                            <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569;">Código</th>
                            <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569;">Juguete</th>
                            <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #e2e8f0; color: #475569;">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((j, index) => `
                            <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 0 ? 'background: #fafafa;' : ''}">
                                <td style="padding: 12px 8px;">
                                    <div 
                                        id="${checkboxIds[index]}"
                                        class="plan-checkbox" 
                                        data-checked="false"
                                        onclick="togglePlanCheckbox('${checkboxIds[index]}')"
                                        style="width: 20px; height: 20px; border: 2px solid #cbd5e1; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                                    ></div>
                                </td>
                                <td style="padding: 12px 8px; font-family: monospace; color: #6366f1; font-weight: bold;">${j.codigo}</td>
                                <td style="padding: 12px 8px; color: #1e293b;">${j.nombre}</td>
                                <td style="padding: 12px 8px; text-align: center; font-weight: bold; font-size: 16px; color: #059669;">${j.cantidad}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f1f5f9;">
                            <td colspan="3" style="padding: 12px 8px; text-align: right; font-weight: bold; color: #1e293b;">Total de unidades:</td>
                            <td style="padding: 12px 8px; text-align: center; font-weight: bold; font-size: 18px; color: #6366f1;">
                                ${plan.total_unidades}
                            </td>
                        </tr>
                    </tfoot>
                </table>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px dashed #e2e8f0;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                        <div>
                            <p style="margin: 0 0 30px 0; color: #64748b; font-size: 12px;">Firma de quien entrega:</p>
                            <div style="border-bottom: 1px solid #1e293b; margin-bottom: 5px;"></div>
                            <p style="margin: 0; color: #64748b; font-size: 11px;">Nombre: _______________________</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 30px 0; color: #64748b; font-size: 12px;">Firma de quien recibe:</p>
                            <div style="border-bottom: 1px solid #1e293b; margin-bottom: 5px;"></div>
                            <p style="margin: 0; color: #64748b; font-size: 11px;">Nombre: _______________________</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Mostrar en modal
        const modal = document.createElement('div');
        modal.id = `modal-plan-${planId}`;
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; max-width: 90%; max-height: 90%; overflow: auto; position: relative;">
                ${detalleHTML}
                <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                    <button onclick="imprimirPlanDetalle(${planId})" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    <button onclick="document.getElementById('modal-plan-${planId}').remove()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error al cargar detalle:', error);
        alert('Error al cargar detalle del plan');
    }
};

// Función para toggle de checkbox en el plan
window.togglePlanCheckbox = function(checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    if (!checkbox) return;
    
    const isChecked = checkbox.dataset.checked === 'true';
    
    if (isChecked) {
        // Desmarcar
        checkbox.dataset.checked = 'false';
        checkbox.style.background = 'transparent';
        checkbox.style.borderColor = '#cbd5e1';
        checkbox.innerHTML = '';
    } else {
        // Marcar
        checkbox.dataset.checked = 'true';
        checkbox.style.background = '#10b981';
        checkbox.style.borderColor = '#10b981';
        checkbox.innerHTML = '<i class="fas fa-check" style="color: white; font-size: 12px;"></i>';
    }
};

// Función para imprimir el detalle del plan
window.imprimirPlanDetalle = function(planId) {
    const planParaImprimir = document.getElementById('planDetalleParaImprimir');
    
    if (!planParaImprimir) {
        alert('No se encontró el plan para imprimir');
        return;
    }
    
    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank', 'width=800,height=600');
    
    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Plan de Movimiento - Toys Wall</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    padding: 20px;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                @media print {
                    body { padding: 10px; }
                    @page { margin: 1cm; }
                }
            </style>
        </head>
        <body>
            ${planParaImprimir.outerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);
    
    ventanaImpresion.document.close();
};

// Inicializar planes al cargar la vista
function initPlanesMovimiento() {
    actualizarBadgePlanesPendientes();
    cargarPlanesPendientes();
}

// Función para imprimir el plan de movimiento
window.imprimirPlanMovimiento = function() {
    const planParaImprimir = document.getElementById('planParaImprimir');
    
    if (!planParaImprimir) {
        showAbastecerMessage('Primero genera el plan de movimiento', 'error');
        return;
    }
    
    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank', 'width=800,height=600');
    
    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Plan de Movimiento - Toys Wall</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    padding: 20px;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                @media print {
                    body { padding: 10px; }
                    @page { margin: 1cm; }
                }
            </style>
        </head>
        <body>
            ${planParaImprimir.outerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);
    
    ventanaImpresion.document.close();
};

function showAbastecerMessage(message, type) {
    const errorMsg = document.getElementById('abastecerErrorMessage');
    const successMsg = document.getElementById('abastecerSuccessMessage');
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
    
    programarOcultarMensajes(errorMsg, successMsg); // reinicia el temporizador si ya había un mensaje
}

// ============================================
// ANÁLISIS Y EXPORTACIÓN
// ============================================

async function loadAnalisis() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Cargar estadísticas
        const [bodegas, tiendas, empleados, ventas] = await Promise.all([
            window.supabaseClient.from('bodegas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('tiendas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('empleados').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('ventas').select('precio_venta').eq('empresa_id', user.empresa_id)
        ]);

        document.getElementById('totalBodegasAnalisis').textContent = bodegas.count || 0;
        document.getElementById('totalTiendasAnalisis').textContent = tiendas.count || 0;
        document.getElementById('totalEmpleadosAnalisis').textContent = empleados.count || 0;
        
        const totalVentas = ventas.data?.length || 0;
        document.getElementById('totalJuguetesVendidos').textContent = totalVentas;
        
        const ganancias = ventas.data?.reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0) || 0;
        document.getElementById('gananciasTotales').textContent = '$' + ganancias.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Cargar y mostrar gráficos
        await cargarGraficosAnalisis();
        await cargarGraficosPorTienda();
        await cargarGraficoVentasPorEmpleado();

        // Configurar filtros
        setupAnalisisFilters();
        
        // Configurar exportación
        setupExportButtons();
    } catch (error) {
        console.error('Error al cargar análisis:', error);
    }
}

function setupAnalisisFilters() {
    const filtroVentas = document.getElementById('filtroVentas');
    const filtroGanancias = document.getElementById('filtroGanancias');
    
    if (filtroVentas) {
        filtroVentas.addEventListener('change', async function() {
            await aplicarFiltroVentas(this.value);
        });
    }
    
    if (filtroGanancias) {
        filtroGanancias.addEventListener('change', async function() {
            await aplicarFiltroGanancias(this.value);
        });
    }
}

async function aplicarFiltroVentas(filtro) {
    // Implementar lógica de filtrado
    console.log('Aplicar filtro de ventas:', filtro);
}

async function aplicarFiltroGanancias(filtro) {
    // Implementar lógica de filtrado
    console.log('Aplicar filtro de ganancias:', filtro);
}

function setupExportButtons() {
    const exportButtons = document.querySelectorAll('.btn-export');
    exportButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const tipo = this.dataset.export;
            await exportarAExcel(tipo);
        });
    });
}

async function exportarAExcel(tipo) {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const isEmpleado = user.tipo_usuario_id === 3;
        let data = [];
        let filename = '';

        switch(tipo) {
            case 'usuarios':
                const { data: usuarios, error: errorUsuarios } = await window.supabaseClient
                    .from('usuarios')
                    .select(`
                        nombre, 
                        email, 
                        tipo_usuario_id, 
                        activo, 
                        created_at,
                        tipo_usuarios(nombre)
                    `)
                    .eq('empresa_id', user.empresa_id);
                
                if (errorUsuarios) throw errorUsuarios;
                
                // Formatear datos para Excel
                data = (usuarios || []).map(u => ({
                    'Nombre': u.nombre || '',
                    'Email': u.email || '',
                    'Tipo de Usuario': u.tipo_usuarios?.nombre || u.tipo_usuario_id || '',
                    'Activo': u.activo ? 'Sí' : 'No',
                    'Fecha de Creación': u.created_at ? new Date(u.created_at).toLocaleString('es-CO') : ''
                }));
                filename = 'usuarios.xlsx';
                break;
            case 'juguetes':
                const { data: juguetes, error: errorJuguetes } = await window.supabaseClient
                    .from('juguetes')
                    .select(`
                        nombre, 
                        codigo, 
                        cantidad, 
                        created_at,
                        tiendas(nombre),
                        bodegas(nombre)
                    `)
                    .eq('empresa_id', user.empresa_id);
                
                if (errorJuguetes) throw errorJuguetes;
                
                // Formatear datos para Excel
                data = (juguetes || []).map(j => ({
                    'Nombre': j.nombre || '',
                    'Código': j.codigo || '',
                    'Cantidad': j.cantidad || 0,
                    'Ubicación': j.tiendas?.nombre || j.bodegas?.nombre || 'Sin ubicación',
                    'Tipo Ubicación': j.tiendas ? 'Tienda' : (j.bodegas ? 'Bodega' : 'N/A'),
                    'Fecha de Creación': j.created_at ? new Date(j.created_at).toLocaleString('es-CO') : ''
                }));
                filename = 'juguetes.xlsx';
                break;
            case 'facturas':
                const { data: facturas, error: errorFacturas } = await window.supabaseClient
                    .from('facturas')
                    .select('codigo_factura, cliente_nombre, cliente_documento, cliente_email, total, created_at')
                    .eq('empresa_id', user.empresa_id);
                
                if (errorFacturas) throw errorFacturas;
                
                // Formatear datos para Excel
                data = (facturas || []).map(f => ({
                    'Código Factura': f.codigo_factura || '',
                    'Cliente': f.cliente_nombre || '',
                    'Documento': f.cliente_documento || '',
                    'Email': f.cliente_email || '',
                    'Total': f.total ? parseFloat(f.total).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
                    'Fecha': f.created_at ? new Date(f.created_at).toLocaleString('es-CO') : ''
                }));
                filename = 'facturas.xlsx';
                break;
            case 'ventas':
                // Cargar ventas sin relaciones automáticas
                let ventasExportQuery = window.supabaseClient
                    .from('ventas')
                    .select('codigo_venta, precio_venta, cantidad, metodo_pago, created_at, juguete_codigo, empleado_id')
                    .eq('empresa_id', user.empresa_id);
                // Empleados solo exportan ventas normales (no al por mayor)
                if (isEmpleado) {
                    ventasExportQuery = ventasExportQuery.eq('es_por_mayor', false);
                }
                const { data: ventasSimples, error: errorVentas } = await ventasExportQuery;
                
                if (errorVentas) throw errorVentas;
                
                // Cargar juguetes y empleados por separado
                let ventas = [];
                if (ventasSimples && ventasSimples.length > 0) {
                    const jugueteCodigos = [...new Set(ventasSimples.map(v => v.juguete_codigo).filter(c => c))];
                    const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
                    
                    const [juguetesData, empleadosData] = await Promise.all([
                        jugueteCodigos.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id) : { data: [] },
                        empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
                    ]);

                    const juguetesMap = new Map((juguetesData.data || []).map(j => [j.codigo, j]));
                    const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

                    ventas = ventasSimples.map(v => ({
                        ...v,
                        juguetes: juguetesMap.get(v.juguete_codigo) || null,
                        empleados: empleadosMap.get(v.empleado_id) || null
                    }));
                }
                
                // Formatear datos para Excel
                data = (ventas || []).map(v => ({
                    'Código Venta': v.codigo_venta || '',
                    'Juguete': v.juguetes?.nombre || '',
                    'Código Juguete': v.juguetes?.codigo || '',
                    'Cantidad': v.cantidad || 1,
                    'Precio Unitario': v.precio_venta ? parseFloat(v.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
                    'Total': v.precio_venta ? parseFloat(v.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
                    'Método de Pago': v.metodo_pago || '',
                    'Empleado': v.empleados?.nombre || v.empleados?.codigo || '',
                    'Fecha': v.created_at ? new Date(v.created_at).toLocaleString('es-CO') : ''
                }));
                filename = 'ventas.xlsx';
                break;
            case 'movimientos':
                // Cargar movimientos sin relaciones automáticas
                const { data: movimientosSimples, error: errorMovimientos } = await window.supabaseClient
                    .from('movimientos')
                    .select('tipo_origen, origen_id, tipo_destino, destino_id, cantidad, created_at, juguete_codigo')
                    .eq('empresa_id', user.empresa_id);
                
                if (errorMovimientos) throw errorMovimientos;
                
                // Cargar juguetes por separado
                let movimientos = [];
                if (movimientosSimples && movimientosSimples.length > 0) {
                    const jugueteCodigos = [...new Set(movimientosSimples.map(m => m.juguete_codigo).filter(c => c))];
                    
                    const { data: juguetesData } = await jugueteCodigos.length > 0 
                        ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id)
                        : { data: [] };

                    const juguetesMap = new Map((juguetesData || []).map(j => [j.codigo, j]));

                    movimientos = movimientosSimples.map(m => ({
                        ...m,
                        juguetes: juguetesMap.get(m.juguete_codigo) || null
                    }));
                }
                
                // Formatear datos para Excel
                data = (movimientos || []).map(m => ({
                    'Juguete': m.juguetes?.nombre || '',
                    'Código Juguete': m.juguetes?.codigo || '',
                    'Tipo Origen': m.tipo_origen === 'bodega' ? 'Bodega' : 'Tienda',
                    'ID Origen': m.origen_id || '',
                    'Tipo Destino': m.tipo_destino === 'bodega' ? 'Bodega' : 'Tienda',
                    'ID Destino': m.destino_id || '',
                    'Cantidad': m.cantidad || 0,
                    'Fecha': m.created_at ? new Date(m.created_at).toLocaleString('es-CO') : ''
                }));
                filename = 'movimientos.xlsx';
                break;
            default:
                alert('Tipo de exportación no válido');
                return;
        }

        // Verificar que hay datos para exportar
        if (!data || data.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        // Verificar que XLSX está disponible
        if (typeof XLSX === 'undefined') {
            alert('La librería de Excel no está cargada. Por favor, recarga la página.');
            console.error('XLSX no está definido');
            return;
        }

        try {
            // Crear hoja de cálculo
            const ws = XLSX.utils.json_to_sheet(data);
            
            // Ajustar ancho de columnas
            const colWidths = Object.keys(data[0]).map(key => ({
                wch: Math.max(key.length, 15)
            }));
            ws['!cols'] = colWidths;
            
            // Crear libro de trabajo
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Datos');
            
            // Exportar archivo
            XLSX.writeFile(wb, filename);
            
            alert(`Archivo "${filename}" exportado correctamente con ${data.length} registros`);
        } catch (excelError) {
            console.error('Error al crear archivo Excel:', excelError);
            alert('Error al crear el archivo Excel: ' + excelError.message);
        }
    } catch (error) {
        console.error('Error al exportar:', error);
        alert('Error al exportar los datos: ' + error.message);
    }
}

// Inicializar cuando el DOM esté listo.
// Sin usuario en la pestaña no se inicializa nada: dashboard.js redirige al login o, con Supabase Auth,
// reconstruye el usuario desde la sesión y recarga la página.
function inicializarModulosDashboard() {
    if (!sessionStorage.getItem('user')) return;
    initRegistrarVenta();
    initFacturar();
    loadTiendasForEmpleados();
    // Asegurar que los formularios de usuarios y tiendas tengan listeners
    setupUsuarioForm();
    setupTiendaForm();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarModulosDashboard);
} else {
    inicializarModulosDashboard();
}

// Función para configurar formulario de usuarios
function setupUsuarioForm() {
const nuevoUsuarioForm = document.getElementById('nuevoUsuarioForm');
    if (nuevoUsuarioForm && !nuevoUsuarioForm.hasAttribute('data-listener-added')) {
        nuevoUsuarioForm.setAttribute('data-listener-added', 'true');
    window.preventFormDoubleSubmit(nuevoUsuarioForm, async function(e) { // Protegido contra doble envío
        e.preventDefault();
        
            const nombre = capitalizarPrimeraLetra(document.getElementById('usuarioNombre').value.trim());
        const email = document.getElementById('usuarioEmail').value.trim();
        const password = document.getElementById('usuarioPassword').value;
        const tipoUsuarioId = parseInt(document.getElementById('usuarioTipo').value);
        
        if (!nombre || !email || !password || !tipoUsuarioId) {
            showUsuarioMessage('Por favor, completa todos los campos', 'error');
            return;
        }
            
            // Supabase Auth exige al menos 6 caracteres; el modo anterior aceptaba 3
            const usarAuth = window.APP_CONFIG?.USAR_SUPABASE_AUTH === true && window.servicioUsuariosRpc;
            const minimo = usarAuth ? ServicioUsuariosRpc.LONGITUD_MINIMA_PASSWORD : 3;
            if (password.length < minimo) {
                showUsuarioMessage(`La contraseña debe tener al menos ${minimo} caracteres`, 'error');
                return;
            }

        try {
            if (usarAuth) {
                await window.servicioUsuariosRpc.crear({ nombre, email, password, tipoUsuarioId });
                showUsuarioMessage('Usuario agregado correctamente', 'success');
                nuevoUsuarioForm.reset();
                if (typeof loadUsuarios === 'function') loadUsuarios();
                return;
            }

            const user = JSON.parse(sessionStorage.getItem('user'));
            const { error } = await window.supabaseClient
                .from('usuarios')
                .insert({
                    nombre: nombre,
                    email: email,
                    password: password,
                    tipo_usuario_id: tipoUsuarioId,
                    empresa_id: user.empresa_id
                });

            if (error) throw error;

            showUsuarioMessage('Usuario agregado correctamente', 'success');
            nuevoUsuarioForm.reset();
                if (typeof loadUsuarios === 'function') {
            loadUsuarios();
                }
        } catch (error) {
            console.error('Error al agregar usuario:', error);
            
            // Manejar error de email duplicado (409 Conflict o código PostgreSQL 23505)
            if (error.status === 409 || error.code === '23505' || 
                (error.message && (error.message.includes('duplicate key') || 
                                   error.message.includes('email') || 
                                   error.message.includes('unique constraint')))) {
                showUsuarioMessage('El email ingresado ya está registrado. Por favor, use otro email.', 'error');
            } else {
                showUsuarioMessage('Error al agregar el usuario: ' + (error.message || 'Error desconocido'), 'error');
            }
        }
    });
    }
}

// Función para configurar formulario de tiendas
function setupTiendaForm() {
    const nuevaTiendaForm = document.getElementById('nuevaTiendaForm');
    if (nuevaTiendaForm && !nuevaTiendaForm.hasAttribute('data-listener-added')) {
        nuevaTiendaForm.setAttribute('data-listener-added', 'true');
        window.preventFormDoubleSubmit(nuevaTiendaForm, async function(e) { // Protegido contra doble envío
            e.preventDefault();
            
            const nombre = document.getElementById('tiendaNombre').value.trim();
            const direccion = document.getElementById('tiendaDireccion').value.trim();
            
            if (!nombre || !direccion) {
                showTiendaMessage('Por favor, completa todos los campos', 'error');
                return;
            }

            try {
                const user = JSON.parse(sessionStorage.getItem('user'));
                const { error } = await window.supabaseClient
                    .from('tiendas')
                    .insert({
                        nombre: nombre,
                        direccion: direccion,
                        empresa_id: user.empresa_id
                    });

                if (error) throw error;

                showTiendaMessage('Tienda agregada correctamente', 'success');
                nuevaTiendaForm.reset();
                if (typeof loadTiendas === 'function') {
                    loadTiendas();
                }
            } catch (error) {
                console.error('Error al agregar tienda:', error);
                showTiendaMessage('Error al agregar la tienda: ' + error.message, 'error');
            }
        });
    }
}

// Abrir modal para editar usuario
async function openEditUsuarioModal(usuarioId) {
    try {
        const { data: usuario, error } = await window.supabaseClient
            .from('usuarios')
            .select('id, nombre, email, tipo_usuario_id, activo')
            .eq('id', usuarioId)
            .single();

        if (error) throw error;

        document.getElementById('editUsuarioNombre').value = capitalizarPrimeraLetra(usuario.nombre);
        document.getElementById('editUsuarioEmail').value = usuario.email || '';
        document.getElementById('editUsuarioTipo').value = usuario.tipo_usuario_id;
        window.currentUsuarioId = usuarioId;
        
        const modal = document.getElementById('editUsuarioModal');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error al cargar usuario:', error);
        alert('Error al cargar los datos del usuario');
    }
}

// Formulario para editar usuario
const editUsuarioForm = document.getElementById('editUsuarioForm');
if (editUsuarioForm) {
    window.preventFormDoubleSubmit(editUsuarioForm, async function(e) { // Protegido contra doble envío
        e.preventDefault();
        
        const nombre = capitalizarPrimeraLetra(document.getElementById('editUsuarioNombre').value.trim());
        const email = document.getElementById('editUsuarioEmail').value.trim();
        const password = document.getElementById('editUsuarioPassword').value;
        const tipoUsuarioId = parseInt(document.getElementById('editUsuarioTipo').value);
        
        if (!nombre || !email || !tipoUsuarioId) {
            showEditUsuarioMessage('Por favor, completa todos los campos obligatorios', 'error');
            return;
        }

        try {
            if (window.APP_CONFIG?.USAR_SUPABASE_AUTH === true && window.servicioUsuariosRpc) {
                if (password && password.length < ServicioUsuariosRpc.LONGITUD_MINIMA_PASSWORD) {
                    showEditUsuarioMessage(`La contraseña debe tener al menos ${ServicioUsuariosRpc.LONGITUD_MINIMA_PASSWORD} caracteres`, 'error');
                    return;
                }
                await window.servicioUsuariosRpc.actualizar(window.currentUsuarioId, { nombre, email, tipoUsuarioId, password });
                showEditUsuarioMessage('Usuario actualizado correctamente', 'success');
                setTimeout(() => {
                    closeEditUsuarioModal();
                    loadUsuarios();
                }, 1500);
                return;
            }

            const updateData = {
                nombre: nombre,
                email: email,
                tipo_usuario_id: tipoUsuarioId
            };
            
            if (password && password.length > 0) {
                updateData.password = password;
            }

            const { error } = await window.supabaseClient
                .from('usuarios')
                .update(updateData)
                .eq('id', window.currentUsuarioId);

            if (error) throw error;

            showEditUsuarioMessage('Usuario actualizado correctamente', 'success');
            setTimeout(() => {
                closeEditUsuarioModal();
                loadUsuarios();
            }, 1500);
        } catch (error) {
            console.error('Error al actualizar usuario:', error);
            showEditUsuarioMessage('Error al actualizar el usuario: ' + error.message, 'error');
        }
    });
}

function showEditUsuarioMessage(message, type) {
    const errorMsg = document.getElementById('editUsuarioErrorMessage');
    const successMsg = document.getElementById('editUsuarioSuccessMessage');
    
    if (!errorMsg || !successMsg) return;
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
}

function closeEditUsuarioModal() {
    const modal = document.getElementById('editUsuarioModal');
    if (modal) {
        modal.style.display = 'none';
        editUsuarioForm.reset();
        const errorMsg = document.getElementById('editUsuarioErrorMessage');
        const successMsg = document.getElementById('editUsuarioSuccessMessage');
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
        window.currentUsuarioId = null;
    }
}

const closeEditUsuarioModalBtn = document.getElementById('closeEditUsuarioModal');
const cancelEditUsuarioBtn = document.getElementById('cancelEditUsuarioBtn');
if (closeEditUsuarioModalBtn) {
    closeEditUsuarioModalBtn.addEventListener('click', closeEditUsuarioModal);
}
if (cancelEditUsuarioBtn) {
    cancelEditUsuarioBtn.addEventListener('click', closeEditUsuarioModal);
}
const editUsuarioModal = document.getElementById('editUsuarioModal');
if (editUsuarioModal) {
    editUsuarioModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditUsuarioModal();
        }
    });
}

// Eliminar usuario
async function deleteUsuario(usuarioId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        if (window.APP_CONFIG?.USAR_SUPABASE_AUTH === true && window.servicioUsuariosRpc) {
            // Elimina el usuario y su cuenta de Supabase Auth
            await window.servicioUsuariosRpc.eliminar(usuarioId);
        } else {
            const { error } = await window.supabaseClient
                .from('usuarios')
                .delete()
                .eq('id', usuarioId);

            if (error) throw error;
        }

        alert('Usuario eliminado correctamente');
        loadUsuarios();
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        alert('Error al eliminar el usuario: ' + error.message);
    }
}

// ============================================
// TIENDAS - CRUD COMPLETO CON EMPLEADOS Y JUGUETES
// ============================================

// Toggle del acordeón "Agregar Tienda" - Se inicializa cuando se muestra la vista
function initAgregarTiendaAccordion() {
    const agregarTiendaHeader = document.getElementById('agregarTiendaHeader');
    const agregarTiendaContent = document.getElementById('agregarTiendaContent');

    if (agregarTiendaHeader && agregarTiendaContent && !agregarTiendaHeader.hasAttribute('data-listener-added')) {
        agregarTiendaHeader.setAttribute('data-listener-added', 'true');
        agregarTiendaHeader.addEventListener('click', function() {
            agregarTiendaContent.classList.toggle('active');
            const icon = agregarTiendaHeader.querySelector('.accordion-icon');
            if (icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    }
}

// Toggle del acordeón "Agregar Usuario"
const agregarUsuarioHeader = document.getElementById('agregarUsuarioHeader');
const agregarUsuarioContent = document.getElementById('agregarUsuarioContent');

if (agregarUsuarioHeader && agregarUsuarioContent) {
    agregarUsuarioHeader.addEventListener('click', function() {
        agregarUsuarioContent.classList.toggle('active');
        const icon = agregarUsuarioHeader.querySelector('.accordion-icon');
        if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        }
    });
}

// Formulario para agregar tienda (se configura en setupTiendaForm)

function showUsuarioMessage(message, type) {
    const errorMsg = document.getElementById('usuarioErrorMessage');
    const successMsg = document.getElementById('usuarioSuccessMessage');
    
    if (!errorMsg || !successMsg) return;
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
    
    programarOcultarMensajes(errorMsg, successMsg); // reinicia el temporizador si ya había un mensaje
}

function showTiendaMessage(message, type) {
    const errorMsg = document.getElementById('tiendaErrorMessage');
    const successMsg = document.getElementById('tiendaSuccessMessage');
    
    if (!errorMsg || !successMsg) return;
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
    
    programarOcultarMensajes(errorMsg, successMsg); // reinicia el temporizador si ya había un mensaje
}

// Manejar clicks en el menú de tiendas
document.addEventListener('click', function(e) {
    // Manejar toggle del menú
    if (e.target.closest('.menu-toggle[data-tienda-id]')) {
        e.preventDefault();
        e.stopPropagation();
        const menuToggle = e.target.closest('.menu-toggle');
        const tiendaId = menuToggle.getAttribute('data-tienda-id');
        const menu = document.getElementById(`menu-tienda-${tiendaId}`);
        
        if (!menu) return;
        
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            if (m.id !== `menu-tienda-${tiendaId}`) {
                m.style.display = 'none';
            }
        });
        
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        return;
    }
    
    // Manejar clicks en los botones del menú (Actualizar/Eliminar)
    const dropdownItem = e.target.closest('.dropdown-item[data-tienda-id]');
    if (dropdownItem) {
        e.preventDefault();
        e.stopPropagation();
        const action = dropdownItem.getAttribute('data-action');
        const tiendaId = dropdownItem.getAttribute('data-tienda-id');
        
        if (!tiendaId || !action) return;
        
        // Cerrar todos los menús
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.style.display = 'none';
        });
        
        if (action === 'edit') {
            openEditTiendaModal(tiendaId);
        } else if (action === 'delete') {
            deleteTienda(tiendaId);
        }
        return;
    }
    
    // Cerrar menús al hacer click fuera
    if (!e.target.closest('.bodega-actions')) {
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.style.display = 'none';
        });
    }
});

// Abrir modal para editar tienda
async function openEditTiendaModal(tiendaId) {
    // Validar que tiendaId existe y es válido
    if (!tiendaId || tiendaId === 'null' || tiendaId === 'undefined') {
        console.error('Error: tiendaId inválido:', tiendaId);
        alert('Error: No se pudo identificar la tienda a editar');
        return;
    }
    
    try {
        const tiendaIdNum = parseInt(tiendaId, 10);
        if (isNaN(tiendaIdNum)) {
            throw new Error('ID de tienda inválido');
        }
        
        const { data: tienda, error } = await window.supabaseClient
            .from('tiendas')
            .select('*')
            .eq('id', tiendaIdNum)
            .single();

        if (error) throw error;

        document.getElementById('editTiendaNombre').value = tienda.nombre;
        document.getElementById('editTiendaDireccion').value = tienda.direccion || tienda.ubicacion || '';
        window.currentTiendaId = tiendaId;
        
        const modal = document.getElementById('editTiendaModal');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error al cargar tienda:', error);
        alert('Error al cargar los datos de la tienda');
    }
}

// Formulario para editar tienda
const editTiendaForm = document.getElementById('editTiendaForm');
if (editTiendaForm) {
    window.preventFormDoubleSubmit(editTiendaForm, async function(e) { // Protegido contra doble envío
        e.preventDefault();
        
        const nombre = document.getElementById('editTiendaNombre').value.trim();
        const direccion = document.getElementById('editTiendaDireccion').value.trim();
        
        if (!nombre || !direccion) {
            showEditTiendaMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('tiendas')
                .update({
                    nombre: nombre,
                    direccion: direccion
                })
                .eq('id', window.currentTiendaId);

            if (error) throw error;

            showEditTiendaMessage('Tienda actualizada correctamente', 'success');
            setTimeout(() => {
                closeEditTiendaModal();
                loadTiendas();
            }, 1500);
        } catch (error) {
            console.error('Error al actualizar tienda:', error);
            showEditTiendaMessage('Error al actualizar la tienda: ' + error.message, 'error');
        }
    });
}

function showEditTiendaMessage(message, type) {
    const errorMsg = document.getElementById('editTiendaErrorMessage');
    const successMsg = document.getElementById('editTiendaSuccessMessage');
    
    if (!errorMsg || !successMsg) return;
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
}

function closeEditTiendaModal() {
    const modal = document.getElementById('editTiendaModal');
    if (modal) {
        modal.style.display = 'none';
        editTiendaForm.reset();
        const errorMsg = document.getElementById('editTiendaErrorMessage');
        const successMsg = document.getElementById('editTiendaSuccessMessage');
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
        window.currentTiendaId = null;
    }
}

const closeEditTiendaModalBtn = document.getElementById('closeEditTiendaModal');
const cancelEditTiendaBtn = document.getElementById('cancelEditTiendaBtn');
if (closeEditTiendaModalBtn) {
    closeEditTiendaModalBtn.addEventListener('click', closeEditTiendaModal);
}
if (cancelEditTiendaBtn) {
    cancelEditTiendaBtn.addEventListener('click', closeEditTiendaModal);
}
const editTiendaModal = document.getElementById('editTiendaModal');
if (editTiendaModal) {
    editTiendaModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditTiendaModal();
        }
    });
}

// Eliminar tienda (solo administradores): modal que exige escribir el nombre y elegir la bodega
// que recibe el inventario y los empleados. La RPC eliminar_tienda lo hace todo en una transacción.
let eliminarTiendaEstado = null;

function escaparHtmlTienda(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mostrarMensajeEliminarTienda(mensaje, tipo) {
    const errorMsg = document.getElementById('eliminarTiendaErrorMessage');
    const successMsg = document.getElementById('eliminarTiendaSuccessMessage');
    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
    if (!mensaje) return;
    const destino = tipo === 'error' ? errorMsg : successMsg;
    if (destino) {
        destino.textContent = mensaje;
        destino.style.display = 'flex';
    }
}

/** Habilita el botón solo con el nombre correcto y una bodega válida. */
function actualizarBotonEliminarTienda() {
    const boton = document.getElementById('confirmarEliminarTiendaBtn');
    if (!boton || !eliminarTiendaEstado) return;
    const escrito = document.getElementById('eliminarTiendaConfirmacion').value;
    const seleccion = document.getElementById('eliminarTiendaBodegaSelect').value;
    const { bodega } = ReglasEliminarTienda.elegirBodegaDestino(eliminarTiendaEstado.bodegas, seleccion);
    boton.disabled = eliminarTiendaEstado.enCurso ||
        !bodega || !ReglasEliminarTienda.nombreConfirmado(escrito, eliminarTiendaEstado.tienda.nombre);
}

/** Muestra qué se sumará y qué se moverá en la bodega elegida. */
async function actualizarTrasladoEliminarTienda() {
    const traslado = document.getElementById('eliminarTiendaTraslado');
    const estado = eliminarTiendaEstado;
    if (!traslado || !estado) return;
    const seleccion = document.getElementById('eliminarTiendaBodegaSelect').value;
    const { bodega } = ReglasEliminarTienda.elegirBodegaDestino(estado.bodegas, seleccion);
    if (!bodega || estado.juguetes.length === 0) {
        traslado.textContent = '';
        return;
    }
    try {
        const filasBodega = await window.servicioUbicaciones.codigosDeBodega(bodega.id);
        if (eliminarTiendaEstado !== estado) return; // el modal se cerró o cambió de tienda
        const r = ReglasEliminarTienda.resumirTraslado(estado.juguetes, filasBodega);
        traslado.textContent = `En la bodega ${bodega.nombre}: ${r.fusionados} producto(s) se sumarán a los que ya tiene ` +
            `y ${r.movidos} producto(s) se moverán.`;
    } catch (error) {
        console.error('Error al consultar la bodega:', error);
        traslado.textContent = '';
    }
}

async function deleteTienda(tiendaId) {
    if (!tiendaId || tiendaId === 'null' || tiendaId === 'undefined') {
        console.error('Error: tiendaId inválido:', tiendaId);
        alert('Error: No se pudo identificar la tienda a eliminar');
        return;
    }
    if (!window.servicioUbicaciones) {
        alert('No se pudo iniciar el servicio de ubicaciones. Recarga la página.');
        return;
    }

    let datos;
    try {
        datos = await window.servicioUbicaciones.datosParaEliminar(tiendaId);
    } catch (error) {
        console.error('Error al preparar la eliminación de la tienda:', error);
        alert('No se pudo cargar la información de la tienda: ' + (error.message || error));
        return;
    }

    eliminarTiendaEstado = { ...datos, enCurso: false };
    const { tienda, juguetes, bodegas, empleados } = datos;
    const unidades = juguetes.reduce((suma, j) => suma + (Number(j.cantidad) || 0), 0);

    document.getElementById('eliminarTiendaNombre').textContent = tienda.nombre;
    document.getElementById('eliminarTiendaNombreConfirmar').textContent = tienda.nombre;
    document.getElementById('eliminarTiendaResumen').innerHTML = [
        `<li>Inventario: ${juguetes.length} producto(s), ${unidades} unidad(es)</li>`,
        `<li>Empleados asignados: ${empleados} (pasarán a vender desde la bodega)</li>`,
        '<li>Los planes de movimiento pendientes con esta tienda se cancelarán</li>'
    ].join('');

    const grupo = document.getElementById('eliminarTiendaBodegaGrupo');
    const select = document.getElementById('eliminarTiendaBodegaSelect');
    const auto = document.getElementById('eliminarTiendaBodegaAuto');
    const eleccion = ReglasEliminarTienda.elegirBodegaDestino(bodegas, null);
    if (eleccion.automatica) {
        select.innerHTML = `<option value="${eleccion.bodega.id}">${escaparHtmlTienda(eleccion.bodega.nombre)}</option>`;
        select.value = String(eleccion.bodega.id);
        grupo.style.display = 'none';
        auto.innerHTML = `<i class="fas fa-warehouse"></i> Solo hay una bodega: todo pasará a <strong>${escaparHtmlTienda(eleccion.bodega.nombre)}</strong>.`;
        auto.style.display = 'block';
    } else {
        select.innerHTML = '<option value="">Selecciona una bodega...</option>' +
            bodegas.map(b => `<option value="${b.id}">${escaparHtmlTienda(b.nombre)}</option>`).join('');
        select.value = '';
        grupo.style.display = bodegas.length ? 'block' : 'none';
        auto.style.display = 'none';
    }

    document.getElementById('eliminarTiendaConfirmacion').value = '';
    document.getElementById('eliminarTiendaTraslado').textContent = '';
    mostrarMensajeEliminarTienda(eleccion.error && bodegas.length === 0 ? eleccion.error : '', 'error');
    actualizarBotonEliminarTienda();
    actualizarTrasladoEliminarTienda();

    document.getElementById('eliminarTiendaModal').style.display = 'flex';
    setTimeout(() => document.getElementById('eliminarTiendaConfirmacion')?.focus(), 50);
}

function closeEliminarTiendaModal() {
    const modal = document.getElementById('eliminarTiendaModal');
    if (eliminarTiendaEstado?.enCurso) return; // no cerrar mientras se elimina
    if (modal) modal.style.display = 'none';
    eliminarTiendaEstado = null;
    mostrarMensajeEliminarTienda('', 'error');
}

(function configurarModalEliminarTienda() {
    const modal = document.getElementById('eliminarTiendaModal');
    const form = document.getElementById('eliminarTiendaForm');
    if (!modal || !form) return;

    document.getElementById('closeEliminarTiendaModal')?.addEventListener('click', closeEliminarTiendaModal);
    document.getElementById('cancelEliminarTiendaBtn')?.addEventListener('click', closeEliminarTiendaModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeEliminarTiendaModal(); });
    document.getElementById('eliminarTiendaConfirmacion').addEventListener('input', actualizarBotonEliminarTienda);
    document.getElementById('eliminarTiendaBodegaSelect').addEventListener('change', () => {
        mostrarMensajeEliminarTienda('', 'error');
        actualizarBotonEliminarTienda();
        actualizarTrasladoEliminarTienda();
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const estado = eliminarTiendaEstado;
        if (!estado || estado.enCurso) return;
        const escrito = document.getElementById('eliminarTiendaConfirmacion').value;
        const seleccion = document.getElementById('eliminarTiendaBodegaSelect').value;
        if (!ReglasEliminarTienda.nombreConfirmado(escrito, estado.tienda.nombre)) {
            mostrarMensajeEliminarTienda(`Escribe el nombre exacto de la tienda: "${estado.tienda.nombre}"`, 'error');
            return;
        }
        const { bodega, automatica, error } = ReglasEliminarTienda.elegirBodegaDestino(estado.bodegas, seleccion);
        if (!bodega) {
            mostrarMensajeEliminarTienda(error, 'error');
            return;
        }

        const boton = document.getElementById('confirmarEliminarTiendaBtn');
        const textoOriginal = boton.innerHTML;
        estado.enCurso = true;
        boton.disabled = true;
        boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
        try {
            const resultado = await window.servicioUbicaciones.eliminarTienda(
                estado.tienda.id, automatica ? null : bodega.id, escrito.trim());
            estado.enCurso = false;
            closeEliminarTiendaModal();
            alert(ReglasEliminarTienda.mensajeResultado(resultado));
            loadTiendas();
        } catch (err) {
            (err.code === 'MIGRACION_PENDIENTE' ? console.warn : console.error)('Error al eliminar tienda:', err.message);
            estado.enCurso = false;
            mostrarMensajeEliminarTienda(err.code === 'MIGRACION_PENDIENTE' ? err.message : 'No se pudo eliminar la tienda: ' + err.message, 'error');
        } finally {
            boton.innerHTML = textoOriginal;
            actualizarBotonEliminarTienda();
        }
    });
})();

// ============================================
// CORRECCIÓN DE ABASTECER
// ============================================

// Variable global para almacenar el último movimiento realizado (para deshacer)
let ultimoMovimientoAbastecer = null;

// Actualizar función initAbastecer para usar inputs de cantidad
function initAbastecer() {
    const origenTipo = document.getElementById('origenTipo');
    const origenSelect = document.getElementById('origenSelect');
    const destinoTipo = document.getElementById('destinoTipo');
    const destinoSelect = document.getElementById('destinoSelect');
    const form = document.getElementById('abastecerForm');

    if (!origenTipo || !origenSelect || !destinoTipo || !destinoSelect || !form) return;

    // Cargar opciones según tipo seleccionado
    origenTipo.addEventListener('change', async function() {
        await loadUbicacionesPorTipo(this.value, origenSelect);
        if (this.value && destinoTipo.value) {
            await loadJuguetesDisponibles();
        }
    });

    destinoTipo.addEventListener('change', async function() {
        await loadUbicacionesPorTipo(this.value, destinoSelect);
        if (origenTipo.value && this.value) {
            await loadJuguetesDisponibles();
        }
    });

    origenSelect.addEventListener('change', loadJuguetesDisponibles);
    destinoSelect.addEventListener('change', loadJuguetesDisponibles);

    // Bandera para evitar limpiar el último movimiento cuando se restauran valores después de un movimiento exitoso
    let restaurandoValoresDespuesMovimiento = false;
    
    // Limpiar último movimiento cuando se cambian los campos del formulario
    const limpiarUltimoMovimiento = () => {
        // No limpiar si estamos restaurando valores después de un movimiento exitoso
        if (restaurandoValoresDespuesMovimiento) {
            return;
        }
        ultimoMovimientoAbastecer = null;
        actualizarBotonDeshacerAbastecer(false);
    };
    
    origenTipo.addEventListener('change', limpiarUltimoMovimiento);
    origenSelect.addEventListener('change', limpiarUltimoMovimiento);
    destinoTipo.addEventListener('change', limpiarUltimoMovimiento);
    destinoSelect.addEventListener('change', limpiarUltimoMovimiento);

    // Realizar movimiento - con protección contra clics múltiples
    preventFormDoubleSubmit(form, async function(e) {
        const origenTipoVal = origenTipo.value;
        const origenId = parseInt(origenSelect.value);
        const destinoTipoVal = destinoTipo.value;
        const destinoId = parseInt(destinoSelect.value);
        
        if (!origenTipoVal || !origenId || !destinoTipoVal || !destinoId) {
            showAbastecerMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        if (origenTipoVal === destinoTipoVal && origenId === destinoId) {
            showAbastecerMessage('El origen y el destino no pueden ser la misma ubicación', 'error');
            return;
        }

        // Obtener juguetes seleccionados desde la tabla de movimiento
        const juguetesSeleccionados = (itemsMovimientoAbastecer || [])
            .map(it => ({
                id: it.juguete_id,
                cantidad: it.cantidad || 0
            }))
            .filter(j => j.id && j.cantidad > 0);

        if (juguetesSeleccionados.length === 0) {
            showAbastecerMessage('Debes seleccionar al menos un juguete con cantidad mayor a 0', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Guardar información del movimiento para poder deshacerlo
            const movimientosDetalle = [];
            const errores = [];

            const usarRpc = window.usarStockRpc && window.usarStockRpc();
            if (usarRpc) {
                // Todo o nada en una transacción: stock origen/destino + registros de movimientos
                const resultado = await window.servicioStockRpc.transferir(
                    juguetesSeleccionados.map(j => ({ juguete_id: j.id, cantidad: j.cantidad })),
                    destinoTipoVal,
                    destinoId
                );
                (resultado.movimientos || []).forEach(m => movimientosDetalle.push({ ...m, via_rpc: true }));
            }
            
            // Modo anterior: un juguete a la vez
            for (const juguete of usarRpc ? [] : juguetesSeleccionados) {
                try {
                    // Mover unidades actualizando los registros en su lugar (sin borrar/recrear el origen)
                    const detalle = await window.servicioStock.transferir({
                        jugueteOrigenId: juguete.id,
                        cantidad: juguete.cantidad,
                        destinoTipo: destinoTipoVal,
                        destinoId: destinoId,
                        empresaId: user.empresa_id
                    });

                    // Registrar movimiento (auditoría)
                    const { data: movimientoInsertado, error: errorMovimiento } = await window.supabaseClient
                        .from('movimientos')
                        .insert({
                            tipo_origen: origenTipoVal,
                            origen_id: origenId,
                            tipo_destino: destinoTipoVal,
                            destino_id: destinoId,
                            juguete_codigo: detalle.origen.codigo,
                            cantidad: juguete.cantidad,
                            empresa_id: user.empresa_id
                        })
                        .select()
                        .single();
                    if (errorMovimiento) console.error('No se pudo registrar el movimiento de auditoría:', errorMovimiento);

                    movimientosDetalle.push({
                        ...detalle,
                        juguete_nombre: detalle.origen.nombre,
                        movimiento_id: movimientoInsertado ? movimientoInsertado.id : null
                    });
                } catch (errorItem) {
                    console.error('Error al mover juguete:', errorItem);
                    errores.push(errorItem.message);
                }
            }
            
            // Guardar el último movimiento para poder deshacerlo
            if (movimientosDetalle.length > 0) {
                ultimoMovimientoAbastecer = {
                    origen_tipo: origenTipoVal,
                    origen_id: origenId,
                    destino_tipo: destinoTipoVal,
                    destino_id: destinoId,
                    movimientos: movimientosDetalle,
                    timestamp: new Date().toISOString()
                };
                
                // Mostrar botón deshacer
                actualizarBotonDeshacerAbastecer(true);
            }

            if (errores.length > 0) {
                showAbastecerMessage(`Se movieron ${movimientosDetalle.length} de ${juguetesSeleccionados.length} juguete(s). Errores: ${errores.join(' | ')}`, 'error');
            } else {
                showAbastecerMessage('Movimiento realizado correctamente', 'success');
            }
            
            // Guardar valores de origen y destino antes de resetear
            const origenTipoValGuardado = origenTipo.value;
            const origenIdGuardado = origenSelect.value;
            const destinoTipoValGuardado = destinoTipo.value;
            const destinoIdGuardado = destinoSelect.value;
            
            // Limpiar tabla de juguetes a mover
            itemsMovimientoAbastecer = [];
            renderMovimientoAbastecerTabla();
            
            // Limpiar lista de juguetes disponibles
            document.getElementById('juguetesDisponiblesList').innerHTML = '';
            
            // Resetear formulario
            form.reset();
            
            // Activar bandera para evitar que se limpie el último movimiento al restaurar valores
            restaurandoValoresDespuesMovimiento = true;
            
            // Restaurar valores de origen y destino
            origenTipo.value = origenTipoValGuardado;
            origenSelect.value = origenIdGuardado;
            destinoTipo.value = destinoTipoValGuardado;
            destinoSelect.value = destinoIdGuardado;
            
            // Desactivar bandera después de restaurar valores
            restaurandoValoresDespuesMovimiento = false;
            
            // Recargar datos para reflejar los cambios en el inventario
            if (typeof loadTiendas === 'function') {
                await loadTiendas();
            }
            if (typeof loadBodegas === 'function') {
                await loadBodegas();
            }
            if (typeof loadInventario === 'function') {
                await loadInventario();
            }
            if (typeof loadDashboardSummary === 'function') {
                await loadDashboardSummary();
            }
            // Recargar juguetes disponibles para actualizar las cantidades
            await loadJuguetesDisponibles();
        } catch (error) {
            console.error('Error al realizar movimiento:', error);
            showAbastecerMessage('Error al realizar el movimiento: ' + error.message, 'error');
            // Limpiar último movimiento si hubo error
            ultimoMovimientoAbastecer = null;
            actualizarBotonDeshacerAbastecer(false);
        }
    });
    
    // Inicializar botón deshacer
    inicializarBotonDeshacerAbastecer();
}

// Función para actualizar la visibilidad del botón deshacer
function actualizarBotonDeshacerAbastecer(mostrar) {
    const botonDeshacer = document.getElementById('deshacerMovimientoBtn');
    if (botonDeshacer) {
        botonDeshacer.style.display = mostrar ? 'inline-flex' : 'none';
    }
}

// Función para inicializar el botón deshacer
function inicializarBotonDeshacerAbastecer() {
    const botonDeshacer = document.getElementById('deshacerMovimientoBtn');
    if (botonDeshacer) {
        // Remover listeners anteriores si existen (clonar y reemplazar)
        const nuevoBtn = botonDeshacer.cloneNode(true);
        botonDeshacer.parentNode.replaceChild(nuevoBtn, botonDeshacer);
        
        // Agregar event listener
        nuevoBtn.addEventListener('click', async function() {
            // Protegido contra doble clic para no revertir dos veces
            await preventDoubleClick(nuevoBtn, deshacerUltimoMovimientoAbastecer, { loadingText: 'Deshaciendo...' }).catch(() => {});
        });
        // Ocultar inicialmente
        nuevoBtn.style.display = ultimoMovimientoAbastecer ? 'inline-flex' : 'none';
    }
}

// Función para deshacer el último movimiento
async function deshacerUltimoMovimientoAbastecer() {
    if (!ultimoMovimientoAbastecer) {
        showAbastecerMessage('No hay movimiento para deshacer', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que deseas deshacer el último movimiento? Esta acción revertirá todos los cambios realizados.')) {
        return;
    }
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));

        const movimientosRpc = ultimoMovimientoAbastecer.movimientos.filter(m => m.via_rpc);
        if (movimientosRpc.length > 0) {
            // Descuenta del destino, repone el origen y borra los movimientos en una sola transacción
            await window.servicioStockRpc.revertirTransferencia(movimientosRpc.map(m => m.movimiento_id));
            ultimoMovimientoAbastecer.movimientos = ultimoMovimientoAbastecer.movimientos.filter(m => !m.via_rpc);
        }
        
        // Revertir cada movimiento en orden inverso
        for (let i = ultimoMovimientoAbastecer.movimientos.length - 1; i >= 0; i--) {
            const movimiento = ultimoMovimientoAbastecer.movimientos[i];
            
            // 1. Revertir las cantidades (destino -> origen) sobre los registros actuales
            if (movimiento.jugueteOrigenId) {
                await window.servicioStock.revertirTransferencia(movimiento);
            } else {
                throw new Error('Este movimiento se hizo con una versión anterior y no se puede deshacer automáticamente.');
            }
            
            // 2. Eliminar registro de movimiento de auditoría
            if (movimiento.movimiento_id) {
                const { error: errorMov } = await window.supabaseClient
                    .from('movimientos')
                    .delete()
                    .eq('id', movimiento.movimiento_id);
                if (errorMov) console.error('No se pudo eliminar el registro de movimiento:', errorMov);
            }

            // Quitar de la lista lo ya revertido (por si falla uno intermedio)
            ultimoMovimientoAbastecer.movimientos.splice(i, 1);
        }
        
        // Limpiar último movimiento
        ultimoMovimientoAbastecer = null;
        actualizarBotonDeshacerAbastecer(false);
        
        showAbastecerMessage('Movimiento deshecho correctamente', 'success');
        
        // Recargar datos
        if (typeof loadTiendas === 'function') {
            await loadTiendas();
        }
        if (typeof loadBodegas === 'function') {
            await loadBodegas();
        }
        if (typeof loadInventario === 'function') {
            await loadInventario();
        }
        if (typeof loadDashboardSummary === 'function') {
            await loadDashboardSummary();
        }
    } catch (error) {
        console.error('Error al deshacer movimiento:', error);
        showAbastecerMessage('Error al deshacer el movimiento: ' + error.message, 'error');
    }
}

// ============================================
// ANÁLISIS - COMPLETAR FUNCIONES
// ============================================

async function aplicarFiltroVentas(filtro) {
    const resultsDiv = document.getElementById('analisisResults');
    if (!resultsDiv) return;
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        let query = window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('empresa_id', user.empresa_id);

        switch(filtro) {
            case 'dia':
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                query = query.gte('created_at', hoy.toISOString());
                break;
            case 'semana':
                const semana = new Date();
                semana.setDate(semana.getDate() - 7);
                query = query.gte('created_at', semana.toISOString());
                break;
        }

        const { data: ventasSimples, error } = await query.order('created_at', { ascending: false });
        
        // Cargar juguetes y empleados por separado
        let ventas = [];
        if (ventasSimples && ventasSimples.length > 0) {
            const jugueteCodigos = [...new Set(ventasSimples.map(v => v.juguete_codigo).filter(c => c))];
            const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
            
            const [juguetesData, empleadosData] = await Promise.all([
                jugueteCodigos.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id) : { data: [] },
                empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
            ]);

            const juguetesMap = new Map((juguetesData.data || []).map(j => [j.codigo, j]));
            const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

            ventas = ventasSimples.map(v => ({
                ...v,
                juguetes: juguetesMap.get(v.juguete_codigo) || null,
                empleados: empleadosMap.get(v.empleado_id) || null
            }));
        }

        if (error) throw error;

        if (!ventas || ventas.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas para mostrar</p>';
            return;
        }

        resultsDiv.innerHTML = `
            <h3>Resultados de Ventas (${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'})</h3>
            <div class="inventario-table-container">
            <table class="inventario-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Juguete</th>
                        <th>Empleado</th>
                        <th>Precio</th>
                        <th>Método</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    ${ventas.map(v => `
                        <tr>
                                <td>${v.codigo_venta || 'N/A'}</td>
                            <td>${v.juguetes?.nombre || 'N/A'}</td>
                            <td>${v.empleados?.nombre || 'N/A'}</td>
                                <td>$${parseFloat(v.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td>${v.metodo_pago || 'N/A'}</td>
                                <td>${new Date(v.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
    } catch (error) {
        console.error('Error al aplicar filtro:', error);
        resultsDiv.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar los datos</p>';
    }
}

async function aplicarFiltroGanancias(filtro) {
    const resultsDiv = document.getElementById('analisisResults');
    if (!resultsDiv) return;
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        let query = window.supabaseClient
            .from('ventas')
            .select('precio_venta, created_at, empleado_id')
            .eq('empresa_id', user.empresa_id);

        switch(filtro) {
            case 'dia':
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                query = query.gte('created_at', hoy.toISOString());
                break;
            case 'semana':
                const semana = new Date();
                semana.setDate(semana.getDate() - 7);
                query = query.gte('created_at', semana.toISOString());
                break;
        }

        const { data: ventas, error } = await query;

        if (error) throw error;

        if (!ventas || ventas.length === 0) {
        resultsDiv.innerHTML = `
                <div class="stat-card" style="max-width: 500px; margin: 0 auto; text-align: center;">
                <h3>Ganancias ${filtro === 'dia' ? 'del Día' : filtro === 'semana' ? 'de la Semana' : 'Totales'}</h3>
                    <p class="stat-number" style="color: #64748b;">$0.00</p>
                    <p style="color: #64748b; font-size: 14px; margin-top: 8px;">No hay ventas registradas</p>
                </div>
            `;
            return;
        }

        const total = ventas.reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
        const promedio = total / ventas.length;
        const tituloFiltro = filtro === 'dia' ? 'del Día' : filtro === 'semana' ? 'de la Semana' : 'Totales';

        resultsDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 24px;">
                <div class="stat-card" style="text-align: center;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #64748b;">Ganancias ${tituloFiltro}</h3>
                    <p class="stat-number" style="color: #059669; font-size: 32px;">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div class="stat-card" style="text-align: center;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #64748b;">Total Ventas</h3>
                    <p class="stat-number" style="color: #667eea; font-size: 32px;">${ventas.length}</p>
                </div>
                <div class="stat-card" style="text-align: center;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #64748b;">Promedio por Venta</h3>
                    <p class="stat-number" style="color: #764ba2; font-size: 32px;">$${promedio.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error al aplicar filtro de ganancias:', error);
        resultsDiv.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar los datos</p>';
    }
}

// Exportar funciones globales
window.loadDashboardSummary = loadDashboardSummary;
window.loadTiendas = loadTiendas;
window.loadUsuarios = loadUsuarios;
window.loadAnalisis = loadAnalisis;
window.initAbastecer = initAbastecer;
window.loadTiendasForEmpleados = loadTiendasForEmpleados;
window.aplicarFiltroVentas = aplicarFiltroVentas;
window.aplicarFiltroGanancias = aplicarFiltroGanancias;
window.initAgregarTiendaAccordion = initAgregarTiendaAccordion;
window.initAgregarTiendaAccordion = initAgregarTiendaAccordion;
window.setupUsuarioForm = setupUsuarioForm;
window.setupTiendaForm = setupTiendaForm;

// ============================================
// AJUSTES Y DEVOLUCIONES
// ============================================

let ajustesInitialized = false;

function initAjustes() {
    if (ajustesInitialized) return;
    ajustesInitialized = true;

    const buscarVentaBtn = document.getElementById('buscarVentaBtn');
    const buscarVentaCodigo = document.getElementById('buscarVentaCodigo');

    if (!buscarVentaBtn || !buscarVentaCodigo) return;

    // Buscar venta al hacer clic en el botón
    buscarVentaBtn.addEventListener('click', async function() {
        await buscarVentaParaDevolucion();
    });

    // Buscar venta al presionar Enter
    buscarVentaCodigo.addEventListener('keypress', async function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            await buscarVentaParaDevolucion();
        }
    });

    // Cargar ventas recientes en ajustes
    cargarVentasRecientesAjustes();
}

async function cargarVentasRecientesAjustes() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const isEmpleado = user && user.tipo_usuario_id === 3;
        
        // Cargar ventas recientes (sin relaciones automáticas, usar juguete_codigo)
        let ajustesVentasQuery = window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false })
            .limit(10);
        // Empleados solo ven ventas normales (no al por mayor)
        if (isEmpleado) {
            ajustesVentasQuery = ajustesVentasQuery.eq('es_por_mayor', false);
        }
        const { data: ventasSimples } = await ajustesVentasQuery;
        
        // Cargar juguetes por código
        let ventasRecientes = [];
        if (ventasSimples && ventasSimples.length > 0) {
            const jugueteCodigos = [...new Set(ventasSimples.map(v => v.juguete_codigo).filter(c => c))];
            const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
            
            const [juguetesData, empleadosData] = await Promise.all([
                jugueteCodigos.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id) : { data: [] },
                empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
            ]);

            const juguetesMap = new Map((juguetesData.data || []).map(j => [j.codigo, j]));
            const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

            ventasRecientes = ventasSimples.map(v => ({
                ...v,
                juguetes: juguetesMap.get(v.juguete_codigo) || null,
                empleados: empleadosMap.get(v.empleado_id) || null
            }));
        }

        const ventasList = document.getElementById('ajustesVentasRecientes');
        if (ventasList) {
            if (ventasRecientes && ventasRecientes.length > 0) {
                ventasList.innerHTML = ventasRecientes.map(v => `
                    <div class="venta-item">
                        <div class="venta-info">
                            <strong>${v.juguetes?.nombre || 'N/A'}</strong>
                            <span>${v.codigo_venta || 'Sin código'} - ${new Date(v.created_at).toLocaleString('es-CO')}</span>
                        </div>
                        <div class="venta-precio">$${parseFloat(v.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                `).join('');
            } else {
                ventasList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas recientes</p>';
            }
        }
    } catch (error) {
        console.error('Error al cargar ventas recientes en ajustes:', error);
        const ventasList = document.getElementById('ajustesVentasRecientes');
        if (ventasList) {
            ventasList.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar ventas</p>';
        }
    }
}

async function buscarVentaParaDevolucion() {
    const codigoVenta = document.getElementById('buscarVentaCodigo').value.trim();
    const ventasListContainer = document.getElementById('ventasListContainer');

    if (!codigoVenta) {
        showAjustesMessage('Por favor, ingresa un código de venta', 'error');
        return;
    }

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const isEmpleado = user && user.tipo_usuario_id === 3;
        
        // Buscar todas las ventas con ese código (sin relaciones automáticas a juguetes)
        let ventasDevolucionQuery = window.supabaseClient
            .from('ventas')
            .select('id, codigo_venta, juguete_codigo, cantidad, precio_venta, created_at, empleado_id, empleados(nombre, codigo)')
            .eq('codigo_venta', codigoVenta)
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false });
        // Empleados NO pueden ver ni devolver ventas al por mayor
        if (isEmpleado) {
            ventasDevolucionQuery = ventasDevolucionQuery.eq('es_por_mayor', false);
        }
        const { data: ventas, error } = await ventasDevolucionQuery;

        if (error) throw error;

        // Cargar información de los juguetes por separado usando juguete_codigo
        let juguetesMap = new Map();
        if (ventas && ventas.length > 0) {
            const codigosJuguetes = [...new Set(ventas.map(v => v.juguete_codigo).filter(c => c))];
            if (codigosJuguetes.length > 0) {
                const { data: juguetes, error: juguetesError } = await window.supabaseClient
                    .from('juguetes')
                    .select('codigo, nombre')
                    .in('codigo', codigosJuguetes)
                    .eq('empresa_id', user.empresa_id);
                
                if (juguetesError) throw juguetesError;
                juguetesMap = new Map((juguetes || []).map(j => [j.codigo, j]));
            }
        }

        if (!ventas || ventas.length === 0) {
            ventasListContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <p style="color: #ef4444; font-size: 18px; margin-bottom: 10px;">No se encontró ninguna venta con el código "${codigoVenta}"</p>
                    <p style="color: #64748b;">Verifica el código e intenta nuevamente.</p>
                </div>
            `;
            return;
        }

        // Agrupar ventas por código_venta (aunque deberían ser todas del mismo código)
        const total = ventas.reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
        const fecha = new Date(ventas[0].created_at).toLocaleString('es-CO');
        const empleado = ventas[0].empleados?.nombre || 'N/A';

        ventasListContainer.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h3 style="color: #8b5cf6; margin-bottom: 10px;">${codigoVenta}</h3>
                        <p style="color: #64748b; margin: 5px 0;"><strong>Fecha:</strong> ${fecha}</p>
                        <p style="color: #64748b; margin: 5px 0;"><strong>Empleado:</strong> ${empleado}</p>
                        <p style="color: #64748b; margin: 5px 0;"><strong>Total Venta:</strong> <span style="color: #10b981; font-weight: bold; font-size: 18px;">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                        <p style="color: #64748b; margin: 5px 0;" id="totalSeleccionadoDevolucion"><strong>Total Seleccionado:</strong> <span style="color: #ef4444; font-weight: bold;">$0.00</span> (0 items)</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button type="button" class="btn-primary" style="background: #f97316;" onclick="procesarDevolucionSelectiva('${codigoVenta}')" id="btnDevolverSeleccionados" disabled>
                            <i class="fas fa-check-square"></i> Devolver Seleccionados
                        </button>
                        <button type="button" class="btn-primary" style="background: #ef4444;" onclick="procesarDevolucion('${codigoVenta}', null)">
                            <i class="fas fa-undo"></i> Devolver Todo
                        </button>
                    </div>
                </div>
                <div>
                    <h4 style="color: #1e293b; margin-bottom: 15px;">Items de la Venta:</h4>
                    <table class="inventario-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">
                                    <input type="checkbox" id="selectAllDevolucion" onchange="toggleSeleccionarTodos(this)" title="Seleccionar todos">
                                </th>
                                <th>Juguete</th>
                                <th>Código</th>
                                <th>Cantidad Vendida</th>
                                <th>Cantidad a Devolver</th>
                                <th>Precio Unitario</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ventas.map(venta => {
                                const juguete = juguetesMap.get(venta.juguete_codigo) || null;
                                const cantidad = venta.cantidad || 1;
                                const precioUnitario = parseFloat(venta.precio_venta) / cantidad;
                                return `
                                    <tr>
                                        <td style="text-align: center;">
                                            <input type="checkbox" class="item-devolucion-checkbox" 
                                                data-venta-id="${venta.id}" 
                                                data-precio-unitario="${precioUnitario}"
                                                data-cantidad-max="${cantidad}"
                                                onchange="toggleSeleccionItem()">
                                        </td>
                                        <td>${juguete?.nombre || 'N/A'}</td>
                                        <td>${juguete?.codigo || venta.juguete_codigo || 'N/A'}</td>
                                        <td>${cantidad}</td>
                                        <td>
                                            <input 
                                                type="number" 
                                                class="cantidad-devolver-input" 
                                                data-venta-id="${venta.id}" 
                                                min="1" 
                                                max="${cantidad}" 
                                                value="${cantidad}" 
                                                style="width: 80px; text-align: center;"
                                                onchange="toggleSeleccionItem()"
                                            >
                                        </td>
                                        <td>$${precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>$${parseFloat(venta.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error al buscar venta:', error);
        showAjustesMessage('Error al buscar la venta: ' + error.message, 'error');
    }
}

// Función para toggle de selección de un item individual
window.toggleSeleccionItem = function() {
    const checkboxes = document.querySelectorAll('.item-devolucion-checkbox');
    const selectAll = document.getElementById('selectAllDevolucion');
    const btnDevolverSeleccionados = document.getElementById('btnDevolverSeleccionados');
    const totalSeleccionadoEl = document.getElementById('totalSeleccionadoDevolucion');
    
    // Calcular totales
    let totalSeleccionado = 0;
    let itemsSeleccionados = 0;
    let todosSeleccionados = true;
    
    checkboxes.forEach(cb => {
        const ventaId = cb.dataset.ventaId;
        const input = document.querySelector(`.cantidad-devolver-input[data-venta-id="${ventaId}"]`);
        const maxCantidad = parseInt(cb.dataset.cantidadMax || (input?.max || '0'), 10) || 0;
        let cantidad = parseInt(input?.value || '0', 10) || 0;

        // Normalizar cantidad dentro de 0..maxCantidad
        if (cantidad < 0) cantidad = 0;
        if (cantidad > maxCantidad) {
            cantidad = maxCantidad;
            if (input) input.value = maxCantidad;
        }

        if (cb.checked && cantidad > 0) {
            const precioUnitario = parseFloat(cb.dataset.precioUnitario || '0');
            totalSeleccionado += precioUnitario * cantidad;
            itemsSeleccionados++;
        } else {
            todosSeleccionados = false;
        }
    });
    
    // Actualizar checkbox "Seleccionar todos"
    if (selectAll) {
        selectAll.checked = todosSeleccionados && checkboxes.length > 0;
        selectAll.indeterminate = itemsSeleccionados > 0 && !todosSeleccionados;
    }
    
    // Actualizar botón y total
    if (btnDevolverSeleccionados) {
        btnDevolverSeleccionados.disabled = itemsSeleccionados === 0;
    }
    
    if (totalSeleccionadoEl) {
        totalSeleccionadoEl.innerHTML = `<strong>Total Seleccionado:</strong> <span style="color: #ef4444; font-weight: bold;">$${totalSeleccionado.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> (${itemsSeleccionados} item${itemsSeleccionados !== 1 ? 's' : ''})`;
    }
};

// Función para toggle de seleccionar todos los items
window.toggleSeleccionarTodos = function(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.item-devolucion-checkbox');
    const isChecked = selectAllCheckbox.checked;
    
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
    
    // Actualizar totales
    toggleSeleccionItem();
};

// Función para procesar devolución de items seleccionados
window.procesarDevolucionSelectiva = async function(codigoVenta) {
    const checkboxes = document.querySelectorAll('.item-devolucion-checkbox:checked');
    
    if (checkboxes.length === 0) {
        showAjustesMessage('Por favor, selecciona al menos un item para devolver', 'error');
        return;
    }
    
    // Obtener los IDs de las ventas seleccionadas y las cantidades a devolver
    const itemsSeleccionados = Array.from(checkboxes).map(cb => {
        const ventaId = parseInt(cb.dataset.ventaId, 10);
        const input = document.querySelector(`.cantidad-devolver-input[data-venta-id="${ventaId}"]`);
        const maxCantidad = parseInt(cb.dataset.cantidadMax || (input?.max || '0'), 10) || 0;
        let cantidad = parseInt(input?.value || '0', 10) || 0;

        if (cantidad <= 0) cantidad = 0;
        if (cantidad > maxCantidad) cantidad = maxCantidad;

        return { ventaId, cantidadDevolver: cantidad };
    }).filter(item => item.cantidadDevolver > 0);
    
    if (itemsSeleccionados.length === 0) {
        showAjustesMessage('Ingresa una cantidad válida a devolver para al menos un item', 'error');
        return;
    }

    // Llamar a procesarDevolucion con los items específicos
    await procesarDevolucion(codigoVenta, itemsSeleccionados);
};

// Función global para procesar devolución
let devolucionEnCurso = false;
window.procesarDevolucion = async function(codigoVenta, itemsSeleccionados = null) {
    // Evitar doble clic: dos ejecuciones simultáneas podían devolver el stock dos veces
    if (devolucionEnCurso) return;
    devolucionEnCurso = true;
    const botonesDevolucion = document.querySelectorAll('#ventasListContainer button');
    botonesDevolucion.forEach(b => { b.disabled = true; });
    try {
        await procesarDevolucionInterna(codigoVenta, itemsSeleccionados);
    } finally {
        devolucionEnCurso = false;
        document.querySelectorAll('#ventasListContainer button').forEach(b => { b.disabled = false; });
    }
};

/** Nombres legibles ("Tienda X", "Bodega Y") de las ubicaciones donde se repuso el stock. */
async function describirUbicacionesDevolucion(detalle) {
    const idsTiendas = [...new Set(detalle.map(d => d.tienda_id).filter(Boolean))];
    const idsBodegas = [...new Set(detalle.map(d => d.bodega_id).filter(Boolean))];
    const [tiendas, bodegas] = await Promise.all([
        idsTiendas.length ? window.supabaseClient.from('tiendas').select('id, nombre').in('id', idsTiendas) : { data: [] },
        idsBodegas.length ? window.supabaseClient.from('bodegas').select('id, nombre').in('id', idsBodegas) : { data: [] }
    ]);
    const nombres = [
        ...(tiendas.data || []).map(t => `Tienda ${t.nombre}`),
        ...(bodegas.data || []).map(b => `Bodega ${b.nombre}`)
    ];
    return nombres.length ? nombres : ['su ubicación original'];
}

/**
 * Devolución con la RPC revertir_venta: repone cada unidad en la ubicación exacta de la que salió
 * (registro guardado en la venta), ajusta o elimina las ventas y registra el log, todo en una transacción.
 */
async function procesarDevolucionRpc(codigoVenta, itemsSeleccionados) {
    try {
        const items = itemsSeleccionados
            ? itemsSeleccionados.map(it => ({ venta_id: it.ventaId, cantidad: it.cantidadDevolver }))
            : null;
        const resultado = await window.servicioStockRpc.devolverVenta(codigoVenta, items);

        const ubicaciones = await describirUbicacionesDevolucion(resultado.detalle || []);
        showAjustesMessage(
            `Devolución procesada: ${resultado.unidades_repuestas} unidad(es) repuestas en ${ubicaciones.join(', ')}. ` +
            `${resultado.ventas_eliminadas} línea(s) eliminada(s), ${resultado.ventas_parciales} ajustada(s).`, 'success');

        if (itemsSeleccionados) {
            await buscarVentaParaDevolucion();
        } else {
            document.getElementById('buscarVentaCodigo').value = '';
            document.getElementById('ventasListContainer').innerHTML = `
                <p style="text-align: center; color: #64748b; padding: 40px;">
                    Ingresa un código de venta para buscar y realizar una devolución.
                </p>
            `;
        }
        if (typeof loadDashboardSummary === 'function') loadDashboardSummary();
    } catch (error) {
        console.error('Error al procesar devolución:', error);
        showAjustesMessage('Error al procesar la devolución: ' + error.message, 'error');
    }
}

async function procesarDevolucionInterna(codigoVenta, itemsSeleccionados = null) {
    // Mensaje de confirmación diferente según si es selectiva o total
    const esSelectiva = Array.isArray(itemsSeleccionados) && itemsSeleccionados.length > 0;
    const mensajeConfirmacion = esSelectiva 
        ? `¿Estás seguro de que deseas devolver los items seleccionados?\n\nEsta acción:\n- Agregará las cantidades seleccionadas al inventario\n- Actualizará o eliminará las ventas correspondientes\n\nEsta acción no se puede deshacer.`
        : '¿Estás seguro de que deseas procesar la devolución COMPLETA?\n\nEsta acción:\n- Agregará TODOS los juguetes nuevamente al inventario\n- Eliminará la venta completa del sistema\n\nEsta acción no se puede deshacer.';
    
    if (!confirm(mensajeConfirmacion)) {
        return;
    }

    if (window.usarStockRpc && window.usarStockRpc()) {
        await procesarDevolucionRpc(codigoVenta, esSelectiva ? itemsSeleccionados : null);
        return;
    }

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Obtener las ventas según si es selectiva o total
        let query = window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('empresa_id', user.empresa_id);
        
        // Si hay items específicos, filtrar por sus IDs; si no, por código de venta
        let cantidadesMap = new Map();
        if (esSelectiva) {
            const idsVentas = itemsSeleccionados.map(it => it.ventaId);
            query = query.in('id', idsVentas);
            cantidadesMap = new Map(itemsSeleccionados.map(it => [it.ventaId, it.cantidadDevolver]));
        } else {
            query = query.eq('codigo_venta', codigoVenta);
        }
        
        const { data: ventas, error: ventasError } = await query;
        
        // Si hay ventas, cargar juguetes por separado (usando código)
        if (!ventasError && ventas && ventas.length > 0) {
            const jugueteCodigos = [...new Set(ventas.map(v => v.juguete_codigo).filter(c => c))];
            const { data: juguetesData } = await window.supabaseClient
                .from('juguetes')
                .select('id, nombre, codigo, cantidad, bodega_id, tienda_id, empresa_id')
                .in('codigo', jugueteCodigos)
                .eq('empresa_id', user.empresa_id);
            
            const juguetesMap = new Map((juguetesData || []).map(j => [j.codigo, j]));
            ventas.forEach(v => {
                v.juguetes = juguetesMap.get(v.juguete_codigo) || null;
            });
        }

        if (ventasError) throw ventasError;

        if (!ventas || ventas.length === 0) {
            showAjustesMessage('No se encontraron ventas para procesar', 'error');
            return;
        }

        let ventasProcesadas = 0;
        let ventasEliminadas = 0;

        // Procesar cada venta
        for (const venta of ventas) {

            const juguete = venta.juguetes;
            if (!juguete) {
                console.warn('Venta sin juguete asociado, eliminando venta:', venta.id);
                // Eliminar la venta aunque no tenga juguete
                const { error: deleteError } = await window.supabaseClient
                    .from('ventas')
                    .delete()
                    .eq('id', venta.id);

                if (deleteError) {
                    console.error('Error al eliminar venta sin juguete:', deleteError);
                    throw deleteError;
                }

                // Si el DELETE no devolvió error, asumimos que la venta fue eliminada correctamente
                ventasEliminadas++;
                console.log(`Venta ${venta.id} eliminada correctamente`);
                continue;
            }

            // Cantidad a devolver: si es selectiva, usar la cantidad indicada para esta venta; si no, toda la cantidad
            let cantidadSolicitada = venta.cantidad || 1;
            if (esSelectiva && cantidadesMap.has(venta.id)) {
                cantidadSolicitada = Math.min(cantidadesMap.get(venta.id) || 0, venta.cantidad || 1);
            }
            const cantidadDevolver = cantidadSolicitada;

            if (!cantidadDevolver || cantidadDevolver <= 0) {
                continue;
            }

            // Buscar juguete en la ubicación original específica (bodega o tienda)
            let jugueteEnUbicacion = null;
            const campoUbicacion = juguete.bodega_id ? 'bodega_id' : 'tienda_id';
            const valorUbicacion = juguete.bodega_id || juguete.tienda_id;

            if (valorUbicacion) {
                // Buscar juguete con mismo código, nombre Y ubicación
                const { data: jugueteExistenteData, error: jugueteError } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', juguete.codigo)
                    .eq('nombre', juguete.nombre)
                    .eq('empresa_id', user.empresa_id)
                    .eq(campoUbicacion, valorUbicacion)
                    .limit(1);

                if (jugueteError) {
                    console.error('Error al buscar juguete existente:', jugueteError);
                    throw jugueteError;
                }

                if (jugueteExistenteData && jugueteExistenteData.length > 0) {
                    jugueteEnUbicacion = jugueteExistenteData[0];
                }
            }

            if (jugueteEnUbicacion) {
                // Si existe el juguete en la ubicación original, aumentar su cantidad
                const nuevaCantidad = (jugueteEnUbicacion.cantidad || 0) + cantidadDevolver;
                const { error: updateError } = await window.supabaseClient
                    .from('juguetes')
                    .update({ cantidad: nuevaCantidad })
                    .eq('id', jugueteEnUbicacion.id);

                if (updateError) {
                    console.error('Error al actualizar cantidad del juguete:', updateError);
                    throw updateError;
                }
                console.log(`Juguete ${jugueteEnUbicacion.id} actualizado: cantidad ${jugueteEnUbicacion.cantidad} -> ${nuevaCantidad}`);
            } else {
                // Si no existe, crear un nuevo registro en la ubicación original
                const nuevoJuguete = {
                    nombre: juguete.nombre,
                    codigo: juguete.codigo,
                    cantidad: cantidadDevolver,
                    empresa_id: user.empresa_id
                };

                if (juguete.bodega_id) {
                    nuevoJuguete.bodega_id = juguete.bodega_id;
                    nuevoJuguete.tienda_id = null;
                } else if (juguete.tienda_id) {
                    nuevoJuguete.tienda_id = juguete.tienda_id;
                    nuevoJuguete.bodega_id = null;
                } else {
                    // Si no hay ubicación, no podemos crear el juguete
                    console.warn('Juguete sin ubicación, no se puede devolver:', juguete);
                    // Eliminar la venta de todas formas
                    const { error: deleteError } = await window.supabaseClient
                        .from('ventas')
                        .delete()
                        .eq('id', venta.id);
                    if (deleteError) {
                        console.error('Error al eliminar venta sin ubicación:', deleteError);
                        throw deleteError;
                    }
                    continue;
                }

                const { error: insertError } = await window.supabaseClient
                    .from('juguetes')
                    .insert(nuevoJuguete);

                if (insertError) {
                    console.error('Error al insertar juguete devuelto:', insertError);
                    throw insertError;
                }
                console.log(`Juguete nuevo creado en ubicación: ${campoUbicacion} = ${valorUbicacion}`);
            }

            // Actualizar o eliminar la venta según la cantidad devuelta
            const cantidadOriginal = venta.cantidad || 1;
            if (cantidadDevolver >= cantidadOriginal) {
                // Eliminar la venta completa
                const { error: deleteError } = await window.supabaseClient
                    .from('ventas')
                    .delete()
                    .eq('id', venta.id);

                if (deleteError) {
                    console.error('Error al eliminar venta:', deleteError);
                    throw deleteError;
                }

                ventasProcesadas++;
                ventasEliminadas++;
                console.log(`Venta ${venta.id} procesada y eliminada completamente`);
            } else {
                // Devolver solo parte: actualizar cantidad y precio de la venta
                const precioUnitarioVenta = parseFloat(venta.precio_venta || 0) / cantidadOriginal;
                const nuevaCantidadVenta = cantidadOriginal - cantidadDevolver;
                const nuevoPrecioVenta = precioUnitarioVenta * nuevaCantidadVenta;

                const { error: updateVentaError } = await window.supabaseClient
                    .from('ventas')
                    .update({
                        cantidad: nuevaCantidadVenta,
                        precio_venta: nuevoPrecioVenta
                    })
                    .eq('id', venta.id);

                if (updateVentaError) {
                    console.error('Error al actualizar venta después de devolución parcial:', updateVentaError);
                    throw updateVentaError;
                }

                ventasProcesadas++;
                console.log(`Venta ${venta.id} actualizada: cantidad ${cantidadOriginal} -> ${nuevaCantidadVenta}`);
            }
        }

        // Si es devolución completa y no se eliminó nada, puede indicar problema de permisos
        if (!esSelectiva && ventasEliminadas === 0) {
            throw new Error('No se eliminó ninguna venta. Verifica las políticas RLS en Supabase para la tabla ventas.');
        }

        const mensajeExito = esSelectiva 
            ? `Devolución selectiva procesada correctamente. Cantidades devueltas y stock actualizado.`
            : `Devolución completa procesada correctamente. ${ventasEliminadas} venta(s) eliminada(s) y juguetes agregados nuevamente al inventario.`;
        showAjustesMessage(mensajeExito, 'success');
        
        // Si fue selectiva y quedan más items, recargar la búsqueda
        if (esSelectiva) {
            // Recargar la búsqueda para ver los items restantes
            await buscarVentaParaDevolucion();
        } else {
            // Limpiar búsqueda si fue devolución total
            document.getElementById('buscarVentaCodigo').value = '';
            document.getElementById('ventasListContainer').innerHTML = `
                <p style="text-align: center; color: #64748b; padding: 40px;">
                    Ingresa un código de venta para buscar y realizar una devolución.
                </p>
            `;
        }

        // Recargar resumen del dashboard si existe
        if (typeof loadDashboardSummary === 'function') {
            await loadDashboardSummary();
        }
        
        // También recargar inventario si está visible
        if (typeof loadInventario === 'function') {
            const inventarioView = document.getElementById('inventarioView');
            if (inventarioView && inventarioView.style.display !== 'none') {
                await loadInventario();
            }
        }
    } catch (error) {
        console.error('Error al procesar devolución:', error);
        showAjustesMessage('Error al procesar la devolución: ' + error.message + '. Verifica que la política DELETE esté habilitada en Supabase para la tabla ventas.', 'error');
    }
}

function showAjustesMessage(message, type) {
    const errorMsg = document.getElementById('ajustesErrorMessage');
    const successMsg = document.getElementById('ajustesSuccessMessage');
    
    if (!errorMsg || !successMsg) return;
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    
    if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'flex';
    } else {
        successMsg.textContent = message;
        successMsg.style.display = 'flex';
    }
    
    programarOcultarMensajes(errorMsg, successMsg); // reinicia el temporizador si ya había un mensaje
}

// Exportar función
window.initAjustes = initAjustes;

// ============================================
// GRÁFICOS DE ANÁLISIS
// ============================================

let ventasPorDiaChart = null;
let ventasPorHoraChart = null;
let dashboardVentasChart = null;

// Función para obtener ventas del mes actual
async function obtenerVentasDelMes() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const ahora = new Date();
        const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
        
        const { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select('created_at, precio_venta, cantidad')
            .eq('empresa_id', user.empresa_id)
            .gte('created_at', primerDiaMes.toISOString())
            .lte('created_at', ultimoDiaMes.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;
        
        return ventas || [];
    } catch (error) {
        console.error('Error al obtener ventas del mes:', error);
        return [];
    }
}

// Función para procesar ventas por día
function procesarVentasPorDia(ventas) {
    const ventasPorDia = {};
    const diasDelMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    
    // Inicializar todos los días del mes con 0
    for (let i = 1; i <= diasDelMes; i++) {
        ventasPorDia[i] = { cantidad: 0, total: 0 };
    }
    
    // Procesar ventas
    ventas.forEach(venta => {
        const fecha = new Date(venta.created_at);
        const dia = fecha.getDate();
        const cantidad = parseFloat(venta.cantidad || 1);
        const precio = parseFloat(venta.precio_venta || 0);
        
        if (ventasPorDia[dia]) {
            ventasPorDia[dia].cantidad += cantidad;
            ventasPorDia[dia].total += precio;
        }
    });
    
    return ventasPorDia;
}

// Función para procesar ventas por hora
function procesarVentasPorHora(ventas) {
    const ventasPorHora = {};
    
    // Inicializar todas las horas del día con 0
    for (let i = 0; i < 24; i++) {
        ventasPorHora[i] = { cantidad: 0, total: 0 };
    }
    
    // Procesar ventas
    ventas.forEach(venta => {
        const fecha = new Date(venta.created_at);
        const hora = fecha.getHours();
        const cantidad = parseFloat(venta.cantidad || 1);
        const precio = parseFloat(venta.precio_venta || 0);
        
        if (ventasPorHora[hora] !== undefined) {
            ventasPorHora[hora].cantidad += cantidad;
            ventasPorHora[hora].total += precio;
        }
    });
    
    return ventasPorHora;
}

// Función para cargar gráficos en la sección de análisis
async function cargarGraficosAnalisis() {
    const ventas = await obtenerVentasDelMes();
    
    if (ventas.length === 0) {
        const diaInfo = document.getElementById('ventasPorDiaInfo');
        const horaInfo = document.getElementById('ventasPorHoraInfo');
        if (diaInfo) diaInfo.innerHTML = '<p style="color: #64748b;">No hay ventas en el mes actual</p>';
        if (horaInfo) horaInfo.innerHTML = '<p style="color: #64748b;">No hay ventas en el mes actual</p>';
        return;
    }
    
    // Procesar datos
    const ventasPorDia = procesarVentasPorDia(ventas);
    const ventasPorHora = procesarVentasPorHora(ventas);
    
    // Crear gráfico de ventas por día
    crearGraficoVentasPorDia(ventasPorDia);
    
    // Crear gráfico de ventas por hora
    crearGraficoVentasPorHora(ventasPorHora);
    
    // Actualizar información de días máximo y mínimo
    actualizarInfoVentasPorDia(ventasPorDia);
    
    // Actualizar información de horas máximo y mínimo
    actualizarInfoVentasPorHora(ventasPorHora);
}

// Función para crear gráfico de ventas por día
function crearGraficoVentasPorDia(ventasPorDia) {
    const ctx = document.getElementById('ventasPorDiaChart');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (ventasPorDiaChart) {
        ventasPorDiaChart.destroy();
    }
    
    const dias = Object.keys(ventasPorDia).map(d => parseInt(d));
    const cantidades = dias.map(d => ventasPorDia[d].cantidad);
    const totales = dias.map(d => ventasPorDia[d].total);
    
    ventasPorDiaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dias.map(d => `Día ${d}`),
            datasets: [
                {
                    label: 'Cantidad de Juguetes Vendidos',
                    data: cantidades,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Total en Pesos ($)',
                    data: totales,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Ventas Diarias del Mes Actual',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Cantidad: ${context.parsed.y} juguetes`;
                            } else {
                                return `Total: $${context.parsed.y.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Cantidad de Juguetes'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Total en Pesos ($)'
                    },
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Días del Mes'
                    }
                }
            }
        }
    });
}

// Función para crear gráfico de ventas por hora
function crearGraficoVentasPorHora(ventasPorHora) {
    const ctx = document.getElementById('ventasPorHoraChart');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (ventasPorHoraChart) {
        ventasPorHoraChart.destroy();
    }
    
    const horas = Object.keys(ventasPorHora).map(h => parseInt(h));
    const cantidades = horas.map(h => ventasPorHora[h].cantidad);
    const totales = horas.map(h => ventasPorHora[h].total);
    
    ventasPorHoraChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: horas.map(h => `${h}:00 - ${h + 1}:00`),
            datasets: [
                {
                    label: 'Cantidad de Juguetes Vendidos',
                    data: cantidades,
                    backgroundColor: 'rgba(245, 158, 11, 0.6)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Total en Pesos ($)',
                    data: totales,
                    backgroundColor: 'rgba(139, 92, 246, 0.6)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Ventas por Hora del Día (Mes Actual)',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Cantidad: ${context.parsed.y} juguetes`;
                            } else {
                                return `Total: $${context.parsed.y.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Cantidad de Juguetes'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Total en Pesos ($)'
                    },
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Horas del Día'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Función para actualizar información de días máximo y mínimo
function actualizarInfoVentasPorDia(ventasPorDia) {
    let diaMax = null;
    let diaMin = null;
    let cantidadMax = -1;
    let cantidadMin = Infinity;
    
    Object.keys(ventasPorDia).forEach(dia => {
        const cantidad = ventasPorDia[dia].cantidad;
        if (cantidad > cantidadMax) {
            cantidadMax = cantidad;
            diaMax = dia;
        }
        if (cantidad < cantidadMin) {
            cantidadMin = cantidad;
            diaMin = dia;
        }
    });
    
    const infoDiv = document.getElementById('ventasPorDiaInfo');
    if (infoDiv) {
        if (diaMax !== null) {
            infoDiv.innerHTML = `
                <p><strong>Día con más ventas:</strong> <span style="color: #10b981;">Día ${diaMax}</span> (${cantidadMax} juguetes - $${ventasPorDia[diaMax].total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                <p><strong>Día con menos ventas:</strong> <span style="color: ${cantidadMin === 0 ? '#ef4444' : '#f59e0b'};">Día ${diaMin}</span> (${cantidadMin} juguetes - $${ventasPorDia[diaMin].total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
            `;
        } else {
            infoDiv.innerHTML = '<p style="color: #64748b;">No hay datos disponibles</p>';
        }
    }
}

// Función para actualizar información de horas máximo y mínimo
function actualizarInfoVentasPorHora(ventasPorHora) {
    let horaMax = null;
    let horaMin = null;
    let cantidadMax = -1;
    let cantidadMin = Infinity;
    
    Object.keys(ventasPorHora).forEach(hora => {
        const cantidad = ventasPorHora[hora].cantidad;
        if (cantidad > cantidadMax) {
            cantidadMax = cantidad;
            horaMax = hora;
        }
        if (cantidad < cantidadMin) {
            cantidadMin = cantidad;
            horaMin = hora;
        }
    });
    
    const infoDiv = document.getElementById('ventasPorHoraInfo');
    if (infoDiv) {
        if (horaMax !== null) {
            infoDiv.innerHTML = `
                <p><strong>Hora con más ventas:</strong> <span style="color: #10b981;">${horaMax}:00 - ${parseInt(horaMax) + 1}:00</span> (${cantidadMax} juguetes - $${ventasPorHora[horaMax].total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
                <p><strong>Hora con menos ventas:</strong> <span style="color: ${cantidadMin === 0 ? '#ef4444' : '#f59e0b'};">${horaMin}:00 - ${parseInt(horaMin) + 1}:00</span> (${cantidadMin} juguetes - $${ventasPorHora[horaMin].total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</p>
            `;
        } else {
            infoDiv.innerHTML = '<p style="color: #64748b;">No hay datos disponibles</p>';
        }
    }
}

// Función para cargar gráfico de ventas en el dashboard
async function cargarGraficoVentasDashboard() {
    const ventas = await obtenerVentasDelMes();
    
    if (ventas.length === 0) {
        const ctx = document.getElementById('dashboardVentasChart');
        if (ctx && ctx.parentElement) {
            ctx.parentElement.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas en el mes actual</p>';
        }
        return;
    }
    
    const ventasPorDia = procesarVentasPorDia(ventas);
    crearGraficoDashboardVentas(ventasPorDia);
}

// Función para crear gráfico de ventas en el dashboard
function crearGraficoDashboardVentas(ventasPorDia) {
    const ctx = document.getElementById('dashboardVentasChart');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (dashboardVentasChart) {
        dashboardVentasChart.destroy();
    }
    
    const dias = Object.keys(ventasPorDia).map(d => parseInt(d));
    const cantidades = dias.map(d => ventasPorDia[d].cantidad);
    
    dashboardVentasChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dias.map(d => `Día ${d}`),
            datasets: [{
                label: 'Juguetes Vendidos',
                data: cantidades,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} juguetes vendidos`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cantidad de Juguetes'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Días del Mes'
                    }
                }
            }
        }
    });
}

// ============================================
// VISTA DE VENTAS - LISTA COMPLETA
// ============================================

// Variables para paginación de ventas
let todasLasVentas = [];
let ventasFiltradas = [];
let paginaActualVentas = 1;
const itemsPorPaginaVentas = 20;

// Función para inicializar la vista de ventas
async function initVentasLista() {
    await cargarTodasLasVentas();
}

// Función para cargar todas las ventas
async function cargarTodasLasVentas() {
    const tbody = document.getElementById('ventasTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">Cargando ventas...</td></tr>';
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Cargar ventas sin relaciones automáticas (ya no hay foreign key, usar juguete_codigo)
        const { data: ventasSimples, error: errorSimple } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false });
        
        if (errorSimple) throw errorSimple;
        
        // Cargar juguetes y empleados por separado (usando código)
        let ventas = [];
        if (ventasSimples && ventasSimples.length > 0) {
            const jugueteCodigos = [...new Set(ventasSimples.map(v => v.juguete_codigo).filter(c => c))];
            const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
            
            const [juguetesData, empleadosData] = await Promise.all([
                jugueteCodigos.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('codigo', jugueteCodigos).eq('empresa_id', user.empresa_id) : { data: [] },
                empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
            ]);

            const juguetesMap = new Map((juguetesData.data || []).map(j => [j.codigo, j]));
            const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

            // Combinar datos
            ventas = ventasSimples.map(v => ({
                ...v,
                juguetes: juguetesMap.get(v.juguete_codigo) || null,
                empleados: empleadosMap.get(v.empleado_id) || null
            }));
        }
        
        todasLasVentas = ventas || [];
        ventasFiltradas = [...todasLasVentas];
        
        // Calcular resúmenes
        calcularResumenVentas();
        
        // Renderizar primera página
        paginaActualVentas = 1;
        renderizarVentasTabla();
        renderizarPaginacionVentas();
        
    } catch (error) {
        console.error('Error al cargar ventas:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">Error al cargar ventas</td></tr>';
    }
}

// Función para calcular resumen de ventas
function calcularResumenVentas() {
    const totalCount = document.getElementById('totalVentasCount');
    const totalGanancias = document.getElementById('totalGananciasVentas');
    const gananciasEfectivo = document.getElementById('gananciasEfectivo');
    const gananciasTransferencia = document.getElementById('gananciasTransferencia');
    const gananciasTarjeta = document.getElementById('gananciasTarjeta');
    const gananciasOtros = document.getElementById('gananciasOtros');
    
    // Usar ventas filtradas para el cálculo
    const ventas = ventasFiltradas;
    
    // Calcular totales
    const total = ventas.reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
    const efectivo = ventas.filter(v => v.metodo_pago?.toLowerCase() === 'efectivo')
        .reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
    const transferencia = ventas.filter(v => v.metodo_pago?.toLowerCase() === 'transferencia')
        .reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
    const tarjeta = ventas.filter(v => v.metodo_pago?.toLowerCase() === 'tarjeta')
        .reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
    const otros = ventas.filter(v => !['efectivo', 'transferencia', 'tarjeta'].includes(v.metodo_pago?.toLowerCase()))
        .reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0);
    
    // Actualizar UI
    if (totalCount) totalCount.textContent = ventas.length.toLocaleString('es-CO');
    if (totalGanancias) totalGanancias.textContent = `$${total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (gananciasEfectivo) gananciasEfectivo.textContent = `$${efectivo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (gananciasTransferencia) gananciasTransferencia.textContent = `$${transferencia.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (gananciasTarjeta) gananciasTarjeta.textContent = `$${tarjeta.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (gananciasOtros) gananciasOtros.textContent = `$${otros.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Función para renderizar la tabla de ventas
function renderizarVentasTabla() {
    const tbody = document.getElementById('ventasTableBody');
    if (!tbody) return;
    
    if (ventasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">No se encontraron ventas</td></tr>';
        return;
    }
    
    // Calcular índices de paginación
    const inicio = (paginaActualVentas - 1) * itemsPorPaginaVentas;
    const fin = inicio + itemsPorPaginaVentas;
    const ventasPagina = ventasFiltradas.slice(inicio, fin);
    
    tbody.innerHTML = ventasPagina.map(venta => {
        const fecha = new Date(venta.created_at).toLocaleString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const metodoBadge = getMetodoPagoBadge(venta.metodo_pago);
        
        return `
            <tr>
                <td style="font-family: monospace; color: #6366f1; font-weight: bold;">${venta.codigo_venta || 'N/A'}</td>
                <td style="font-size: 13px; color: #64748b;">${fecha}</td>
                <td>
                    <strong>${venta.juguetes?.nombre || 'N/A'}</strong>
                    <br><small style="color: #64748b;">${venta.juguetes?.codigo || ''}</small>
                </td>
                <td style="text-align: center;">${venta.cantidad || 1}</td>
                <td style="font-weight: bold; color: #10b981;">$${parseFloat(venta.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td>
                <td>${metodoBadge}</td>
                <td style="font-size: 13px;">${venta.empleados?.nombre || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

// Función para obtener badge de método de pago
function getMetodoPagoBadge(metodo) {
    const metodosColores = {
        'efectivo': { bg: '#dbeafe', color: '#1d4ed8', icon: 'fa-money-bill-wave' },
        'transferencia': { bg: '#ede9fe', color: '#7c3aed', icon: 'fa-university' },
        'tarjeta': { bg: '#fef3c7', color: '#d97706', icon: 'fa-credit-card' }
    };
    
    const config = metodosColores[metodo?.toLowerCase()] || { bg: '#f1f5f9', color: '#64748b', icon: 'fa-question' };
    
    return `<span style="background: ${config.bg}; color: ${config.color}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">
        <i class="fas ${config.icon}"></i> ${metodo || 'N/A'}
    </span>`;
}

// Función para renderizar paginación
function renderizarPaginacionVentas() {
    const container = document.getElementById('ventasPaginacion');
    if (!container) return;
    
    const totalPaginas = Math.ceil(ventasFiltradas.length / itemsPorPaginaVentas);
    
    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Botón anterior
    html += `<button onclick="cambiarPaginaVentas(${paginaActualVentas - 1})" 
        class="btn-paginacion" ${paginaActualVentas === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
    </button>`;
    
    // Páginas
    const maxVisible = 5;
    let inicioP = Math.max(1, paginaActualVentas - Math.floor(maxVisible / 2));
    let finP = Math.min(totalPaginas, inicioP + maxVisible - 1);
    
    if (finP - inicioP + 1 < maxVisible) {
        inicioP = Math.max(1, finP - maxVisible + 1);
    }
    
    if (inicioP > 1) {
        html += `<button onclick="cambiarPaginaVentas(1)" class="btn-paginacion">1</button>`;
        if (inicioP > 2) html += `<span style="padding: 0 10px;">...</span>`;
    }
    
    for (let i = inicioP; i <= finP; i++) {
        html += `<button onclick="cambiarPaginaVentas(${i})" 
            class="btn-paginacion ${i === paginaActualVentas ? 'active' : ''}">${i}</button>`;
    }
    
    if (finP < totalPaginas) {
        if (finP < totalPaginas - 1) html += `<span style="padding: 0 10px;">...</span>`;
        html += `<button onclick="cambiarPaginaVentas(${totalPaginas})" class="btn-paginacion">${totalPaginas}</button>`;
    }
    
    // Botón siguiente
    html += `<button onclick="cambiarPaginaVentas(${paginaActualVentas + 1})" 
        class="btn-paginacion" ${paginaActualVentas === totalPaginas ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    // Info de registros
    const inicioReg = (paginaActualVentas - 1) * itemsPorPaginaVentas + 1;
    const finReg = Math.min(paginaActualVentas * itemsPorPaginaVentas, ventasFiltradas.length);
    html += `<span style="margin-left: 15px; color: #64748b; font-size: 13px;">
        ${inicioReg}-${finReg} de ${ventasFiltradas.length}
    </span>`;
    
    container.innerHTML = html;
}

// Función para cambiar de página
window.cambiarPaginaVentas = function(pagina) {
    const totalPaginas = Math.ceil(ventasFiltradas.length / itemsPorPaginaVentas);
    if (pagina < 1 || pagina > totalPaginas) return;
    
    paginaActualVentas = pagina;
    renderizarVentasTabla();
    renderizarPaginacionVentas();
    
    // Scroll al inicio de la tabla
    const tabla = document.querySelector('.ventas-tabla-container');
    if (tabla) tabla.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Función para filtrar ventas
window.filtrarVentasLista = function() {
    const buscar = document.getElementById('buscarVentaInput')?.value.toLowerCase().trim() || '';
    const metodoPago = document.getElementById('filtroMetodoPago')?.value.toLowerCase() || '';
    const fechaDesde = document.getElementById('filtroFechaDesde')?.value || '';
    const fechaHasta = document.getElementById('filtroFechaHasta')?.value || '';
    
    ventasFiltradas = todasLasVentas.filter(venta => {
        // Filtro por texto
        if (buscar) {
            const codigoVenta = (venta.codigo_venta || '').toLowerCase();
            const jugueteNombre = (venta.juguetes?.nombre || '').toLowerCase();
            const jugueteCodigo = (venta.juguetes?.codigo || '').toLowerCase();
            const empleado = (venta.empleados?.nombre || '').toLowerCase();
            const precio = venta.precio_venta?.toString() || '';
            const metodo = (venta.metodo_pago || '').toLowerCase();
            
            const coincide = codigoVenta.includes(buscar) ||
                jugueteNombre.includes(buscar) ||
                jugueteCodigo.includes(buscar) ||
                empleado.includes(buscar) ||
                precio.includes(buscar) ||
                metodo.includes(buscar);
            
            if (!coincide) return false;
        }
        
        // Filtro por método de pago
        if (metodoPago && venta.metodo_pago?.toLowerCase() !== metodoPago) {
            return false;
        }
        
        // Filtro por fecha desde
        if (fechaDesde) {
            const fechaVenta = new Date(venta.created_at).toISOString().split('T')[0];
            if (fechaVenta < fechaDesde) return false;
        }
        
        // Filtro por fecha hasta
        if (fechaHasta) {
            const fechaVenta = new Date(venta.created_at).toISOString().split('T')[0];
            if (fechaVenta > fechaHasta) return false;
        }
        
        return true;
    });
    
    // Recalcular resumen con ventas filtradas
    calcularResumenVentas();
    
    // Volver a página 1 y renderizar
    paginaActualVentas = 1;
    renderizarVentasTabla();
    renderizarPaginacionVentas();
};



// ============================================

// TIENDAS - CRUD COMPLETO CON EMPLEADOS Y JUGUETES

// ============================================



// Toggle del acordeón "Agregar Tienda" - Ya está inicializado arriba (línea 3490)



// Formulario para agregar tienda (se configura en setupTiendaForm)


function showTiendaMessage(message, type) {

    const errorMsg = document.getElementById('tiendaErrorMessage');

    const successMsg = document.getElementById('tiendaSuccessMessage');

    

    if (!errorMsg || !successMsg) return;

    

    errorMsg.style.display = 'none';

    successMsg.style.display = 'none';

    

    if (type === 'error') {

        errorMsg.textContent = message;

        errorMsg.style.display = 'flex';

    } else {

        successMsg.textContent = message;

        successMsg.style.display = 'flex';

    }

    

    programarOcultarMensajes(errorMsg, successMsg); // reinicia el temporizador si ya había un mensaje

}









// ============================================

// ANÁLISIS - COMPLETAR FUNCIONES

// ============================================



async function aplicarFiltroVentas(filtro) {

    const resultsDiv = document.getElementById('analisisResults');

    if (!resultsDiv) return;

    

    try {

        const user = JSON.parse(sessionStorage.getItem('user'));

        let query = window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('empresa_id', user.empresa_id);



        switch(filtro) {

            case 'dia':

                const hoy = new Date();

                hoy.setHours(0, 0, 0, 0);

                query = query.gte('created_at', hoy.toISOString());

                break;

            case 'semana':

                const semana = new Date();

                semana.setDate(semana.getDate() - 7);

                query = query.gte('created_at', semana.toISOString());

                break;

        }



        const { data: ventas, error } = await query.order('created_at', { ascending: false });



        if (error) throw error;



        if (!ventas || ventas.length === 0) {

            resultsDiv.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas para mostrar</p>';

            return;

        }



        resultsDiv.innerHTML = `

            <h3>Resultados de Ventas</h3>

            <table class="inventario-table">

                <thead>

                    <tr>

                        <th>Código</th>

                        <th>Juguete</th>

                        <th>Empleado</th>

                        <th>Precio</th>

                        <th>Método</th>

                        <th>Fecha</th>

                    </tr>

                </thead>

                <tbody>

                    ${ventas.map(v => `

                        <tr>

                            <td>${v.codigo_venta}</td>

                            <td>${v.juguetes?.nombre || 'N/A'}</td>

                            <td>${v.empleados?.nombre || 'N/A'}</td>

                            <td>$${parseFloat(v.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                            <td>${v.metodo_pago}</td>

                            <td>${new Date(v.created_at).toLocaleDateString('es-CO')}</td>

                        </tr>

                    `).join('')}

                </tbody>

            </table>

        `;

    } catch (error) {

        console.error('Error al aplicar filtro:', error);

        resultsDiv.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar los datos</p>';

    }

}



async function aplicarFiltroGanancias(filtro) {

    const resultsDiv = document.getElementById('analisisResults');

    if (!resultsDiv) return;

    

    try {

        const user = JSON.parse(sessionStorage.getItem('user'));

        let query = window.supabaseClient

            .from('ventas')

            .select('precio_venta, created_at, empleado_id')

            .eq('empresa_id', user.empresa_id);



        switch(filtro) {

            case 'dia':

                const hoy = new Date();

                hoy.setHours(0, 0, 0, 0);

                query = query.gte('created_at', hoy.toISOString());

                break;

            case 'semana':

                const semana = new Date();

                semana.setDate(semana.getDate() - 7);

                query = query.gte('created_at', semana.toISOString());

                break;

        }



        const { data: ventas, error } = await query;



        if (error) throw error;



        const total = ventas?.reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0) || 0;



        resultsDiv.innerHTML = `

            <div class="stat-card" style="max-width: 400px; margin: 0 auto;">

                <h3>Ganancias ${filtro === 'dia' ? 'del Día' : filtro === 'semana' ? 'de la Semana' : 'Totales'}</h3>

                <p class="stat-number">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>

            </div>

        `;

    } catch (error) {

        console.error('Error al aplicar filtro de ganancias:', error);

        resultsDiv.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar los datos</p>';

    }

}



// Exportar funciones globales


window.setupUsuarioForm = setupUsuarioForm;
window.setupTiendaForm = setupTiendaForm;


