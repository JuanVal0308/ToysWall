// ============================================
// FUNCIONALIDADES COMPLETAS DEL DASHBOARD
// ============================================

// Variables globales
let ventaItems = []; // Array para almacenar items de la venta actual
let currentFacturaData = null; // Datos de la factura actual

// ============================================
// DASHBOARD - RESUMEN
// ============================================

async function loadDashboardSummary() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Cargar totales
        const [tiendas, bodegas, usuarios, ventas] = await Promise.all([
            window.supabaseClient.from('tiendas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('bodegas').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('usuarios').select('id', { count: 'exact' }).eq('empresa_id', user.empresa_id),
            window.supabaseClient.from('ventas').select('precio_venta').eq('empresa_id', user.empresa_id)
        ]);

        document.getElementById('totalTiendas').textContent = tiendas.count || 0;
        document.getElementById('totalBodegas').textContent = bodegas.count || 0;
        document.getElementById('totalUsuarios').textContent = usuarios.count || 0;
        
        const totalGanancias = ventas.data?.reduce((sum, v) => sum + parseFloat(v.precio_venta || 0), 0) || 0;
        document.getElementById('totalGanancias').textContent = '$' + totalGanancias.toLocaleString('es-CO', { minimumFractionDigits: 2 });

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
            .limit(5);

        const ventasList = document.getElementById('ventasRecientes');
        if (ventasRecientes && ventasRecientes.length > 0) {
            ventasList.innerHTML = ventasRecientes.map(v => `
                <div class="venta-item">
                    <div class="venta-info">
                        <strong>${v.juguetes?.nombre || 'N/A'}</strong>
                        <span>${v.codigo_venta}</span>
                    </div>
                    <div class="venta-precio">$${parseFloat(v.precio_venta).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
                </div>
            `).join('');
        } else {
            ventasList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas recientes</p>';
        }
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
                const nombreJuguete = juguetes[0].nombre;
                
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
                
                jugueteInfo.innerHTML = `
                    <div class="info-box success">
                        <strong>${nombreJuguete}</strong><br>
                        <small>Cantidad total disponible: ${cantidadTotal}</small>
                        ${ubicacionInfo}
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
        const precio = parseFloat(document.getElementById('ventaPrecio').value);
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

            // Agregar item
            ventaItems.push({
                juguete_id: juguete.id,
                juguete_nombre: juguete.nombre,
                juguete_codigo: juguete.codigo,
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
            document.getElementById('ventaPrecio').value = '';
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
            
            // Registrar cada item como venta
            for (const item of ventaItems) {
                const codigoVenta = await generarCodigoVenta();
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

    itemsList.innerHTML = ventaItems.map((item, index) => `
        <div class="venta-item-card">
            <div class="item-info">
                <strong>${item.juguete_nombre}</strong> (${item.juguete_codigo})<br>
                <small>Cantidad: ${item.cantidad || 1} | Empleado: ${item.empleado_nombre} | Método: ${item.metodo_pago}</small>
            </div>
            <div class="item-actions">
                <span class="item-precio">$${(item.precio * (item.cantidad || 1)).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <button type="button" class="btn-remove" onclick="removeVentaItem(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');

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
        
        // Buscar ventas que no tienen factura asociada
        // (asumiendo que una venta facturada tiene un campo relacionado o se verifica por facturas_items)
        const { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
            .eq('empresa_id', user.empresa_id)
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
        
        // Obtener todas las ventas con ese código
        const { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(nombre, codigo),
                empleados(nombre, codigo)
            `)
            .eq('codigo_venta', codigoVenta)
            .eq('empresa_id', user.empresa_id);

        if (error) throw error;

        if (!ventas || ventas.length === 0) {
            showVentaMessage('Venta no encontrada', 'error');
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

        // Calcular total
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
        
        // Llenar items
        const itemsBody = document.getElementById('facturaItemsBody');
        itemsBody.innerHTML = itemsParaFacturar.map(item => `
            <tr>
                <td>${item.juguete_nombre}</td>
                <td>${item.juguete_codigo}</td>
                <td>$${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                <td>${item.cantidad}</td>
                <td>$${item.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('');
        
        document.getElementById('facturaTotal').textContent = '$' + total.toLocaleString('es-CO', { minimumFractionDigits: 2 });
        
        // Guardar datos para enviar
        currentFacturaData = {
            codigo_factura: codigoFactura,
            items: itemsParaFacturar,
            total: total,
            codigo_venta: codigoVenta // Guardar para referencia
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
    
    // Llenar items
    const itemsBody = document.getElementById('facturaItemsBody');
    itemsBody.innerHTML = ventaItems.map(item => `
        <tr>
            <td>${item.juguete_nombre}</td>
            <td>${item.juguete_codigo}</td>
            <td>$${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            <td>${item.cantidad || 1}</td>
            <td>$${(item.precio * (item.cantidad || 1)).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
    
    document.getElementById('facturaTotal').textContent = '$' + total.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    
    // Guardar datos para enviar
    currentFacturaData = {
        codigo_factura: codigoFactura,
        items: ventaItems,
        total: total
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
            
            // Enviar correo electrónico con la factura
            try {
                await enviarFacturaPorCorreo(clienteEmail, clienteNombre, currentFacturaData, factura.id);
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

// Función para enviar factura por correo
async function enviarFacturaPorCorreo(clienteEmail, clienteNombre, facturaData, facturaId) {
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
    
    // Generar HTML detallado de los items
    const itemsHTML = facturaData.items.map((item, index) => {
        const cantidad = item.cantidad || 1;
        const precio = item.precio || 0;
        const subtotal = item.subtotal || (precio * cantidad);
        return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 13px;">${index + 1}</td>
                <td style="padding: 10px 8px; font-weight: 600; color: #1e293b; font-size: 13px; word-wrap: break-word;">${item.juguete_nombre}</td>
                <td style="padding: 10px 8px; color: #64748b; font-size: 13px; word-wrap: break-word;">${item.juguete_codigo}</td>
                <td style="padding: 10px 8px; text-align: right; color: #1e293b; font-size: 13px;">$${precio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 600; font-size: 13px;">${cantidad}</td>
                <td style="padding: 10px 8px; text-align: right; color: #10b981; font-weight: 700; font-size: 14px;">$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');

    const fecha = new Date().toLocaleString('es-CO');
    const logoUrl = 'https://i.imgur.com/RBbjVnp.jpeg';
    
    const facturaHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    line-height: 1.6; 
                    color: #333; 
                    background-color: #f1f5f9;
                    padding: 10px;
                    -webkit-text-size-adjust: 100%;
                    -ms-text-size-adjust: 100%;
                }
                .email-container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header { 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 30px 20px; 
                    text-align: center; 
                }
                .logo-container {
                    margin-bottom: 15px;
                }
                .logo {
                    max-width: 150px;
                    height: auto;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    display: block;
                    margin: 0 auto;
                }
                .header h1 {
                    font-size: 28px;
                    margin-bottom: 8px;
                    font-weight: 700;
                }
                .header p {
                    font-size: 14px;
                    opacity: 0.9;
                }
                .content { 
                    padding: 25px 20px; 
                }
                .factura-info { 
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
                    padding: 20px; 
                    border-radius: 10px; 
                    margin-bottom: 25px;
                    border-left: 4px solid #8b5cf6;
                }
                .factura-info h2 {
                    color: #8b5cf6;
                    margin-bottom: 12px;
                    font-size: 20px;
                }
                .factura-info p {
                    margin: 6px 0;
                    color: #495057;
                    font-size: 14px;
                    word-break: break-word;
                }
                .factura-info strong {
                    color: #1e293b;
                    font-weight: 600;
                }
                .items-section {
                    margin: 25px 0;
                }
                .items-section h3 {
                    color: #1e293b;
                    margin-bottom: 15px;
                    font-size: 18px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e2e8f0;
                }
                .table-wrapper {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    margin: 0 -5px;
                }
                table { 
                    width: 100%; 
                    min-width: 500px;
                    border-collapse: collapse; 
                    background: white; 
                    border-radius: 10px; 
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    table-layout: fixed;
                }
                thead {
                    background: linear-gradient(135deg, #8b5cf6 0%, #667eea 100%);
                }
                th { 
                    color: white; 
                    padding: 10px 8px; 
                    text-align: left; 
                    font-weight: 600;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                th:nth-child(1) { width: 8%; }
                th:nth-child(2) { width: 25%; }
                th:nth-child(3) { width: 15%; }
                th:nth-child(4) { width: 18%; }
                th:nth-child(5) { width: 12%; }
                th:nth-child(6) { width: 22%; text-align: right; }
                th:last-child {
                    text-align: right;
                }
                tbody tr {
                    border-bottom: 1px solid #e2e8f0;
                }
                tbody tr:hover {
                    background-color: #f8f9fa;
                }
                td {
                    padding: 10px 8px;
                    font-size: 13px;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                tfoot {
                    background: #f8f9fa;
                    border-top: 3px solid #8b5cf6;
                }
                .total-row {
                    font-size: 16px;
                    font-weight: 700;
                }
                .total-label {
                    text-align: right;
                    padding: 15px 10px;
                    color: #1e293b;
                    font-size: 16px;
                }
                .total-amount {
                    text-align: right;
                    padding: 15px 10px;
                    color: #10b981;
                    font-size: 20px;
                    font-weight: 700;
                }
                .footer { 
                    text-align: center; 
                    margin-top: 30px; 
                    padding-top: 25px;
                    border-top: 2px solid #e2e8f0;
                    color: #64748b; 
                    font-size: 13px; 
                }
                .footer p {
                    margin: 6px 0;
                }
                .footer .brand {
                    color: #8b5cf6;
                    font-weight: 600;
                    font-size: 15px;
                }
                /* Estilos para móvil */
                @media only screen and (max-width: 600px) {
                    body {
                        padding: 5px;
                    }
                    .email-container {
                        max-width: 100%;
                        border-radius: 8px;
                    }
                    .header {
                        padding: 25px 15px;
                    }
                    .logo {
                        max-width: 120px;
                    }
                    .header h1 {
                        font-size: 24px;
                    }
                    .header p {
                        font-size: 13px;
                    }
                    .content {
                        padding: 20px 15px;
                    }
                    .factura-info {
                        padding: 15px;
                    }
                    .factura-info h2 {
                        font-size: 18px;
                    }
                    .factura-info p {
                        font-size: 13px;
                    }
                    .items-section h3 {
                        font-size: 16px;
                    }
                    .table-wrapper {
                        margin: 0;
                    }
                    table {
                        min-width: 100%;
                        font-size: 12px;
                    }
                    th {
                        padding: 8px 6px;
                        font-size: 11px;
                    }
                    td {
                        padding: 8px 6px;
                        font-size: 12px;
                    }
                    .total-label {
                        font-size: 14px;
                        padding: 12px 8px;
                    }
                    .total-amount {
                        font-size: 18px;
                        padding: 12px 8px;
                    }
                    .footer {
                        font-size: 12px;
                        margin-top: 25px;
                        padding-top: 20px;
                    }
                }
                /* Estilos para pantallas muy pequeñas */
                @media only screen and (max-width: 400px) {
                    .header {
                        padding: 20px 10px;
                    }
                    .logo {
                        max-width: 100px;
                    }
                    .header h1 {
                        font-size: 20px;
                    }
                    .content {
                        padding: 15px 10px;
                    }
                    .factura-info {
                        padding: 12px;
                    }
                    th {
                        padding: 6px 4px;
                        font-size: 10px;
                    }
                    td {
                        padding: 6px 4px;
                        font-size: 11px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <div class="logo-container">
                        <img src="${logoUrl}" alt="ToysWalls Logo" class="logo" style="max-width: 150px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);" />
                    </div>
                    <h1>TOYS WALLS</h1>
                    <p>Sistema de Inventario</p>
                </div>
                <div class="content">
                    <div class="factura-info">
                        <h2>FACTURA ELECTRÓNICA</h2>
                        <p><strong>Código de Factura:</strong> ${facturaData.codigo_factura}</p>
                        <p><strong>Fecha y Hora:</strong> ${fecha}</p>
                        <p><strong>Cliente:</strong> ${clienteNombre}</p>
                        <p><strong>Correo:</strong> ${clienteEmail}</p>
                    </div>
                    
                    <div class="items-section">
                        <h3>Detalle de la Compra</h3>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style="text-align: center;">#</th>
                                        <th>Juguete</th>
                                        <th>Código</th>
                                        <th style="text-align: right;">Precio Unit.</th>
                                        <th style="text-align: center;">Cant.</th>
                                        <th style="text-align: right;">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHTML}
                                </tbody>
                                <tfoot>
                                    <tr class="total-row">
                                        <td colspan="5" class="total-label">TOTAL A PAGAR:</td>
                                        <td class="total-amount">$${facturaData.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p class="brand">ToysWalls - Sistema de Inventario</p>
                        <p>Gracias por su compra. Esperamos verlo pronto.</p>
                        <p style="margin-top: 15px; font-size: 12px; color: #94a3b8;">
                            Este es un correo automático, por favor no responda a este mensaje.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
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
        const templateParams = {
            to_email: clienteEmail.trim(), // Campo principal del destinatario
            to_name: clienteNombre || 'Cliente',
            reply_to: config.FROM_EMAIL, // Email de respuesta
            from_name: config.FROM_NAME,
            subject: `Factura ${facturaData.codigo_factura} - ToysWalls`,
            message_html: facturaHTML,
            message: facturaHTML, // Algunas plantillas usan 'message' en lugar de 'message_html'
            factura_codigo: facturaData.codigo_factura,
            factura_total: `$${facturaData.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
            factura_fecha: new Date().toLocaleString('es-CO'),
            items_detalle: itemsTexto,
            cliente_nombre: clienteNombre || 'Cliente',
            cliente_email: clienteEmail.trim() // Duplicado por si la plantilla lo requiere
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

async function loadTiendas() {
    const tiendasList = document.getElementById('tiendasList');
    if (!tiendasList) return;
    
    tiendasList.innerHTML = '<p style="text-align: center; color: #64748b;">Cargando tiendas...</p>';
    
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const { data: tiendas, error } = await window.supabaseClient
            .from('tiendas')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .order('nombre');

        if (error) throw error;

        if (!tiendas || tiendas.length === 0) {
            tiendasList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay tiendas registradas.</p>';
            return;
        }

        // Cargar empleados y juguetes para cada tienda
        for (const tienda of tiendas) {
            const [empleados, juguetes] = await Promise.all([
                window.supabaseClient.from('empleados').select('*').eq('tienda_id', tienda.id),
                window.supabaseClient.from('juguetes').select('*').eq('tienda_id', tienda.id)
            ]);
            
            tienda.empleados = empleados.data || [];
            tienda.juguetes = juguetes.data || [];
        }

        tiendasList.innerHTML = '';
        tiendas.forEach(tienda => {
            const tiendaCard = createTiendaCard(tienda);
            tiendasList.appendChild(tiendaCard);
        });
    } catch (error) {
        console.error('Error al cargar tiendas:', error);
        tiendasList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar las tiendas</p>';
    }
}

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

        if (!usuarios || usuarios.length === 0) {
            usuariosList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay usuarios registrados.</p>';
            return;
        }

        usuariosList.innerHTML = '';
        usuarios.forEach(usuario => {
            const usuarioCard = createUsuarioCard(usuario);
            usuariosList.appendChild(usuarioCard);
        });
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        usuariosList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar los usuarios</p>';
    }
}

function createUsuarioCard(usuario) {
    const card = document.createElement('div');
    card.className = 'bodega-card';
    card.innerHTML = `
        <div class="bodega-info">
            <h3>${usuario.nombre}</h3>
            <p><i class="fas fa-envelope"></i> ${usuario.email || 'Sin email'}</p>
            <p><i class="fas fa-user-tag"></i> ${usuario.tipo_usuarios?.nombre || 'N/A'}</p>
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

async function loadJuguetesDisponibles() {
    const origenTipo = document.getElementById('origenTipo').value;
    const origenId = document.getElementById('origenSelect').value;
    const container = document.getElementById('juguetesDisponiblesList');

    if (!origenTipo || !origenId) {
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
            container.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay juguetes disponibles en el origen seleccionado</p>';
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
    } catch (error) {
        console.error('Error al cargar juguetes:', error);
        container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error al cargar juguetes</p>';
    }
}

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
                const { data: usuarios } = await window.supabaseClient
                    .from('usuarios')
                    .select('nombre, email, tipo_usuario_id, activo, created_at')
                    .eq('empresa_id', user.empresa_id);
                data = usuarios.data || [];
                filename = 'usuarios.xlsx';
                break;
            case 'juguetes':
                const { data: juguetes } = await window.supabaseClient
                    .from('juguetes')
                    .select('nombre, codigo, cantidad, created_at')
                    .eq('empresa_id', user.empresa_id);
                data = juguetes.data || [];
                filename = 'juguetes.xlsx';
                break;
            case 'facturas':
                const { data: facturas } = await window.supabaseClient
                    .from('facturas')
                    .select('codigo_factura, cliente_nombre, cliente_documento, cliente_email, total, created_at')
                    .eq('empresa_id', user.empresa_id);
                data = facturas.data || [];
                filename = 'facturas.xlsx';
                break;
            case 'ventas':
                const { data: ventas } = await window.supabaseClient
                    .from('ventas')
                    .select('codigo_venta, precio_venta, metodo_pago, created_at')
                    .eq('empresa_id', user.empresa_id);
                data = ventas.data || [];
                filename = 'ventas.xlsx';
                break;
            case 'movimientos':
                const { data: movimientos } = await window.supabaseClient
                    .from('movimientos')
                    .select('tipo_origen, origen_id, tipo_destino, destino_id, cantidad, created_at')
                    .eq('empresa_id', user.empresa_id);
                data = movimientos.data || [];
                filename = 'movimientos.xlsx';
                break;
        }

        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Datos');
            XLSX.writeFile(wb, filename);
            alert('Archivo exportado correctamente');
        } else {
            alert('La librería de Excel no está cargada');
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
            
            const nombre = document.getElementById('usuarioNombre').value.trim();
            const email = document.getElementById('usuarioEmail').value.trim();
            const password = document.getElementById('usuarioPassword').value;
            const tipoUsuarioId = parseInt(document.getElementById('usuarioTipo').value);
            
            if (!nombre || !email || !password || !tipoUsuarioId) {
                showUsuarioMessage('Por favor, completa todos los campos', 'error');
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

// ============================================
// USUARIOS - CRUD COMPLETO
// ============================================

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

        if (!usuarios || usuarios.length === 0) {
            usuariosList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay usuarios registrados.</p>';
            return;
        }

        usuariosList.innerHTML = '';
        usuarios.forEach(usuario => {
            const usuarioCard = createUsuarioCard(usuario);
            usuariosList.appendChild(usuarioCard);
        });
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        usuariosList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar los usuarios</p>';
    }
}

function createUsuarioCard(usuario) {
    const card = document.createElement('div');
    card.className = 'bodega-card';
    card.innerHTML = `
        <div class="bodega-info">
            <h3>${usuario.nombre}</h3>
            <p><i class="fas fa-envelope"></i> ${usuario.email || 'Sin email'}</p>
            <p><i class="fas fa-user-tag"></i> ${usuario.tipo_usuarios?.nombre || 'N/A'}</p>
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

// Formulario para agregar usuario (se configura en setupUsuarioForm)

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
    
    setTimeout(() => {
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
    }, 5000);
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

        document.getElementById('editUsuarioNombre').value = usuario.nombre;
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
        
        const nombre = document.getElementById('editUsuarioNombre').value.trim();
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

// Toggle del acordeón "Agregar Tienda"
const agregarTiendaHeader = document.getElementById('agregarTiendaHeader');
const agregarTiendaContent = document.getElementById('agregarTiendaContent');

if (agregarTiendaHeader && agregarTiendaContent) {
    agregarTiendaHeader.addEventListener('click', function() {
        agregarTiendaContent.classList.toggle('active');
        const icon = agregarTiendaHeader.querySelector('.accordion-icon');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
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
window.loadDashboardSummary = loadDashboardSummary;
window.loadTiendas = loadTiendas;
window.loadUsuarios = loadUsuarios;
window.loadAnalisis = loadAnalisis;
window.initAbastecer = initAbastecer;
window.loadTiendasForEmpleados = loadTiendasForEmpleados;
window.aplicarFiltroVentas = aplicarFiltroVentas;
window.aplicarFiltroGanancias = aplicarFiltroGanancias;
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
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0;">
                    <div>
                        <h3 style="color: #8b5cf6; margin-bottom: 10px;">${codigoVenta}</h3>
                        <p style="color: #64748b; margin: 5px 0;"><strong>Fecha:</strong> ${fecha}</p>
                        <p style="color: #64748b; margin: 5px 0;"><strong>Empleado:</strong> ${empleado}</p>
                        <p style="color: #64748b; margin: 5px 0;"><strong>Total:</strong> <span style="color: #10b981; font-weight: bold; font-size: 18px;">$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span></p>
                    </div>
                    <button type="button" class="btn-primary" style="background: #ef4444;" onclick="procesarDevolucion('${codigoVenta}')">
                        <i class="fas fa-undo"></i> Procesar Devolución
                    </button>
                </div>
                <div>
                    <h4 style="color: #1e293b; margin-bottom: 15px;">Items de la Venta:</h4>
                    <table class="inventario-table" style="width: 100%;">
                        <thead>
                            <tr>
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

// Función global para procesar devolución
window.procesarDevolucion = async function(codigoVenta) {
    if (!confirm('¿Estás seguro de que deseas procesar esta devolución?\n\nEsta acción:\n- Agregará los juguetes nuevamente al inventario\n- Eliminará la venta del sistema\n\nEsta acción no se puede deshacer.')) {
        return;
    }

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Obtener todas las ventas con ese código
        const { data: ventas, error: ventasError } = await window.supabaseClient
            .from('ventas')
            .select(`
                *,
                juguetes(id, nombre, codigo, cantidad, bodega_id, tienda_id, empresa_id)
            `)
            .eq('codigo_venta', codigoVenta)
            .eq('empresa_id', user.empresa_id);

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

        showAjustesMessage(`Devolución procesada correctamente. ${ventasEliminadas} venta(s) eliminada(s) y juguetes agregados nuevamente al inventario.`, 'success');
        
        // Limpiar búsqueda
        document.getElementById('buscarVentaCodigo').value = '';
        document.getElementById('ventasListContainer').innerHTML = `
            <p style="text-align: center; color: #64748b; padding: 40px;">
                Ingresa un código de venta para buscar y realizar una devolución.
            </p>
        `;

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

