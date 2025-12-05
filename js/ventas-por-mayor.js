// ============================================
// VENTAS AL POR MAYOR
// ============================================

let ventaPorMayorItems = []; // Array para almacenar items de la venta al por mayor
let registrarVentaPorMayorInitialized = false;
let ultimaVentaPorMayor = null; // Última venta al por mayor registrada (para deshacer)

function initVentaPorMayor() {
    const form = document.getElementById('registrarVentaPorMayorForm');
    const jugueteCodigoInput = document.getElementById('ventaPorMayorJugueteCodigo');
    const jugueteItemInput = document.getElementById('ventaPorMayorJugueteItem');
    const empleadoCodigoInput = document.getElementById('ventaPorMayorEmpleadoCodigo');
    const clienteSelect = document.getElementById('ventaPorMayorCliente');
    const metodoPagoSelect = document.getElementById('ventaPorMayorMetodoPago');
    const abonoRow = document.getElementById('ventaPorMayorAbonoRow');
    const abonoInput = document.getElementById('ventaPorMayorAbono');
    const agregarItemBtn = document.getElementById('agregarItemPorMayorBtn');
    const agregarClienteBtn = document.getElementById('agregarClientePorMayorBtn');
    const ubicacionTipoSelect = document.getElementById('ventaPorMayorUbicacionTipo');
    const ubicacionSelect = document.getElementById('ventaPorMayorUbicacion');
    
    if (!form || !jugueteCodigoInput || !empleadoCodigoInput || !agregarItemBtn) {
        return; // Elementos no disponibles aún
    }

    // Solo inicializar una vez
    if (registrarVentaPorMayorInitialized) {
        return;
    }
    
    registrarVentaPorMayorInitialized = true;
    ventaPorMayorItems = []; // Reiniciar items

    // Asegurar que el campo de abono esté oculto inicialmente
    if (abonoRow) {
        abonoRow.style.display = 'none';
    }

    // Cargar ubicaciones cuando se selecciona el tipo
    if (ubicacionTipoSelect && ubicacionSelect) {
        ubicacionTipoSelect.addEventListener('change', async function() {
            const tipo = this.value;
            if (tipo && typeof loadUbicacionesPorTipo === 'function') {
                await loadUbicacionesPorTipo(tipo, ubicacionSelect);
            } else {
                ubicacionSelect.innerHTML = '<option value="">Primero selecciona el tipo</option>';
            }
            // Limpiar información del juguete cuando cambia la ubicación
            const jugueteInfo = document.getElementById('juguetePorMayorInfo');
            if (jugueteInfo) {
                jugueteInfo.style.display = 'none';
            }
        });
    }

    // Buscar juguete por código
    jugueteCodigoInput.addEventListener('blur', async function() {
        const codigo = this.value.trim();
        if (!codigo) return;

        // Verificar que se haya seleccionado ubicación
        const ubicacionTipo = ubicacionTipoSelect ? ubicacionTipoSelect.value : '';
        const ubicacionId = ubicacionSelect ? ubicacionSelect.value : '';
        
        if (!ubicacionTipo || !ubicacionId) {
            const jugueteInfo = document.getElementById('juguetePorMayorInfo');
            if (jugueteInfo) {
                jugueteInfo.innerHTML = `
                    <div class="info-box error">
                        Por favor, selecciona primero el tipo de ubicación y la ubicación específica
                    </div>
                `;
                jugueteInfo.style.display = 'block';
            }
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            // Construir query base
            let query = window.supabaseClient
                .from('juguetes')
                .select(`
                    *,
                    tiendas(nombre),
                    bodegas(nombre)
                `)
                .eq('codigo', codigo)
                .eq('empresa_id', user.empresa_id);
            
            // Filtrar por ubicación seleccionada
            if (ubicacionTipo === 'tienda') {
                query = query.eq('tienda_id', ubicacionId).is('bodega_id', null);
            } else if (ubicacionTipo === 'bodega') {
                query = query.eq('bodega_id', ubicacionId).is('tienda_id', null);
            }
            
            const { data: juguetes, error } = await query;

            if (error) throw error;

            const jugueteInfo = document.getElementById('juguetePorMayorInfo');
            if (juguetes && juguetes.length > 0) {
                const juguetePrincipal = juguetes[0];
                const nombreJuguete = juguetePrincipal.nombre;
                const fotoUrl = juguetePrincipal.foto_url;
                const precioPorMayor = juguetePrincipal.precio_por_mayor;
                const item = juguetePrincipal.item;
                
                // Autocompletar ITEM si existe
                if (jugueteItemInput && item) {
                    jugueteItemInput.value = item;
                }
                
                // Calcular cantidad total (solo en la ubicación seleccionada)
                const cantidadTotal = juguetes.reduce((sum, j) => sum + (j.cantidad || 0), 0);
                
                // Obtener información de la ubicación seleccionada
                let ubicacionInfo = '';
                if (juguetes.length > 0) {
                    const juguete = juguetes[0];
                    const nombreUbicacion = ubicacionTipo === 'tienda' 
                        ? (juguete.tiendas ? juguete.tiendas.nombre : 'Tienda seleccionada')
                        : (juguete.bodegas ? juguete.bodegas.nombre : 'Bodega seleccionada');
                    ubicacionInfo = `<div style="margin-top: 8px;"><strong>Ubicación:</strong> ${ubicacionTipo === 'tienda' ? 'Tienda' : 'Bodega'}: ${nombreUbicacion}</div>`;
                }
                
                // Generar HTML de imagen
                let imagenHTML = '';
                const fotoUrlLimpia = fotoUrl ? fotoUrl.trim() : '';
                if (fotoUrlLimpia && fotoUrlLimpia !== '') {
                    try {
                        new URL(fotoUrlLimpia);
                        imagenHTML = `<div style="flex-shrink: 0; margin-right: 12px;">
                            <img src="${fotoUrlLimpia}" alt="${nombreJuguete}"
                                 style="width: 80px; height: 80px; border-radius: 6px; border: 2px solid #e2e8f0; object-fit: cover; background: #f1f5f9;"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width: 80px; height: 80px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;\\'><i class=\\'fas fa-image\\' style=\\'color: #cbd5e1; font-size: 24px;\\'></i></div>';"
                                 onload="this.style.background='transparent';">
                        </div>`;
                    } catch (e) {
                        imagenHTML = `<div style="flex-shrink: 0; margin-right: 12px; width: 80px; height: 80px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-image" style="color: #cbd5e1; font-size: 24px;"></i>
                        </div>`;
                    }
                } else {
                    imagenHTML = `<div style="flex-shrink: 0; margin-right: 12px; width: 80px; height: 80px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-image" style="color: #cbd5e1; font-size: 24px;"></i>
                    </div>`;
                }
                
                const itemCode = item ? ` | ITEM: ${item}` : '';
                jugueteInfo.innerHTML = `
                    <div class="info-box success" style="display: flex; flex-direction: column; gap: 8px;">
                        ${imagenHTML}
                        <div>
                            <strong>${nombreJuguete}</strong> (${codigo})${itemCode}<br>
                            <small>Cantidad Total Disponible: ${cantidadTotal} unidades</small>
                            ${precioPorMayor ? `<br><small style="color: #10b981; font-weight: bold;">Precio al por Mayor: $${precioPorMayor.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</small>` : '<br><small style="color: #f59e0b;">⚠️ No tiene precio al por mayor configurado</small>'}
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
            const jugueteInfo = document.getElementById('juguetePorMayorInfo');
            if (jugueteInfo) {
                jugueteInfo.innerHTML = `
                    <div class="info-box error">
                        Error al buscar juguete: ${error.message}
                    </div>
                `;
                jugueteInfo.style.display = 'block';
            }
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

    // Cargar clientes en el select
    if (clienteSelect) {
        loadClientesParaVenta();
    }

    // Configurar formato del campo de abono (separadores de miles)
    if (abonoInput) {
        abonoInput.addEventListener('input', function(e) {
            let value = e.target.value;
            const numericValue = value.replace(/[^\d]/g, '');

            if (numericValue === '') {
                e.target.value = '';
                e.target.dataset.numericValue = '';
                return;
            }

            const numValue = parseInt(numericValue, 10);
            e.target.dataset.numericValue = numValue;

            const formatted = numValue.toLocaleString('es-CO', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });

            e.target.value = formatted;
        });

        abonoInput.addEventListener('blur', function(e) {
            const numericValue = e.target.dataset.numericValue || e.target.value.replace(/[^\d]/g, '');
            if (numericValue && numericValue !== '') {
                const numValue = parseInt(numericValue, 10);
                e.target.value = numValue.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
                e.target.dataset.numericValue = numValue;
            }
        });

        abonoInput.addEventListener('focus', function(e) {
            const numericValue = e.target.dataset.numericValue || e.target.value.replace(/[^\d]/g, '');
            if (numericValue && numericValue !== '') {
                const numValue = parseInt(numericValue, 10);
                e.target.value = numValue.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
            }
        });
    }

    // Mostrar/ocultar campo de abono según método de pago y si hay items agregados
    if (metodoPagoSelect && abonoRow) {
        metodoPagoSelect.addEventListener('change', function() {
            const metodo = this.value;
            if (metodo === 'credito' && ventaPorMayorItems.length > 0) {
                abonoRow.style.display = 'flex';
            } else {
                abonoRow.style.display = 'none';
                if (abonoInput) {
                    abonoInput.value = '0';
                    abonoInput.dataset.numericValue = '0';
                }
            }
        });
    }

    // Botón agregar cliente
    if (agregarClienteBtn) {
        agregarClienteBtn.addEventListener('click', function() {
            if (typeof abrirClienteModal === 'function') {
                abrirClienteModal(null);
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

            const empleadoInfo = document.getElementById('empleadoPorMayorInfo');
            if (empleados && empleados.length > 0) {
                const empleado = empleados[0];
                empleadoInfo.innerHTML = `
                    <div class="info-box success">
                        <strong>${empleado.nombre}</strong> (${empleado.codigo})
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
            const empleadoInfo = document.getElementById('empleadoPorMayorInfo');
            if (empleadoInfo) {
                empleadoInfo.innerHTML = `
                    <div class="info-box error">
                        Error al buscar empleado: ${error.message}
                    </div>
                `;
                empleadoInfo.style.display = 'block';
            }
        }
    });

    // Agregar item al por mayor
    agregarItemBtn.addEventListener('click', async function() {
        const codigoJuguete = jugueteCodigoInput.value.trim();
        const codigoEmpleado = empleadoCodigoInput.value.trim();
        const cantidad = parseInt(document.getElementById('ventaPorMayorCantidad').value) || 1;
        const metodoPago = document.getElementById('ventaPorMayorMetodoPago').value;
        const ubicacionTipo = ubicacionTipoSelect ? ubicacionTipoSelect.value : '';
        const ubicacionId = ubicacionSelect ? ubicacionSelect.value : '';

        if (!codigoJuguete || !codigoEmpleado || !metodoPago || !ubicacionTipo || !ubicacionId) {
            showVentaPorMayorMessage('Por favor, completa todos los campos requeridos (juguete, empleado, método de pago y ubicación)', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Buscar juguetes con ese código en la ubicación seleccionada
            let query = window.supabaseClient
                .from('juguetes')
                .select('*')
                .eq('codigo', codigoJuguete)
                .eq('empresa_id', user.empresa_id);
            
            // Filtrar por ubicación seleccionada
            if (ubicacionTipo === 'tienda') {
                query = query.eq('tienda_id', ubicacionId).is('bodega_id', null);
            } else if (ubicacionTipo === 'bodega') {
                query = query.eq('bodega_id', ubicacionId).is('tienda_id', null);
            }
            
            const { data: juguetes, error: jugueteError } = await query;

            if (jugueteError) throw jugueteError;
            if (!juguetes || juguetes.length === 0) {
                showVentaPorMayorMessage('Juguete no encontrado en la ubicación seleccionada', 'error');
                return;
            }

            const juguete = juguetes[0];
            
            // Verificar que tenga precio al por mayor
            if (!juguete.precio_por_mayor || juguete.precio_por_mayor <= 0) {
                showVentaPorMayorMessage('Este juguete no tiene precio al por mayor configurado', 'error');
                return;
            }

            // Buscar empleado
            const { data: empleados, error: empleadoError } = await window.supabaseClient
                .from('empleados')
                .select('*')
                .eq('codigo', codigoEmpleado)
                .eq('empresa_id', user.empresa_id)
                .limit(1);

            if (empleadoError) throw empleadoError;
            if (!empleados || empleados.length === 0) {
                showVentaPorMayorMessage('Empleado no encontrado', 'error');
                return;
            }

            const empleado = empleados[0];
            const precio = juguete.precio_por_mayor;

            // Verificar cantidad disponible en la ubicación seleccionada
            const cantidadTotal = juguetes.reduce((sum, j) => sum + (j.cantidad || 0), 0);
            if (cantidad > cantidadTotal) {
                showVentaPorMayorMessage(`Cantidad insuficiente en la ubicación seleccionada. Disponible: ${cantidadTotal}`, 'error');
                return;
            }

            // Obtener nombre de la ubicación desde el select
            const ubicacionNombre = ubicacionSelect ? ubicacionSelect.options[ubicacionSelect.selectedIndex]?.textContent || '' : '';

            // Agregar item (guardamos la información de ubicación)
            ventaPorMayorItems.push({
                juguete_codigo: juguete.codigo,
                juguete_nombre: juguete.nombre,
                juguete_item: juguete.item || null,
                juguete_foto_url: juguete.foto_url || null,
                empleado_id: empleado.id,
                empleado_nombre: empleado.nombre,
                empleado_codigo: empleado.codigo,
                cantidad: cantidad,
                precio: precio,
                metodo_pago: metodoPago,
                ubicacion_tipo: ubicacionTipo,
                ubicacion_id: ubicacionId,
                ubicacion_nombre: ubicacionNombre,
                tienda_id: ubicacionTipo === 'tienda' ? ubicacionId : null,
                bodega_id: ubicacionTipo === 'bodega' ? ubicacionId : null
            });

            // Actualizar lista de items en pantalla
            updateVentaPorMayorItemsList();
            
            // Limpiar solo campos del juguete y cantidad; mantener empleado, cliente y método de pago
            if (jugueteItemInput) {
                jugueteItemInput.value = '';
            }
            jugueteCodigoInput.value = '';
            document.getElementById('ventaPorMayorCantidad').value = '1';
            const jugueteInfo = document.getElementById('juguetePorMayorInfo');
            if (jugueteInfo) jugueteInfo.style.display = 'none';
            
            showVentaPorMayorMessage('Item agregado correctamente', 'success');
        } catch (error) {
            console.error('Error al agregar item:', error);
            showVentaPorMayorMessage('Error al agregar item: ' + error.message, 'error');
        }
    });

    // Registrar venta al por mayor - con protección contra clics múltiples
    // Importar la función preventFormDoubleSubmit si está disponible
    if (typeof preventFormDoubleSubmit === 'function') {
        preventFormDoubleSubmit(form, async function(e) {
            if (ventaPorMayorItems.length === 0) {
                showVentaPorMayorMessage('Debes agregar al menos un item a la venta', 'error');
                return;
            }

            try {
                const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Generar código de venta
            const codigoVenta = await generarCodigoVenta();
            
            // Obtener cliente y abono
            const clienteId = clienteSelect ? clienteSelect.value : null;
            const metodoPago = metodoPagoSelect ? metodoPagoSelect.value : '';
            let abono = 0;
            if (abonoInput && metodoPago === 'credito') {
                const raw = abonoInput.dataset.numericValue || abonoInput.value.replace(/[^\d]/g, '');
                abono = raw ? parseInt(raw, 10) || 0 : 0;
            }

            // Array para almacenar información de cada venta registrada (para deshacer)
            const ventasRegistradas = [];

            // Registrar cada item
            for (const item of ventaPorMayorItems) {
                // Buscar el juguete específico en la ubicación seleccionada
                let query = window.supabaseClient
                    .from('juguetes')
                    .select('id, cantidad, codigo, nombre, bodega_id, tienda_id')
                    .eq('codigo', item.juguete_codigo)
                    .eq('empresa_id', user.empresa_id)
                    .gt('cantidad', 0);
                
                // Filtrar por la ubicación específica del item
                if (item.ubicacion_tipo === 'tienda' && item.tienda_id) {
                    query = query.eq('tienda_id', item.tienda_id).is('bodega_id', null);
                } else if (item.ubicacion_tipo === 'bodega' && item.bodega_id) {
                    query = query.eq('bodega_id', item.bodega_id).is('tienda_id', null);
                } else {
                    throw new Error(`Ubicación no válida para el item ${item.juguete_nombre}`);
                }
                
                const { data: juguetesDisponibles, error: juguetesError } = await query;

                if (juguetesError) throw juguetesError;
                if (!juguetesDisponibles || juguetesDisponibles.length === 0) {
                    throw new Error(`No hay juguetes disponibles con código ${item.juguete_codigo} en la ubicación seleccionada`);
                }

                // Debería haber solo un juguete en la ubicación seleccionada
                const juguete = juguetesDisponibles[0];
                const cantidadDisponible = juguete.cantidad || 0;
                
                if (item.cantidad > cantidadDisponible) {
                    throw new Error(`Cantidad insuficiente en la ubicación seleccionada. Disponible: ${cantidadDisponible}, Solicitado: ${item.cantidad}`);
                }
                
                // Guardar información del juguete antes de modificar (para deshacer)
                const infoJugueteOriginal = {
                    juguete_id: juguete.id,
                    juguete_codigo: juguete.codigo,
                    juguete_nombre: juguete.nombre,
                    cantidad_original: juguete.cantidad,
                    bodega_id: juguete.bodega_id,
                    tienda_id: juguete.tienda_id
                };
                
                // Calcular abono proporcional para este item
                const totalItem = item.precio * item.cantidad;
                const totalVenta = ventaPorMayorItems.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
                const abonoProporcional = totalVenta > 0 ? (abono * totalItem / totalVenta) : 0;

                // Registrar venta
                const { data: ventaInsertada, error: ventaError } = await window.supabaseClient
                    .from('ventas')
                    .insert({
                        codigo_venta: codigoVenta,
                        juguete_codigo: juguete.codigo,
                        empleado_id: item.empleado_id,
                        cantidad: item.cantidad,
                        precio_venta: item.precio * item.cantidad,
                        metodo_pago: item.metodo_pago,
                        empresa_id: user.empresa_id,
                        es_por_mayor: true,
                        cliente_id: clienteId || null,
                        abono: abonoProporcional
                    })
                    .select()
                    .single();

                if (ventaError) throw ventaError;
                
                // NO crear pagos automáticos aquí. El abono ya está guardado en el campo 'abono' de la venta.
                let pagoId = null;

                // Reducir cantidad del juguete
                const nuevaCantidad = Math.max(0, cantidadDisponible - item.cantidad);
                
                if (nuevaCantidad === 0) {
                    // Si la cantidad llega a 0, eliminar el registro
                    const { error: deleteError } = await window.supabaseClient
                        .from('juguetes')
                        .delete()
                        .eq('id', juguete.id);
                    if (deleteError) throw deleteError;
                } else {
                    // Actualizar cantidad
                    const { error: updateError } = await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: nuevaCantidad })
                        .eq('id', juguete.id);
                    if (updateError) throw updateError;
                }
                
                // Guardar información de la venta registrada (para deshacer)
                ventasRegistradas.push({
                    venta_id: ventaInsertada.id,
                    codigo_venta: codigoVenta,
                    juguete_info: infoJugueteOriginal,
                    cantidad_vendida: item.cantidad,
                    precio_venta: item.precio * item.cantidad,
                    empleado_id: item.empleado_id,
                    metodo_pago: item.metodo_pago,
                    cliente_id: clienteId,
                    abono: abonoProporcional,
                    pago_id: pagoId,
                    juguete_eliminado: nuevaCantidad === 0
                });
            }

            // Guardar información de la última venta al por mayor para poder deshacerla
            if (ventasRegistradas.length > 0) {
                ultimaVentaPorMayor = {
                    codigo_venta: codigoVenta,
                    ventas: ventasRegistradas,
                    timestamp: new Date().toISOString()
                };
                actualizarBotonDeshacerVentaPorMayor(true);
            }

            showVentaPorMayorMessage('Venta al por mayor registrada correctamente', 'success');
            ventaPorMayorItems = [];
            updateVentaPorMayorItemsList();
            form.reset();
            
            // Recargar dashboard si existe
            if (typeof loadDashboardSummary === 'function') {
                loadDashboardSummary();
            }
            } catch (error) {
                console.error('Error al registrar venta al por mayor:', error);
                showVentaPorMayorMessage('Error al registrar la venta: ' + error.message, 'error');
                // Limpiar última venta en caso de error
                ultimaVentaPorMayor = null;
                actualizarBotonDeshacerVentaPorMayor(false);
            }
        });
    } else {
        // Fallback si la función no está disponible
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (ventaPorMayorItems.length === 0) {
                showVentaPorMayorMessage('Debes agregar al menos un item a la venta', 'error');
                return;
            }

            try {
                const user = JSON.parse(sessionStorage.getItem('user'));
                
                // Generar código de venta
                const codigoVenta = await generarCodigoVenta();
                
                // Obtener cliente y abono
                const clienteId = clienteSelect ? clienteSelect.value : null;
                const metodoPago = metodoPagoSelect ? metodoPagoSelect.value : '';
                let abono = 0;
                if (abonoInput && metodoPago === 'credito') {
                    const raw = abonoInput.dataset.numericValue || abonoInput.value.replace(/[^\d]/g, '');
                    abono = raw ? parseInt(raw, 10) || 0 : 0;
                }

                // Registrar cada item
                for (const item of ventaPorMayorItems) {
                    // Buscar el juguete específico en la ubicación seleccionada
                    let query = window.supabaseClient
                        .from('juguetes')
                        .select('id, cantidad, codigo, nombre, bodega_id, tienda_id')
                        .eq('codigo', item.juguete_codigo)
                        .eq('empresa_id', user.empresa_id)
                        .gt('cantidad', 0);
                    
                    // Filtrar por la ubicación específica del item
                    if (item.ubicacion_tipo === 'tienda' && item.tienda_id) {
                        query = query.eq('tienda_id', item.tienda_id).is('bodega_id', null);
                    } else if (item.ubicacion_tipo === 'bodega' && item.bodega_id) {
                        query = query.eq('bodega_id', item.bodega_id).is('tienda_id', null);
                    } else {
                        throw new Error(`Ubicación no válida para el item ${item.juguete_nombre}`);
                    }
                    
                    const { data: juguetesDisponibles, error: juguetesError } = await query;

                    if (juguetesError) throw juguetesError;
                    if (!juguetesDisponibles || juguetesDisponibles.length === 0) {
                        throw new Error(`No hay juguetes disponibles con código ${item.juguete_codigo} en la ubicación seleccionada`);
                    }

                    // Debería haber solo un juguete en la ubicación seleccionada
                    const juguete = juguetesDisponibles[0];
                    const cantidadDisponible = juguete.cantidad || 0;
                    
                    if (item.cantidad > cantidadDisponible) {
                        throw new Error(`Cantidad insuficiente en la ubicación seleccionada. Disponible: ${cantidadDisponible}, Solicitado: ${item.cantidad}`);
                    }
                    
                    // Calcular abono proporcional para este item
                    const totalItem = item.precio * item.cantidad;
                    const totalVenta = ventaPorMayorItems.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
                    const abonoProporcional = totalVenta > 0 ? (abono * totalItem / totalVenta) : 0;

                    // Registrar venta
                    const { data: ventaInsertada, error: ventaError } = await window.supabaseClient
                        .from('ventas')
                        .insert({
                            codigo_venta: codigoVenta,
                            juguete_codigo: juguete.codigo,
                            empleado_id: item.empleado_id,
                            cantidad: item.cantidad,
                            precio_venta: item.precio * item.cantidad,
                            metodo_pago: item.metodo_pago,
                            empresa_id: user.empresa_id,
                            es_por_mayor: true,
                            cliente_id: clienteId || null,
                            abono: abonoProporcional
                        })
                        .select()
                        .single();

                    if (ventaError) throw ventaError;

                    // NO crear pagos automáticos aquí. El abono ya está guardado en el campo 'abono' de la venta.

                    // Reducir cantidad del juguete
                    const nuevaCantidad = Math.max(0, cantidadDisponible - item.cantidad);
                    
                    if (nuevaCantidad === 0) {
                        // Si la cantidad llega a 0, eliminar el registro
                        const { error: deleteError } = await window.supabaseClient
                            .from('juguetes')
                            .delete()
                            .eq('id', juguete.id);
                        if (deleteError) throw deleteError;
                    } else {
                        // Actualizar cantidad
                        const { error: updateError } = await window.supabaseClient
                            .from('juguetes')
                            .update({ cantidad: nuevaCantidad })
                            .eq('id', juguete.id);
                        if (updateError) throw updateError;
                    }
                }

                showVentaPorMayorMessage('Venta al por mayor registrada correctamente', 'success');
                ventaPorMayorItems = [];
                updateVentaPorMayorItemsList();
                form.reset();
                
                // Recargar dashboard si existe
                if (typeof loadDashboardSummary === 'function') {
                    loadDashboardSummary();
                }
            } catch (error) {
                console.error('Error al registrar venta al por mayor:', error);
                showVentaPorMayorMessage('Error al registrar la venta: ' + error.message, 'error');
            }
        });
        
        // Inicializar botón deshacer
        inicializarBotonDeshacerVentaPorMayor();
    }
}

// Función para actualizar lista de items al por mayor
function updateVentaPorMayorItemsList() {
    const itemsList = document.getElementById('ventaPorMayorItemsList');
    const abonoRow = document.getElementById('ventaPorMayorAbonoRow');
    const metodoPagoSelect = document.getElementById('ventaPorMayorMetodoPago');
    if (!itemsList) return;
    
    if (ventaPorMayorItems.length === 0) {
        itemsList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay items agregados</p>';
        // Si no hay items, ocultar el campo de abono
        if (abonoRow) {
            abonoRow.style.display = 'none';
        }
        return;
    }

    const totalVenta = ventaPorMayorItems.reduce((sum, item) => sum + (item.precio * (item.cantidad || 1)), 0);
    
    itemsList.innerHTML = ventaPorMayorItems.map((item, index) => {
        const cantidad = item.cantidad || 1;
        const subtotal = item.precio * cantidad;
        const itemCode = item.juguete_item ? ` | ITEM: ${item.juguete_item}` : '';
        
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

        const ubicacionTexto = item.ubicacion_nombre 
            ? `${item.ubicacion_tipo === 'tienda' ? 'Tienda' : 'Bodega'}: ${item.ubicacion_nombre}`
            : (item.ubicacion_tipo ? `${item.ubicacion_tipo === 'tienda' ? 'Tienda' : 'Bodega'}` : '');
        
        return `
        <div class="venta-item-card" style="display: flex; align-items: center; gap: 12px;">
            ${imagenHTML}
            <div class="item-info" style="flex: 1;">
                <strong>${item.juguete_nombre}</strong> (${item.juguete_codigo})${itemCode}<br>
                <small>Precio al por Mayor: $${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} | Cantidad: ${cantidad} | Empleado: ${item.empleado_nombre} | Método: ${item.metodo_pago}${ubicacionTexto ? ` | ${ubicacionTexto}` : ''}</small>
            </div>
            <div class="item-actions">
                <span class="item-precio">$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <button type="button" class="btn-remove" onclick="removeVentaPorMayorItem(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    }).join('') + `
        <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-top: 2px solid #8b5cf6;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold; color: #1e293b;">Total de la Venta al por Mayor:</span>
                <span style="font-size: 20px; font-weight: bold; color: #10b981;">$${totalVenta.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
        </div>
    `;

    // Si hay items y el método de pago es crédito, mostrar el campo de abono
    if (abonoRow && metodoPagoSelect) {
        if (metodoPagoSelect.value === 'credito') {
            abonoRow.style.display = 'flex';
        } else {
            abonoRow.style.display = 'none';
        }
    }
}

// Función global para remover item al por mayor
window.removeVentaPorMayorItem = function(index) {
    ventaPorMayorItems.splice(index, 1);
    updateVentaPorMayorItemsList();

    // Ocultar campo de abono si ya no hay items o el método no es crédito
    const abonoRow = document.getElementById('ventaPorMayorAbonoRow');
    const metodoPagoSelect = document.getElementById('ventaPorMayorMetodoPago');
    if (abonoRow && metodoPagoSelect) {
        if (ventaPorMayorItems.length === 0 || metodoPagoSelect.value !== 'credito') {
            abonoRow.style.display = 'none';
        }
    }
};

// ============================================
// FUNCIONES PARA DESHACER VENTA AL POR MAYOR
// ============================================

// Función para actualizar la visibilidad del botón deshacer venta al por mayor
function actualizarBotonDeshacerVentaPorMayor(mostrar) {
    const botonDeshacer = document.getElementById('deshacerVentaPorMayorBtn');
    if (botonDeshacer) {
        botonDeshacer.style.display = mostrar ? 'inline-flex' : 'none';
    }
}

// Función para deshacer la última venta al por mayor
async function deshacerUltimaVentaPorMayor() {
    if (!ultimaVentaPorMayor) {
        showVentaPorMayorMessage('No hay venta para deshacer', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que deseas deshacer la última venta al por mayor? Esta acción revertirá todos los cambios realizados, incluyendo pagos registrados.')) {
        return;
    }
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Revertir cada venta en orden inverso
        for (let i = ultimaVentaPorMayor.ventas.length - 1; i >= 0; i--) {
            const ventaInfo = ultimaVentaPorMayor.ventas[i];
            
            // 1. Eliminar pago si existe
            if (ventaInfo.pago_id) {
                await window.supabaseClient
                    .from('pagos')
                    .delete()
                    .eq('id', ventaInfo.pago_id);
            }
            
            // 2. Restaurar cantidad del juguete
            if (ventaInfo.juguete_eliminado) {
                // Si el juguete fue eliminado (cantidad llegó a 0), recrearlo
                const nuevoJuguete = {
                    nombre: ventaInfo.juguete_info.juguete_nombre,
                    codigo: ventaInfo.juguete_info.juguete_codigo,
                    cantidad: ventaInfo.juguete_info.cantidad_original,
                    empresa_id: user.empresa_id
                };
                
                if (ventaInfo.juguete_info.bodega_id) {
                    nuevoJuguete.bodega_id = ventaInfo.juguete_info.bodega_id;
                    nuevoJuguete.tienda_id = null;
                } else if (ventaInfo.juguete_info.tienda_id) {
                    nuevoJuguete.tienda_id = ventaInfo.juguete_info.tienda_id;
                    nuevoJuguete.bodega_id = null;
                }
                
                await window.supabaseClient
                    .from('juguetes')
                    .insert(nuevoJuguete);
            } else {
                // Si solo se redujo la cantidad, restaurarla
                await window.supabaseClient
                    .from('juguetes')
                    .update({ cantidad: ventaInfo.juguete_info.cantidad_original })
                    .eq('id', ventaInfo.juguete_info.juguete_id);
            }
            
            // 3. Eliminar registro de venta
            await window.supabaseClient
                .from('ventas')
                .delete()
                .eq('id', ventaInfo.venta_id);
        }
        
        // Limpiar última venta
        ultimaVentaPorMayor = null;
        actualizarBotonDeshacerVentaPorMayor(false);
        
        showVentaPorMayorMessage('Venta al por mayor deshecha correctamente', 'success');
        
        // Recargar dashboard si existe
        if (typeof loadDashboardSummary === 'function') {
            await loadDashboardSummary();
        }
    } catch (error) {
        console.error('Error al deshacer venta al por mayor:', error);
        showVentaPorMayorMessage('Error al deshacer la venta: ' + error.message, 'error');
    }
}

// Función para inicializar el botón deshacer venta al por mayor
function inicializarBotonDeshacerVentaPorMayor() {
    const botonDeshacer = document.getElementById('deshacerVentaPorMayorBtn');
    if (botonDeshacer) {
        // Remover listeners anteriores si existen (clonar y reemplazar)
        const nuevoBtn = botonDeshacer.cloneNode(true);
        botonDeshacer.parentNode.replaceChild(nuevoBtn, botonDeshacer);
        
        // Agregar event listener
        nuevoBtn.addEventListener('click', async function() {
            await deshacerUltimaVentaPorMayor();
        });
        // Ocultar inicialmente
        nuevoBtn.style.display = ultimaVentaPorMayor ? 'inline-flex' : 'none';
    }
}

// Función para mostrar mensajes
function showVentaPorMayorMessage(message, type) {
    const errorMsg = document.getElementById('ventaPorMayorErrorMessage');
    const successMsg = document.getElementById('ventaPorMayorSuccessMessage');
    
    if (type === 'error') {
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
        if (successMsg) {
            successMsg.style.display = 'none';
        }
    } else {
        if (successMsg) {
            successMsg.textContent = message;
            successMsg.style.display = 'block';
        }
        if (errorMsg) {
            errorMsg.style.display = 'none';
        }
    }
    
    setTimeout(() => {
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
    }, 5000);
}

// Función para cargar clientes en el select
async function loadClientesParaVenta() {
    const clienteSelect = document.getElementById('ventaPorMayorCliente');
    if (!clienteSelect) return;

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const { data: clientes, error } = await window.supabaseClient
            .from('clientes')
            .select('id, nombre')
            .eq('empresa_id', user.empresa_id)
            .order('nombre', { ascending: true });

        if (error) throw error;

        // Limpiar opciones existentes excepto la primera
        clienteSelect.innerHTML = '<option value="">Seleccionar cliente...</option>';

        if (clientes && clientes.length > 0) {
            clientes.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = cliente.nombre;
                clienteSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error al cargar clientes:', error);
    }
}

