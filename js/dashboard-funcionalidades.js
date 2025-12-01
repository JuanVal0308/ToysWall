// ============================================
// FUNCIONALIDADES COMPLETAS DEL DASHBOARD
// ============================================

// Variables globales
let ventaItems = []; // Array para almacenar items de la venta actual
let currentFacturaData = null; // Datos de la factura actual

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
        
        // Cargar totales (optimizado: solo counts)
        const [tiendas, bodegas, usuarios, ventas] = await Promise.all([
            window.supabaseClient.from('tiendas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('bodegas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('usuarios').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('ventas').select('precio_venta').eq('empresa_id', user.empresa_id)
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
            totalGananciasEl.textContent = '$' + totalGanancias.toLocaleString('es-CO', { minimumFractionDigits: 2 });
        }

        // Cargar ventas recientes
        const ventasList = document.getElementById('ventasRecientes');
        try {
            const { data: ventasRecientes, error: ventasError } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false })
            .limit(5);

            if (ventasError) {
                console.error('Error al cargar ventas recientes con relaciones:', ventasError);
                // Fallback: cargar sin relaciones
                const { data: ventasSimples, error: errorSimple } = await window.supabaseClient
                    .from('ventas')
                    .select('*')
                    .eq('empresa_id', user.empresa_id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                
                if (errorSimple) {
                    throw errorSimple;
                }

                // Cargar juguetes y empleados por separado
                if (ventasSimples && ventasSimples.length > 0) {
                    const jugueteIds = [...new Set(ventasSimples.map(v => v.juguete_id))];
                    const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
                    
                    const [juguetesData, empleadosData] = await Promise.all([
                        jugueteIds.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('id', jugueteIds) : { data: [] },
                        empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
                    ]);

                    const juguetesMap = new Map((juguetesData.data || []).map(j => [j.id, j]));
                    const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

                    ventasList.innerHTML = ventasSimples.map(v => {
                        const juguete = juguetesMap.get(v.juguete_id);
                        const empleado = empleadosMap.get(v.empleado_id);
                        return `
                            <div class="venta-item">
                                <div class="venta-info">
                                    <strong>${juguete?.nombre || 'N/A'}</strong>
                                    <span>${v.codigo_venta}</span>
                                </div>
                                <div class="venta-precio">$${parseFloat(v.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
                            </div>
                        `;
                    }).join('');
                } else {
                    ventasList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas recientes</p>';
                }
            } else if (ventasRecientes && ventasRecientes.length > 0) {
            ventasList.innerHTML = ventasRecientes.map(v => `
                <div class="venta-item">
                    <div class="venta-info">
                        <strong>${v.juguetes?.nombre || 'N/A'}</strong>
                        <span>${v.codigo_venta}</span>
                    </div>
                        <div class="venta-precio">$${parseFloat(v.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
                </div>
            `).join('');
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

    // Configurar formato de precio con separadores de miles
    const ventaPrecioInput = document.getElementById('ventaPrecio');
    if (ventaPrecioInput) {
        // Guardar el valor numérico real en un atributo data
        ventaPrecioInput.addEventListener('input', function(e) {
            let value = e.target.value;
            // Remover todos los caracteres que no sean números
            const numericValue = value.replace(/[^\d]/g, '');
            
            if (numericValue === '') {
                e.target.value = '';
                e.target.dataset.numericValue = '';
                return;
            }
            
            // Guardar el valor numérico
            const numValue = parseInt(numericValue);
            e.target.dataset.numericValue = numValue;
            
            // Formatear con separadores de miles
            const formatted = numValue.toLocaleString('es-CO', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
            
            // Actualizar el valor mostrado
            e.target.value = formatted;
        });
        
        // Al hacer blur, asegurar que el valor esté formateado
        ventaPrecioInput.addEventListener('blur', function(e) {
            const numericValue = e.target.dataset.numericValue || e.target.value.replace(/[^\d]/g, '');
            if (numericValue && numericValue !== '') {
                const numValue = parseInt(numericValue);
                e.target.value = numValue.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
                e.target.dataset.numericValue = numValue;
            }
        });
        
        // Al hacer focus, mantener el valor formateado pero permitir edición
        ventaPrecioInput.addEventListener('focus', function(e) {
            const numericValue = e.target.dataset.numericValue || e.target.value.replace(/[^\d]/g, '');
            if (numericValue && numericValue !== '') {
                // Mantener formateado para mejor visualización
                const numValue = parseInt(numericValue);
                e.target.value = numValue.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
            }
        });
    }

    // Buscar juguete por código
    jugueteCodigoInput.addEventListener('blur', async function() {
        const codigo = this.value.trim();
        if (!codigo) return;

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
                    tiendaInfo = '<br><small style="color: #ef4444;">✗ Sin tienda asignada</small>';
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

    // Agregar item a la venta (solo una vez)
    agregarItemBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const jugueteCodigo = jugueteCodigoInput.value.trim();
        const empleadoCodigo = empleadoCodigoInput.value.trim();
        const cantidad = parseInt(document.getElementById('ventaCantidad')?.value || 1);
        // Obtener el valor numérico real del campo de precio (puede estar formateado)
        const precioInput = document.getElementById('ventaPrecio');
        const precioRaw = precioInput?.dataset.numericValue || precioInput?.value.replace(/[^\d]/g, '') || '0';
        const precio = parseFloat(precioRaw);
        const metodoPago = document.getElementById('ventaMetodoPago').value;

        if (!jugueteCodigo || !empleadoCodigo || !precio || !metodoPago || cantidad < 1) {
            showVentaMessage('Por favor, completa todos los campos correctamente', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Verificar empleado primero (usar limit en lugar de single)
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

            const empleado = empleadosData[0];

            // Empleados especiales que pueden vender en cualquier parte: Jose y Sindy
            const empleadosEspeciales = ['Jose', 'Sindy'];
            const esEmpleadoEspecial = empleadosEspeciales.includes(empleado.nombre);

            // Buscar TODOS los juguetes con ese código (puede haber múltiples registros en diferentes ubicaciones)
            const { data: juguetesData, error: jugueteError } = await window.supabaseClient
                .from('juguetes')
                .select('*')
                .eq('codigo', jugueteCodigo)
                .eq('empresa_id', user.empresa_id);

            if (jugueteError) {
                console.error('Error al buscar juguete:', jugueteError);
                showVentaMessage('Error al buscar juguete: ' + jugueteError.message, 'error');
                return;
            }

            if (!juguetesData || juguetesData.length === 0) {
                showVentaMessage('Juguete no encontrado', 'error');
                return;
            }

            // Seleccionar el juguete correcto según la ubicación del empleado
            let juguete = null;

            if (!esEmpleadoEspecial) {
                // Empleado normal: debe buscar el juguete en su tienda
                if (!empleado.tienda_id) {
                    showVentaMessage('El empleado no tiene una tienda asignada. No puede realizar ventas.', 'error');
                return;
                }

                // Buscar juguete en la tienda del empleado
                juguete = juguetesData.find(j => j.tienda_id === empleado.tienda_id);
                
                if (!juguete) {
                    showVentaMessage('El juguete no está disponible en la tienda del empleado.', 'error');
                    return;
                }
            } else {
                // Empleado especial: puede vender desde cualquier ubicación
                // Priorizar tiendas sobre bodegas, o tomar el primero disponible
                juguete = juguetesData.find(j => j.tienda_id) || juguetesData.find(j => j.bodega_id);
                
                if (!juguete) {
                    showVentaMessage('El juguete no tiene una ubicación asignada.', 'error');
                    return;
                }
            }

            // Verificar que haya suficiente cantidad
            if (juguete.cantidad < cantidad) {
                showVentaMessage(`No hay suficiente cantidad. Disponible: ${juguete.cantidad}`, 'error');
                return;
            }

            // Validar que el precio sea mayor o igual al precio mínimo
            if (juguete.precio_min !== null && juguete.precio_min !== undefined) {
                if (precio < juguete.precio_min) {
                    const precioMinFormateado = juguete.precio_min.toLocaleString('es-CO', { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 0 
                    });
                    const precioIngresadoFormateado = precio.toLocaleString('es-CO', { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 0 
                    });
                    showVentaMessage(
                        `El precio debe ser mayor o igual a $${precioMinFormateado}. Precio ingresado: $${precioIngresadoFormateado}`, 
                        'error'
                    );
                    return;
                }
            }

            // Agregar item
            ventaItems.push({
                juguete_id: juguete.id,
                juguete_nombre: juguete.nombre,
                juguete_codigo: juguete.codigo,
                juguete_item: juguete.item || null,
                juguete_foto_url: juguete.foto_url || null,
                empleado_id: empleado.id,
                empleado_nombre: empleado.nombre,
                empleado_codigo: empleado.codigo,
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
            
            // Limpiar campos
            jugueteCodigoInput.value = '';
            empleadoCodigoInput.value = '';
            document.getElementById('ventaCantidad').value = '1';
            const precioInput = document.getElementById('ventaPrecio');
            if (precioInput) {
                precioInput.value = '';
                precioInput.dataset.numericValue = '';
            }
            document.getElementById('ventaMetodoPago').value = '';
            const jugueteInfo = document.getElementById('jugueteInfo');
            const empleadoInfo = document.getElementById('empleadoInfo');
            if (jugueteInfo) jugueteInfo.style.display = 'none';
            if (empleadoInfo) empleadoInfo.style.display = 'none';

            showVentaMessage('Item agregado correctamente', 'success');
        } catch (error) {
            console.error('Error al agregar item:', error);
            showVentaMessage('Error al agregar item: ' + error.message, 'error');
        }
    });


    // Registrar venta
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (ventaItems.length === 0) {
            showVentaMessage('Debes agregar al menos un item a la venta', 'error');
            return;
        }

        // El formulario ya debería tener novalidate y los campos sin required
        // si hay items (manejado en updateVentaItemsList)
        // Pero por si acaso, asegurémonos de que no haya validación HTML5
        if (!form.hasAttribute('novalidate')) {
            form.setAttribute('novalidate', 'novalidate');
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Generar un solo código de venta para todos los items
                const codigoVenta = await generarCodigoVenta();
                
            // Registrar cada item como parte de la misma venta
            for (const item of ventaItems) {
                const cantidad = item.cantidad || 1;
                
                // Obtener juguete actual para verificar cantidad
                const { data: juguete, error: jugueteError } = await window.supabaseClient
                    .from('juguetes')
                    .select('cantidad')
                    .eq('id', item.juguete_id)
                    .limit(1);

                if (jugueteError) throw jugueteError;
                if (!juguete || juguete.length === 0 || juguete[0].cantidad < cantidad) {
                    throw new Error(`No hay suficiente cantidad del juguete ${item.juguete_nombre}`);
                }

                // Registrar venta
                const { error } = await window.supabaseClient
                    .from('ventas')
                    .insert({
                        codigo_venta: codigoVenta,
                        juguete_id: item.juguete_id,
                        empleado_id: item.empleado_id,
                        precio_venta: item.precio * cantidad,
                        cantidad: cantidad,
                        metodo_pago: item.metodo_pago,
                        empresa_id: user.empresa_id
                    });

                if (error) throw error;

                // Reducir cantidad del juguete
                    await window.supabaseClient
                        .from('juguetes')
                    .update({ cantidad: juguete[0].cantidad - cantidad })
                        .eq('id', item.juguete_id);
            }

            showVentaMessage('Venta registrada correctamente', 'success');
            ventaItems = [];
            updateVentaItemsList(); // Esto restaurará los atributos required automáticamente
            form.reset();
            
            // Recargar resumen
            if (typeof loadDashboardSummary === 'function') {
                loadDashboardSummary();
            }
        } catch (error) {
            console.error('Error al registrar venta:', error);
            showVentaMessage('Error al registrar la venta: ' + error.message, 'error');
        }
    });

    // Botón facturar - ahora permite facturar ventas ya registradas
    facturarBtn.addEventListener('click', async function() {
        // Si hay items en la venta actual, facturar esos items
        if (ventaItems.length > 0) {
            showFacturarView();
            return;
        }
        
        // Si no hay items, mostrar lista de ventas registradas para facturar
        await showVentasParaFacturar();
    });
}

// Función global para remover item
window.removeVentaItem = function(index) {
    ventaItems.splice(index, 1);
    updateVentaItemsList();
};

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
                <small>Precio Unitario: $${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} | Cantidad: ${cantidad} | Empleado: ${item.empleado_nombre} | Método: ${item.metodo_pago}</small>
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
                <strong style="color: #10b981; font-size: 20px;">$${totalVenta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong>
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
    
    setTimeout(() => {
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
    }, 5000);
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
        
        // Buscar ventas que NO han sido facturadas
        const { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
            .eq('empresa_id', user.empresa_id)
            .eq('facturada', false) // Solo ventas no facturadas
            .order('created_at', { ascending: false })
            .limit(50); // Últimas 50 ventas

        if (error) throw error;

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
                                    <strong style="color: #10b981; font-size: 18px;">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong>
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
        
        // Obtener todas las ventas con ese código que NO estén facturadas
        const { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
            .eq('codigo_venta', codigoVenta)
            .eq('empresa_id', user.empresa_id)
            .eq('facturada', false); // Solo ventas no facturadas

        if (error) throw error;

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
                <td>$${precioBase.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                <td>${item.cantidad}</td>
                <td>$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
        }).join('');
        
        // Actualizar totales con IVA
        const facturaIvaElement = document.getElementById('facturaIva');
        const facturaTotalElement = document.getElementById('facturaTotal');
        if (facturaIvaElement) {
            facturaIvaElement.textContent = '$' + ivaTotal.toLocaleString('es-CO', { minimumFractionDigits: 2 });
        }
        if (facturaTotalElement) {
            facturaTotalElement.textContent = '$' + totalConIva.toLocaleString('es-CO', { minimumFractionDigits: 2 });
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
            <td>$${precioBase.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            <td>${cantidad}</td>
            <td>$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;
    }).join('');
    
    // Actualizar totales con IVA
    const facturaIvaElement = document.getElementById('facturaIva');
    const facturaTotalElement = document.getElementById('facturaTotal');
    if (facturaIvaElement) {
        facturaIvaElement.textContent = '$' + ivaTotal.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    }
    if (facturaTotalElement) {
        facturaTotalElement.textContent = '$' + totalConIva.toLocaleString('es-CO', { minimumFractionDigits: 2 });
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
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
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
            
            // Crear factura
            const { data: factura, error: facturaError } = await window.supabaseClient
                .from('facturas')
                .insert({
                    codigo_factura: currentFacturaData.codigo_factura,
                    cliente_nombre: clienteNombre,
                    cliente_documento: clienteDocumento,
                    cliente_email: clienteEmail,
                    total: currentFacturaData.total,
                    empresa_id: user.empresa_id
                })
                .select()
                .single();
            
            if (facturaError) throw facturaError;
            
            // Crear items de factura
            for (const item of currentFacturaData.items) {
                const cantidad = item.cantidad || 1;
                const precio = item.precio || 0;
                const subtotal = item.subtotal || (precio * cantidad);
                
                await window.supabaseClient
                    .from('facturas_items')
                    .insert({
                        factura_id: factura.id,
                        juguete_nombre: item.juguete_nombre,
                        juguete_codigo: item.juguete_codigo,
                        precio: precio,
                        cantidad: cantidad,
                        subtotal: subtotal
                    });
            }
            
            // Marcar las ventas como facturadas para evitar que se facturen nuevamente
            if (currentFacturaData.codigo_venta) {
                const { error: updateError } = await window.supabaseClient
                    .from('ventas')
                    .update({ facturada: true })
                    .eq('codigo_venta', currentFacturaData.codigo_venta)
                    .eq('empresa_id', user.empresa_id)
                    .eq('facturada', false); // Solo actualizar las que no estén facturadas
                
                if (updateError) {
                    console.error('Error al marcar ventas como facturadas:', updateError);
                    // No lanzar error aquí, la factura ya se creó
                }
            }
            
            // Enviar correo electrónico con la factura
            try {
                await enviarFacturaPorCorreo(clienteEmail, clienteNombre, clienteDocumento, currentFacturaData, factura.id);
                showFacturaMessage('Factura creada y enviada por correo correctamente.', 'success');
            } catch (emailError) {
                console.error('Error al enviar correo:', emailError);
                showFacturaMessage('Factura creada correctamente, pero hubo un error al enviar el correo: ' + emailError.message, 'error');
            }
            
            setTimeout(() => {
                document.getElementById('facturarView').style.display = 'none';
                document.getElementById('ventaView').style.display = 'block';
                form.reset();
                ventaItems = [];
                currentFacturaData = null;
            }, 2000);
            
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
async function enviarFacturaPorCorreo(clienteEmail, clienteNombre, clienteDocumento, facturaData, facturaId) {
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
                <td style="padding: 10px 8px; text-align: right; color: #1e293b; font-size: 13px;">$${precioBase.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 600; font-size: 13px;">${cantidad}</td>
                <td style="padding: 10px 8px; text-align: right; color: #10b981; font-weight: 700; font-size: 14px;">$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');
    
    // Calcular totales
    const totalConIva = facturaData.total; // Total con IVA (precio original ingresado)
    const totalBase = facturaData.items.reduce((sum, item) => {
        const cantidad = item.cantidad || 1;
        const precioConIva = item.precio || 0;
        const precioBase = precioConIva / 1.19;
        return sum + (precioBase * cantidad);
    }, 0);
    const ivaTotal = totalConIva - totalBase;

    const fecha = new Date().toLocaleString('es-CO');
    const fechaISO = new Date().toISOString();
    // URL del logo - debe ser accesible públicamente
    const logoUrl = 'https://i.imgur.com/RBbjVnp.jpeg';
    
    // Verificar que el logo URL sea válida
    if (!logoUrl || logoUrl.trim() === '') {
        console.warn('Logo URL no definida, usando placeholder');
    }
    
    // Generar XML de la factura
    const facturaXML = generarXMLFactura(facturaData, clienteNombre, clienteDocumento, clienteEmail, fechaISO, totalConIva, totalBase, ivaTotal);
    const xmlBase64 = btoa(unescape(encodeURIComponent(facturaXML)));
    
    // Subir XML a Supabase Storage para crear un enlace de descarga directa
    let xmlDownloadUrl = null;
    try {
        const fileName = `facturas/factura_${facturaData.codigo_factura}_${Date.now()}.xml`;
        const xmlBlob = new Blob([facturaXML], { type: 'application/xml;charset=utf-8' });
        
        // Subir a Supabase Storage
        const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
            .from('facturas') // Bucket para facturas
            .upload(fileName, xmlBlob, {
                contentType: 'application/xml',
                upsert: false
            });
        
        if (!uploadError && uploadData) {
            // Obtener URL pública del archivo
            const { data: urlData } = window.supabaseClient.storage
                .from('facturas')
                .getPublicUrl(fileName);
            
            if (urlData) {
                xmlDownloadUrl = urlData.publicUrl;
                console.log('XML subido exitosamente a Supabase Storage:', xmlDownloadUrl);
            }
        } else {
            console.warn('No se pudo subir XML a Supabase Storage, usando método alternativo:', uploadError);
        }
    } catch (storageError) {
        console.warn('Error al subir XML a Supabase Storage, usando método alternativo:', storageError);
        // Continuar sin el enlace de descarga directa
    }
    
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
                                    <td style="text-align: right; padding: 12px 10px; color: #64748b; font-size: 15px; font-weight: 600;">$${ivaTotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right; padding: 15px 10px; color: #1e293b; font-size: 16px; font-weight: 700;">TOTAL A PAGAR:</td>
                                    <td style="text-align: right; padding: 15px 10px; color: #10b981; font-size: 20px; font-weight: 700;">$${totalConIva.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
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
            return `${index + 1}. ${item.juguete_nombre} (${item.juguete_codigo}) - Cantidad: ${cantidad} x $${precio.toLocaleString('es-CO', { minimumFractionDigits: 2 })} = $${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
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
            factura_total: `$${facturaData.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
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
    const select = document.getElementById('empleadoTienda');
    if (!select) return;
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const { data: tiendas, error } = await window.supabaseClient
            .from('tiendas')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .order('nombre');

        if (error) throw error;

        select.innerHTML = '<option value="">Sin tienda asignada</option>';
        if (tiendas) {
            tiendas.forEach(tienda => {
                const option = document.createElement('option');
                option.value = tienda.id;
                option.textContent = tienda.nombre;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error al cargar tiendas:', error);
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
                *,
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

// Variable global para almacenar juguetes disponibles en abastecer
let juguetesDisponiblesAbastecer = [];

async function loadJuguetesDisponibles() {
    const origenTipo = document.getElementById('origenTipo').value;
    const origenId = document.getElementById('origenSelect').value;
    const container = document.getElementById('juguetesDisponiblesList');
    const buscarInput = document.getElementById('buscarJugueteAbastecer');

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

        container.innerHTML = juguetes.map(juguete => `
            <div class="juguete-movimiento-item">
                <div class="juguete-info">
                    <strong>${juguete.nombre}</strong> (${juguete.codigo})
                    <br><small>Cantidad disponible: ${juguete.cantidad}</small>
                </div>
                <div class="juguete-cantidad">
                    <input 
                        type="number" 
                        class="cantidad-input" 
                        data-juguete-id="${juguete.id}"
                        min="1" 
                        max="${juguete.cantidad}" 
                        value="1"
                        placeholder="Cantidad"
                    >
                </div>
            </div>
        `).join('');
}

// Función para filtrar juguetes por nombre o código
window.filtrarJuguetesAbastecer = function() {
    const buscarInput = document.getElementById('buscarJugueteAbastecer');
    const termino = buscarInput ? buscarInput.value.toLowerCase().trim() : '';
    
    if (!termino) {
        // Si no hay término de búsqueda, mostrar todos
        renderizarJuguetesAbastecer(juguetesDisponiblesAbastecer);
        return;
    }
    
    // Filtrar por nombre o código
    const juguetesFiltrados = juguetesDisponiblesAbastecer.filter(juguete => {
        const nombre = (juguete.nombre || '').toLowerCase();
        const codigo = (juguete.codigo || '').toLowerCase();
        return nombre.includes(termino) || codigo.includes(termino);
    });
    
    renderizarJuguetesAbastecer(juguetesFiltrados);
}

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
    
    // Obtener juguetes con cantidad > 0
    const inputs = document.querySelectorAll('.cantidad-input');
    const juguetesSeleccionados = [];
    
    inputs.forEach(input => {
        const cantidad = parseInt(input.value) || 0;
        if (cantidad > 0) {
            const jugueteId = input.dataset.jugueteId;
            const juguete = juguetesDisponiblesAbastecer.find(j => j.id == jugueteId);
            if (juguete) {
                juguetesSeleccionados.push({
                    juguete_id: juguete.id,
                    nombre: juguete.nombre,
                    codigo: juguete.codigo,
                    cantidad: cantidad
                });
            }
        }
    });
    
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
    
    // Generar HTML del plan
    const planHTML = `
        <div id="planParaImprimir" style="background: white; padding: 20px; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
                <h2 style="margin: 0 0 5px 0; color: #1e293b;">📦 Plan de Movimiento de Inventario</h2>
                <p style="margin: 0; color: #64748b; font-size: 14px;">${fechaActual}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0 0 5px 0; color: #92400e; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                        <i class="fas fa-arrow-right"></i> ORIGEN
                    </p>
                    <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: bold;">${origenNombre}</p>
                    <p style="margin: 0; color: #64748b; font-size: 12px;">${origenTipoTexto}</p>
                </div>
                <div style="background: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                    <p style="margin: 0 0 5px 0; color: #065f46; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                        <i class="fas fa-arrow-left"></i> DESTINO
                    </p>
                    <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: bold;">${destinoNombre}</p>
                    <p style="margin: 0; color: #64748b; font-size: 12px;">${destinoTipoTexto}</p>
                </div>
            </div>
            
            <h4 style="margin: 0 0 10px 0; color: #1e293b;">
                <i class="fas fa-list"></i> Juguetes a Mover (${juguetesSeleccionados.length})
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
                    ${juguetesSeleccionados.map((j, index) => `
                        <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 0 ? 'background: #fafafa;' : ''}">
                            <td style="padding: 12px 8px;">
                                <div style="width: 20px; height: 20px; border: 2px solid #cbd5e1; border-radius: 4px;"></div>
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
                            ${planActualData.total_unidades}
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
};

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

// Función para ejecutar un plan de movimiento
window.ejecutarPlanMovimiento = async function(planId) {
    if (!confirm('¿Estás seguro de que deseas ejecutar este plan de movimiento?\n\nEsto moverá los juguetes del origen al destino en el sistema.')) {
        return;
    }
    
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
        
        const items = plan.items || [];
        let itemsProcesados = 0;
        
        // Procesar cada item del plan
        for (const item of items) {
            try {
                // Obtener juguete actual del origen
                const { data: jugueteActualData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('id', item.juguete_id)
                    .limit(1);

                if (!jugueteActualData || jugueteActualData.length === 0) {
                    console.warn(`Juguete ${item.nombre} no encontrado, saltando...`);
                    continue;
                }

                const jugueteActual = jugueteActualData[0];

                if (jugueteActual.cantidad < item.cantidad) {
                    console.warn(`No hay suficiente cantidad del juguete ${jugueteActual.nombre}`);
                    continue;
                }

                // Verificar si existe en destino
                const campoDestino = plan.tipo_destino === 'bodega' ? 'bodega_id' : 'tienda_id';
                const { data: jugueteExistenteData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', jugueteActual.codigo)
                    .eq('nombre', jugueteActual.nombre)
                    .eq('empresa_id', user.empresa_id)
                    .eq(campoDestino, plan.destino_id)
                    .limit(1);

                // Reducir cantidad en origen
                const nuevaCantidadOrigen = jugueteActual.cantidad - item.cantidad;
                
                if (nuevaCantidadOrigen <= 0) {
                    await window.supabaseClient
                        .from('juguetes')
                        .delete()
                        .eq('id', jugueteActual.id);
                } else {
                    await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: nuevaCantidadOrigen })
                        .eq('id', jugueteActual.id);
                }

                // Agregar en destino
                if (jugueteExistenteData && jugueteExistenteData.length > 0) {
                    const jugueteExistente = jugueteExistenteData[0];
                    await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: jugueteExistente.cantidad + item.cantidad })
                        .eq('id', jugueteExistente.id);
                } else {
                    const nuevoJuguete = {
                        nombre: jugueteActual.nombre,
                        codigo: jugueteActual.codigo,
                        cantidad: item.cantidad,
                        foto_url: jugueteActual.foto_url,
                        empresa_id: user.empresa_id
                    };
                    
                    if (plan.tipo_destino === 'bodega') {
                        nuevoJuguete.bodega_id = plan.destino_id;
                        nuevoJuguete.tienda_id = null;
                    } else {
                        nuevoJuguete.tienda_id = plan.destino_id;
                        nuevoJuguete.bodega_id = null;
                    }
                    
                    await window.supabaseClient
                        .from('juguetes')
                        .insert(nuevoJuguete);
                }

                // Registrar movimiento
                await window.supabaseClient
                    .from('movimientos')
                    .insert({
                        tipo_origen: plan.tipo_origen,
                        origen_id: plan.origen_id,
                        tipo_destino: plan.tipo_destino,
                        destino_id: plan.destino_id,
                        juguete_id: item.juguete_id,
                        cantidad: item.cantidad,
                        empresa_id: user.empresa_id
                    });

                itemsProcesados++;
            } catch (itemError) {
                console.error('Error procesando item:', itemError);
            }
        }
        
        // Actualizar estado del plan
        await window.supabaseClient
            .from('planes_movimiento')
            .update({
                estado: 'ejecutado',
                ejecutado_por: user.nombre,
                ejecutado_at: new Date().toISOString()
            })
            .eq('id', planId);
        
        alert(`Plan ejecutado correctamente. ${itemsProcesados} de ${items.length} items procesados.`);
        
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

// Función para ver detalle de un plan
window.verDetallePlan = async function(planId) {
    try {
        const { data: plan, error } = await window.supabaseClient
            .from('planes_movimiento')
            .select('*')
            .eq('id', planId)
            .single();
        
        if (error) throw error;
        
        const items = plan.items || [];
        const fecha = new Date(plan.created_at).toLocaleString('es-CO');
        
        const detalleHTML = `
            <div style="max-width: 600px; margin: 0 auto;">
                <h3 style="color: #6366f1; margin-bottom: 20px;">${plan.codigo_plan}</h3>
                <p><strong>Fecha:</strong> ${fecha}</p>
                <p><strong>Estado:</strong> ${plan.estado.toUpperCase()}</p>
                <p><strong>Creado por:</strong> ${plan.creado_por || 'N/A'}</p>
                ${plan.ejecutado_por ? `<p><strong>Ejecutado por:</strong> ${plan.ejecutado_por}</p>` : ''}
                
                <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px;">
                    <p><strong>Origen:</strong> ${plan.origen_nombre} (${plan.tipo_origen})</p>
                    <p><strong>Destino:</strong> ${plan.destino_nombre} (${plan.tipo_destino})</p>
                </div>
                
                <h4>Items (${items.length}):</h4>
                <ul style="list-style: none; padding: 0;">
                    ${items.map(i => `
                        <li style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                            <strong>${i.nombre}</strong> (${i.codigo}) - ${i.cantidad} unidades
                        </li>
                    `).join('')}
                </ul>
                
                <p style="margin-top: 15px;"><strong>Total:</strong> ${plan.total_unidades} unidades</p>
            </div>
        `;
        
        // Mostrar en modal o alert
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; max-width: 90%; max-height: 90%; overflow: auto;">
                ${detalleHTML}
                <button onclick="this.closest('div').parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Cerrar
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error al cargar detalle:', error);
        alert('Error al cargar detalle del plan');
    }
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
    
    setTimeout(() => {
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
    }, 5000);
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
        document.getElementById('gananciasTotales').textContent = '$' + ganancias.toLocaleString('es-CO', { minimumFractionDigits: 2 });

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
                    'Total': f.total ? parseFloat(f.total).toLocaleString('es-CO', { minimumFractionDigits: 2 }) : '0.00',
                    'Fecha': f.created_at ? new Date(f.created_at).toLocaleString('es-CO') : ''
                }));
                filename = 'facturas.xlsx';
                break;
            case 'ventas':
                const { data: ventas, error: errorVentas } = await window.supabaseClient
                    .from('ventas')
                    .select(`
                        codigo_venta, 
                        precio_venta, 
                        cantidad,
                        metodo_pago, 
                        created_at,
                        juguetes(nombre, codigo),
                        empleados(nombre, codigo)
                    `)
                    .eq('empresa_id', user.empresa_id);
                
                if (errorVentas) throw errorVentas;
                
                // Formatear datos para Excel
                data = (ventas || []).map(v => ({
                    'Código Venta': v.codigo_venta || '',
                    'Juguete': v.juguetes?.nombre || '',
                    'Código Juguete': v.juguetes?.codigo || '',
                    'Cantidad': v.cantidad || 1,
                    'Precio Unitario': v.precio_venta ? parseFloat(v.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2 }) : '0.00',
                    'Total': v.precio_venta ? parseFloat(v.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2 }) : '0.00',
                    'Método de Pago': v.metodo_pago || '',
                    'Empleado': v.empleados?.nombre || v.empleados?.codigo || '',
                    'Fecha': v.created_at ? new Date(v.created_at).toLocaleString('es-CO') : ''
                }));
                filename = 'ventas.xlsx';
                break;
            case 'movimientos':
                const { data: movimientos, error: errorMovimientos } = await window.supabaseClient
                    .from('movimientos')
                    .select(`
                        tipo_origen, 
                        origen_id, 
                        tipo_destino, 
                        destino_id, 
                        cantidad, 
                        created_at,
                        juguetes(nombre, codigo)
                    `)
                    .eq('empresa_id', user.empresa_id);
                
                if (errorMovimientos) throw errorMovimientos;
                
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

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initRegistrarVenta();
        initFacturar();
        loadTiendasForEmpleados();
        // Asegurar que los formularios de usuarios y tiendas tengan listeners
        setupUsuarioForm();
        setupTiendaForm();
    });
} else {
    initRegistrarVenta();
    initFacturar();
    loadTiendasForEmpleados();
    setupUsuarioForm();
    setupTiendaForm();
}

// Función para configurar formulario de usuarios
function setupUsuarioForm() {
const nuevoUsuarioForm = document.getElementById('nuevoUsuarioForm');
    if (nuevoUsuarioForm && !nuevoUsuarioForm.hasAttribute('data-listener-added')) {
        nuevoUsuarioForm.setAttribute('data-listener-added', 'true');
    nuevoUsuarioForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
            const nombre = capitalizarPrimeraLetra(document.getElementById('usuarioNombre').value.trim());
        const email = document.getElementById('usuarioEmail').value.trim();
        const password = document.getElementById('usuarioPassword').value;
        const tipoUsuarioId = parseInt(document.getElementById('usuarioTipo').value);
        
        if (!nombre || !email || !password || !tipoUsuarioId) {
            showUsuarioMessage('Por favor, completa todos los campos', 'error');
            return;
        }
            
            // Validar que la contraseña tenga al menos 3 caracteres
            if (password.length < 3) {
                showUsuarioMessage('La contraseña debe tener al menos 3 caracteres', 'error');
                return;
            }

        try {
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
            showUsuarioMessage('Error al agregar el usuario: ' + error.message, 'error');
        }
    });
    }
}

// Función para configurar formulario de tiendas
function setupTiendaForm() {
    const nuevaTiendaForm = document.getElementById('nuevaTiendaForm');
    if (nuevaTiendaForm && !nuevaTiendaForm.hasAttribute('data-listener-added')) {
        nuevaTiendaForm.setAttribute('data-listener-added', 'true');
        nuevaTiendaForm.addEventListener('submit', async function(e) {
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
            .select('*')
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
    editUsuarioForm.addEventListener('submit', async function(e) {
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
        const { error } = await window.supabaseClient
            .from('usuarios')
            .delete()
            .eq('id', usuarioId);

        if (error) throw error;

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
    
    setTimeout(() => {
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
    }, 5000);
}

// Manejar clicks en el menú de tiendas
document.addEventListener('click', function(e) {
    if (e.target.closest('.menu-toggle[data-tienda-id]')) {
        const menuToggle = e.target.closest('.menu-toggle');
        const tiendaId = menuToggle.getAttribute('data-tienda-id');
        const menu = document.getElementById(`menu-tienda-${tiendaId}`);
        
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            if (m.id !== `menu-tienda-${tiendaId}`) {
                m.style.display = 'none';
            }
        });
        
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
    
    if (e.target.closest('.dropdown-item[data-tienda-id]')) {
        const item = e.target.closest('.dropdown-item');
        const action = item.getAttribute('data-action');
        const tiendaId = item.getAttribute('data-tienda-id');
        
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.style.display = 'none';
        });
        
        if (action === 'edit') {
            openEditTiendaModal(tiendaId);
        } else if (action === 'delete') {
            deleteTienda(tiendaId);
        }
    }
});

// Abrir modal para editar tienda
async function openEditTiendaModal(tiendaId) {
    try {
        const { data: tienda, error } = await window.supabaseClient
            .from('tiendas')
            .select('*')
            .eq('id', tiendaId)
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
    editTiendaForm.addEventListener('submit', async function(e) {
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

// Eliminar tienda
async function deleteTienda(tiendaId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tienda? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('tiendas')
            .delete()
            .eq('id', tiendaId);

        if (error) throw error;

        alert('Tienda eliminada correctamente');
        loadTiendas();
    } catch (error) {
        console.error('Error al eliminar tienda:', error);
        alert('Error al eliminar la tienda: ' + error.message);
    }
}

// ============================================
// CORRECCIÓN DE ABASTECER
// ============================================

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

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const origenTipoVal = origenTipo.value;
        const origenId = parseInt(origenSelect.value);
        const destinoTipoVal = destinoTipo.value;
        const destinoId = parseInt(destinoSelect.value);
        
        if (!origenTipoVal || !origenId || !destinoTipoVal || !destinoId) {
            showAbastecerMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        // Obtener juguetes seleccionados con cantidad
        const juguetesSeleccionados = Array.from(document.querySelectorAll('.cantidad-input'))
            .map(input => ({
                id: parseInt(input.dataset.jugueteId),
                cantidad: parseInt(input.value) || 0
            }))
            .filter(j => j.cantidad > 0);

        if (juguetesSeleccionados.length === 0) {
            showAbastecerMessage('Debes seleccionar al menos un juguete con cantidad mayor a 0', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            for (const juguete of juguetesSeleccionados) {
                // Obtener juguete actual del origen
                const { data: jugueteActualData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('id', juguete.id)
                    .limit(1);

                if (!jugueteActualData || jugueteActualData.length === 0) {
                    showAbastecerMessage(`Juguete no encontrado`, 'error');
                    continue;
                }

                const jugueteActual = jugueteActualData[0];

                if (jugueteActual.cantidad < juguete.cantidad) {
                    showAbastecerMessage(`No hay suficiente cantidad del juguete ${jugueteActual.nombre || ''}`, 'error');
                    continue;
                }

                // Verificar si ya existe un juguete con el mismo código Y nombre en el destino
                const campoDestino = destinoTipoVal === 'bodega' ? 'bodega_id' : 'tienda_id';
                const { data: jugueteExistenteData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', jugueteActual.codigo)
                    .eq('nombre', jugueteActual.nombre)
                    .eq('empresa_id', user.empresa_id)
                    .eq(campoDestino, destinoId)
                    .limit(1);

                // PRIMERO: Reducir cantidad en origen (o eliminar si llega a 0)
                const nuevaCantidadOrigen = jugueteActual.cantidad - juguete.cantidad;
                
                if (nuevaCantidadOrigen <= 0) {
                    // Si la cantidad llega a 0 o menos, eliminar el registro del origen
                    await window.supabaseClient
                        .from('juguetes')
                        .delete()
                        .eq('id', juguete.id);
                } else {
                    // Actualizar cantidad en origen
                    await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: nuevaCantidadOrigen })
                        .eq('id', juguete.id);
                }

                // SEGUNDO: Aumentar cantidad en destino (o crear nuevo registro si no existe)
                if (jugueteExistenteData && jugueteExistenteData.length > 0) {
                    // Si ya existe un juguete con el mismo código en el destino, sumar la cantidad
                    const jugueteExistente = jugueteExistenteData[0];
                    const nuevaCantidadDestino = jugueteExistente.cantidad + juguete.cantidad;
                    
                    await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: nuevaCantidadDestino })
                        .eq('id', jugueteExistente.id);
                } else {
                    // Si no existe, crear un nuevo registro en el destino
                    const nuevoJugueteData = {
                        nombre: jugueteActual.nombre,
                        codigo: jugueteActual.codigo,
                        cantidad: juguete.cantidad,
                        empresa_id: user.empresa_id,
                        foto_url: jugueteActual.foto_url || null
                    };
                    
                    if (destinoTipoVal === 'bodega') {
                        nuevoJugueteData.bodega_id = destinoId;
                        nuevoJugueteData.tienda_id = null;
                    } else {
                        nuevoJugueteData.tienda_id = destinoId;
                        nuevoJugueteData.bodega_id = null;
                    }
                    
                    await window.supabaseClient
                        .from('juguetes')
                        .insert(nuevoJugueteData);
                }

                // TERCERO: Crear registro de movimiento (solo para auditoría)
                await window.supabaseClient
                    .from('movimientos')
                    .insert({
                        tipo_origen: origenTipoVal,
                        origen_id: origenId,
                        tipo_destino: destinoTipoVal,
                        destino_id: destinoId,
                        juguete_id: juguete.id,
                        cantidad: juguete.cantidad,
                        empresa_id: user.empresa_id
                    });
            }

            showAbastecerMessage('Movimiento realizado correctamente', 'success');
            form.reset();
            document.getElementById('juguetesDisponiblesList').innerHTML = '';
            
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
        } catch (error) {
            console.error('Error al realizar movimiento:', error);
            showAbastecerMessage('Error al realizar el movimiento: ' + error.message, 'error');
        }
    });
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
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
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
                                <td>$${parseFloat(v.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
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
                    <p class="stat-number" style="color: #059669; font-size: 32px;">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</p>
                </div>
                <div class="stat-card" style="text-align: center;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #64748b;">Total Ventas</h3>
                    <p class="stat-number" style="color: #667eea; font-size: 32px;">${ventas.length}</p>
                </div>
                <div class="stat-card" style="text-align: center;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: #64748b;">Promedio por Venta</h3>
                    <p class="stat-number" style="color: #764ba2; font-size: 32px;">$${promedio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</p>
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
        
        // Cargar ventas recientes
        const { data: ventasRecientes } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false })
            .limit(10);

        const ventasList = document.getElementById('ajustesVentasRecientes');
        if (ventasList) {
            if (ventasRecientes && ventasRecientes.length > 0) {
                ventasList.innerHTML = ventasRecientes.map(v => `
                    <div class="venta-item">
                        <div class="venta-info">
                            <strong>${v.juguetes?.nombre || 'N/A'}</strong>
                            <span>${v.codigo_venta || 'Sin código'} - ${new Date(v.created_at).toLocaleString('es-CO')}</span>
                        </div>
                        <div class="venta-precio">$${parseFloat(v.precio_venta || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
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
        
        // Buscar todas las ventas con ese código
        const { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(id, nombre, codigo, cantidad, bodega_id, tienda_id),
                empleados(nombre, codigo)
            `)
            .eq('codigo_venta', codigoVenta)
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

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
                        <p style="color: #64748b; margin: 5px 0;"><strong>Total Venta:</strong> <span style="color: #10b981; font-weight: bold; font-size: 18px;">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span></p>
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
                                <th>Cantidad</th>
                                <th>Precio Unitario</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ventas.map(venta => {
                                const cantidad = venta.cantidad || 1;
                                const precioUnitario = parseFloat(venta.precio_venta) / cantidad;
                                return `
                                    <tr>
                                        <td style="text-align: center;">
                                            <input type="checkbox" class="item-devolucion-checkbox" 
                                                data-venta-id="${venta.id}" 
                                                data-precio="${venta.precio_venta}"
                                                onchange="toggleSeleccionItem()">
                                        </td>
                                        <td>${venta.juguetes?.nombre || 'N/A'}</td>
                                        <td>${venta.juguetes?.codigo || 'N/A'}</td>
                                        <td>${cantidad}</td>
                                        <td>$${precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                                        <td>$${parseFloat(venta.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
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
        if (cb.checked) {
            totalSeleccionado += parseFloat(cb.dataset.precio || 0);
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
        totalSeleccionadoEl.innerHTML = `<strong>Total Seleccionado:</strong> <span style="color: #ef4444; font-weight: bold;">$${totalSeleccionado.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span> (${itemsSeleccionados} item${itemsSeleccionados !== 1 ? 's' : ''})`;
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
    
    // Obtener los IDs de las ventas seleccionadas
    const idsVentas = Array.from(checkboxes).map(cb => cb.dataset.ventaId);
    
    // Llamar a procesarDevolucion con los IDs específicos
    await procesarDevolucion(codigoVenta, idsVentas);
};

// Función global para procesar devolución
window.procesarDevolucion = async function(codigoVenta, idsVentas = null) {
    // Mensaje de confirmación diferente según si es selectiva o total
    const esSelectiva = idsVentas && idsVentas.length > 0;
    const mensajeConfirmacion = esSelectiva 
        ? `¿Estás seguro de que deseas devolver ${idsVentas.length} item(s) seleccionado(s)?\n\nEsta acción:\n- Agregará los juguetes seleccionados al inventario\n- Eliminará los items seleccionados de la venta\n\nEsta acción no se puede deshacer.`
        : '¿Estás seguro de que deseas procesar la devolución COMPLETA?\n\nEsta acción:\n- Agregará TODOS los juguetes nuevamente al inventario\n- Eliminará la venta completa del sistema\n\nEsta acción no se puede deshacer.';
    
    if (!confirm(mensajeConfirmacion)) {
        return;
    }

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Obtener las ventas según si es selectiva o total
        let query = window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('empresa_id', user.empresa_id);
        
        // Si hay IDs específicos, filtrar por ellos; si no, por código de venta
        if (esSelectiva) {
            query = query.in('id', idsVentas);
        } else {
            query = query.eq('codigo_venta', codigoVenta);
        }
        
        const { data: ventas, error: ventasError } = await query;
        
        // Si hay ventas, cargar juguetes por separado
        if (!ventasError && ventas && ventas.length > 0) {
            const jugueteIds = [...new Set(ventas.map(v => v.juguete_id))];
            const { data: juguetesData } = await window.supabaseClient
                .from('juguetes')
                .select('id, nombre, codigo, cantidad, bodega_id, tienda_id, empresa_id')
                .in('id', jugueteIds);
            
            const juguetesMap = new Map((juguetesData || []).map(j => [j.id, j]));
            ventas.forEach(v => {
                v.juguetes = juguetesMap.get(v.juguete_id) || null;
            });
        }

        if (ventasError) throw ventasError;

        if (!ventas || ventas.length === 0) {
            showAjustesMessage('No se encontraron ventas para procesar', 'error');
            return;
        }

        let ventasProcesadas = 0;
        let ventasEliminadas = 0;
        const ventasIds = ventas.map(v => v.id);

        // Procesar cada venta
        for (const venta of ventas) {
            // Verificar que la venta aún existe (por si ya fue eliminada)
            const { data: ventaVerificada, error: verificarError } = await window.supabaseClient
                .from('ventas')
                .select('id')
                .eq('id', venta.id)
                .single();

            if (verificarError || !ventaVerificada) {
                console.warn(`La venta ${venta.id} ya no existe, saltando...`);
                continue;
            }

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

                // Verificar que se eliminó
                const { data: ventaEliminada } = await window.supabaseClient
                    .from('ventas')
                    .select('id')
                    .eq('id', venta.id)
                    .single();

                if (!ventaEliminada) {
                    ventasEliminadas++;
                    console.log(`Venta ${venta.id} eliminada correctamente`);
                } else {
                    throw new Error(`No se pudo eliminar la venta ${venta.id}`);
                }
                continue;
            }

            const cantidadDevolver = venta.cantidad || 1;

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

            // Eliminar la venta (esto debe hacerse después de procesar el juguete)
            const { error: deleteError, data: deleteData } = await window.supabaseClient
                .from('ventas')
                .delete()
                .eq('id', venta.id)
                .select();

            if (deleteError) {
                console.error('Error al eliminar venta:', deleteError);
                throw deleteError;
            }

            // Verificar que la venta fue eliminada
            const { data: ventaEliminada } = await window.supabaseClient
                .from('ventas')
                .select('id')
                .eq('id', venta.id)
                .single();

            if (ventaEliminada) {
                throw new Error(`La venta ${venta.id} no se eliminó correctamente`);
            }

            ventasProcesadas++;
            ventasEliminadas++;
            console.log(`Venta ${venta.id} procesada y eliminada correctamente`);
        }

        if (ventasEliminadas === 0) {
            throw new Error('No se eliminó ninguna venta. Verifica las políticas RLS en Supabase.');
        }

        const mensajeExito = esSelectiva 
            ? `Devolución selectiva procesada correctamente. ${ventasEliminadas} item(s) devuelto(s) y agregados nuevamente al inventario.`
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
};

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
    
    setTimeout(() => {
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
    }, 5000);
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
                                return `Total: $${context.parsed.y.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
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
                                return `Total: $${context.parsed.y.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
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
                <p><strong>Día con más ventas:</strong> <span style="color: #10b981;">Día ${diaMax}</span> (${cantidadMax} juguetes - $${ventasPorDia[diaMax].total.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</p>
                <p><strong>Día con menos ventas:</strong> <span style="color: ${cantidadMin === 0 ? '#ef4444' : '#f59e0b'};">Día ${diaMin}</span> (${cantidadMin} juguetes - $${ventasPorDia[diaMin].total.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</p>
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
                <p><strong>Hora con más ventas:</strong> <span style="color: #10b981;">${horaMax}:00 - ${parseInt(horaMax) + 1}:00</span> (${cantidadMax} juguetes - $${ventasPorHora[horaMax].total.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</p>
                <p><strong>Hora con menos ventas:</strong> <span style="color: ${cantidadMin === 0 ? '#ef4444' : '#f59e0b'};">${horaMin}:00 - ${parseInt(horaMin) + 1}:00</span> (${cantidadMin} juguetes - $${ventasPorHora[horaMin].total.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</p>
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
        
        // Intentar cargar con relaciones primero
        let { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false });
        
        // Si falla con relaciones, cargar sin relaciones y hacer consultas separadas
        if (error) {
            console.warn('Error al cargar ventas con relaciones, usando fallback:', error);
            const { data: ventasSimples, error: errorSimple } = await window.supabaseClient
                .from('ventas')
                .select('*')
                .eq('empresa_id', user.empresa_id)
                .order('created_at', { ascending: false });
            
            if (errorSimple) throw errorSimple;
            
            // Cargar juguetes y empleados por separado
            if (ventasSimples && ventasSimples.length > 0) {
                const jugueteIds = [...new Set(ventasSimples.map(v => v.juguete_id))];
                const empleadoIds = [...new Set(ventasSimples.map(v => v.empleado_id).filter(id => id))];
                
                const [juguetesData, empleadosData] = await Promise.all([
                    jugueteIds.length > 0 ? window.supabaseClient.from('juguetes').select('id, nombre, codigo').in('id', jugueteIds) : { data: [] },
                    empleadoIds.length > 0 ? window.supabaseClient.from('empleados').select('id, nombre, codigo').in('id', empleadoIds) : { data: [] }
                ]);

                const juguetesMap = new Map((juguetesData.data || []).map(j => [j.id, j]));
                const empleadosMap = new Map((empleadosData.data || []).map(e => [e.id, e]));

                // Combinar datos
                ventas = ventasSimples.map(v => ({
                    ...v,
                    juguetes: juguetesMap.get(v.juguete_id) || null,
                    empleados: empleadosMap.get(v.empleado_id) || null
                }));
            } else {
                ventas = [];
            }
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

    

    setTimeout(() => {

        errorMsg.style.display = 'none';

        successMsg.style.display = 'none';

    }, 5000);

}



// Manejar clicks en el menú de tiendas

document.addEventListener('click', function(e) {

    if (e.target.closest('.menu-toggle[data-tienda-id]')) {

        const menuToggle = e.target.closest('.menu-toggle');

        const tiendaId = menuToggle.getAttribute('data-tienda-id');

        const menu = document.getElementById(`menu-tienda-${tiendaId}`);

        

        document.querySelectorAll('.dropdown-menu').forEach(m => {

            if (m.id !== `menu-tienda-${tiendaId}`) {

                m.style.display = 'none';

            }

        });

        

        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';

    }

    

    if (e.target.closest('.dropdown-item[data-tienda-id]')) {

        const item = e.target.closest('.dropdown-item');

        const action = item.getAttribute('data-action');

        const tiendaId = item.getAttribute('data-tienda-id');

        

        document.querySelectorAll('.dropdown-menu').forEach(m => {

            m.style.display = 'none';

        });

        

        if (action === 'edit') {

            openEditTiendaModal(tiendaId);

        } else if (action === 'delete') {

            deleteTienda(tiendaId);

        }

    }

});



// Abrir modal para editar tienda

async function openEditTiendaModal(tiendaId) {

    try {

        const { data: tienda, error } = await window.supabaseClient

            .from('tiendas')

            .select('*')

            .eq('id', tiendaId)

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




// ============================================

// CORRECCIÓN DE ABASTECER

// ============================================



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



    form.addEventListener('submit', async function(e) {

        e.preventDefault();

        

        const origenTipoVal = origenTipo.value;

        const origenId = parseInt(origenSelect.value);

        const destinoTipoVal = destinoTipo.value;

        const destinoId = parseInt(destinoSelect.value);

        

        if (!origenTipoVal || !origenId || !destinoTipoVal || !destinoId) {

            showAbastecerMessage('Por favor, completa todos los campos', 'error');

            return;

        }



        // Obtener juguetes seleccionados con cantidad

        const juguetesSeleccionados = Array.from(document.querySelectorAll('.cantidad-input'))

            .map(input => ({

                id: parseInt(input.dataset.jugueteId),

                cantidad: parseInt(input.value) || 0

            }))

            .filter(j => j.cantidad > 0);



        if (juguetesSeleccionados.length === 0) {

            showAbastecerMessage('Debes seleccionar al menos un juguete con cantidad mayor a 0', 'error');

            return;

        }



        try {

            const user = JSON.parse(sessionStorage.getItem('user'));

            

            for (const juguete of juguetesSeleccionados) {

                // Obtener juguete actual

                const { data: jugueteActualData } = await window.supabaseClient
                    .from('juguetes')

                    .select('*')

                    .eq('id', juguete.id)

                    .limit(1);


                if (!jugueteActualData || jugueteActualData.length === 0) {
                    showAbastecerMessage(`Juguete no encontrado`, 'error');
                    continue;

                }



                const jugueteActual = jugueteActualData[0];

                if (jugueteActual.cantidad < juguete.cantidad) {
                    showAbastecerMessage(`No hay suficiente cantidad del juguete ${jugueteActual.nombre || ''}`, 'error');
                    continue;
                }

                // Verificar si ya existe un juguete con el mismo código Y nombre en el destino
                const campoDestino = destinoTipoVal === 'bodega' ? 'bodega_id' : 'tienda_id';
                const { data: jugueteExistenteData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', jugueteActual.codigo)
                    .eq('nombre', jugueteActual.nombre)
                    .eq('empresa_id', user.empresa_id)
                    .eq(campoDestino, destinoId)
                    .limit(1);

                // Crear movimiento

                await window.supabaseClient

                    .from('movimientos')

                    .insert({

                        tipo_origen: origenTipoVal,

                        origen_id: origenId,

                        tipo_destino: destinoTipoVal,

                        destino_id: destinoId,

                        juguete_id: juguete.id,

                        cantidad: juguete.cantidad,

                        empresa_id: user.empresa_id

                    });



                if (jugueteExistenteData && jugueteExistenteData.length > 0) {
                    // Si ya existe un juguete con el mismo código en el destino, sumar la cantidad
                    const jugueteExistente = jugueteExistenteData[0];
                    const nuevaCantidadDestino = jugueteExistente.cantidad + juguete.cantidad;
                    
                    await window.supabaseClient

                        .from('juguetes')

                        .update({ cantidad: nuevaCantidadDestino })
                        .eq('id', jugueteExistente.id);
                } else {

                    // Si no existe, crear un nuevo registro en el destino
                    const nuevoJugueteData = {
                        nombre: jugueteActual.nombre,

                        codigo: jugueteActual.codigo,

                        cantidad: juguete.cantidad,

                        empresa_id: user.empresa_id,
                        foto_url: jugueteActual.foto_url || null
                    };

                    
                    if (destinoTipoVal === 'bodega') {

                        nuevoJugueteData.bodega_id = destinoId;
                        nuevoJugueteData.tienda_id = null;
                    } else {

                        nuevoJugueteData.tienda_id = destinoId;
                        nuevoJugueteData.bodega_id = null;
                    }

                    
                    await window.supabaseClient

                        .from('juguetes')

                        .insert(nuevoJugueteData);
                }

                // Reducir cantidad en origen
                const nuevaCantidadOrigen = jugueteActual.cantidad - juguete.cantidad;
                
                if (nuevaCantidadOrigen <= 0) {
                    // Si la cantidad llega a 0 o menos, eliminar el registro del origen
                    await window.supabaseClient
                        .from('juguetes')
                        .delete()
                        .eq('id', juguete.id);
                } else {
                    // Actualizar cantidad en origen
                    await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: nuevaCantidadOrigen })
                        .eq('id', juguete.id);
                }

            }



            showAbastecerMessage('Movimiento realizado correctamente', 'success');

            form.reset();

            document.getElementById('juguetesDisponiblesList').innerHTML = '';

        } catch (error) {

            console.error('Error al realizar movimiento:', error);

            showAbastecerMessage('Error al realizar el movimiento: ' + error.message, 'error');

        }

    });

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

            .select(`

                *,

                juguetes(nombre, codigo),

                empleados(nombre, codigo)

            `)

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

                            <td>$${parseFloat(v.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>

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

                <p class="stat-number">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</p>

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


