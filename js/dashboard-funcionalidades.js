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

function initRegistrarVenta() {
    const form = document.getElementById('registrarVentaForm');
    const jugueteCodigoInput = document.getElementById('ventaJugueteCodigo');
    const empleadoCodigoInput = document.getElementById('ventaEmpleadoCodigo');
    const agregarItemBtn = document.getElementById('agregarItemBtn');
    const facturarBtn = document.getElementById('facturarBtn');
    
    ventaItems = []; // Reiniciar items

    // Buscar juguete por código
    jugueteCodigoInput.addEventListener('blur', async function() {
        const codigo = this.value.trim();
        if (!codigo) return;

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            const { data: juguetes, error } = await window.supabaseClient
                .from('juguetes')
                .select('*')
                .eq('codigo', codigo)
                .eq('empresa_id', user.empresa_id)
                .limit(1);

            if (error) throw error;

            const jugueteInfo = document.getElementById('jugueteInfo');
            if (juguetes && juguetes.length > 0) {
                const juguete = juguetes[0];
                jugueteInfo.innerHTML = `
                    <div class="info-box success">
                        <strong>${juguete.nombre}</strong><br>
                        <small>Cantidad disponible: ${juguete.cantidad}</small>
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
                empleadoInfo.innerHTML = `
                    <div class="info-box success">
                        <strong>${empleado.nombre}</strong>
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

    // Agregar item a la venta
    agregarItemBtn.addEventListener('click', async function() {
        const jugueteCodigo = jugueteCodigoInput.value.trim();
        const empleadoCodigo = empleadoCodigoInput.value.trim();
        const precio = parseFloat(document.getElementById('ventaPrecio').value);
        const metodoPago = document.getElementById('ventaMetodoPago').value;

        if (!jugueteCodigo || !empleadoCodigo || !precio || !metodoPago) {
            showVentaMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Verificar juguete
            const { data: juguetes } = await window.supabaseClient
                .from('juguetes')
                .select('*')
                .eq('codigo', jugueteCodigo)
                .eq('empresa_id', user.empresa_id)
                .single();

            if (!juguetes) {
                showVentaMessage('Juguete no encontrado', 'error');
                return;
            }

            // Verificar empleado
            const { data: empleados } = await window.supabaseClient
                .from('empleados')
                .select('*')
                .eq('codigo', empleadoCodigo)
                .eq('empresa_id', user.empresa_id)
                .single();

            if (!empleados) {
                showVentaMessage('Empleado no encontrado', 'error');
                return;
            }

            // Agregar item
            ventaItems.push({
                juguete_id: juguetes.id,
                juguete_nombre: juguetes.nombre,
                juguete_codigo: juguetes.codigo,
                empleado_id: empleados.id,
                empleado_nombre: empleados.nombre,
                empleado_codigo: empleados.codigo,
                precio: precio,
                metodo_pago: metodoPago
            });

            if (typeof updateVentaItemsList === 'function') {
                updateVentaItemsList();
            }
            
            // Limpiar campos
            jugueteCodigoInput.value = '';
            document.getElementById('ventaPrecio').value = '';
            document.getElementById('jugueteInfo').style.display = 'none';
            document.getElementById('empleadoInfo').style.display = 'none';

            if (ventaItems.length > 0) {
                facturarBtn.style.display = 'inline-block';
            }
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

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Registrar cada item como venta
            for (const item of ventaItems) {
                const codigoVenta = await generarCodigoVenta();
                
                const { error } = await window.supabaseClient
                    .from('ventas')
                    .insert({
                        codigo_venta: codigoVenta,
                        juguete_id: item.juguete_id,
                        empleado_id: item.empleado_id,
                        precio_venta: item.precio,
                        metodo_pago: item.metodo_pago,
                        empresa_id: user.empresa_id
                    });

                if (error) throw error;

                // Reducir cantidad del juguete
                const { data: juguete } = await window.supabaseClient
                    .from('juguetes')
                    .select('cantidad')
                    .eq('id', item.juguete_id)
                    .single();

                if (juguete && juguete.cantidad > 0) {
                    await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: juguete.cantidad - 1 })
                        .eq('id', item.juguete_id);
                }
            }

            showVentaMessage('Venta registrada correctamente', 'success');
            ventaItems = [];
            updateVentaItemsList();
            form.reset();
            facturarBtn.style.display = 'none';
            
            // Recargar resumen
            if (typeof loadDashboardSummary === 'function') {
                loadDashboardSummary();
            }
        } catch (error) {
            console.error('Error al registrar venta:', error);
            showVentaMessage('Error al registrar la venta: ' + error.message, 'error');
        }
    });

    // Botón facturar
    facturarBtn.addEventListener('click', function() {
        if (ventaItems.length === 0) {
            showVentaMessage('No hay items para facturar', 'error');
            return;
        }
        showFacturarView();
    });
}

// Función global para remover item
window.removeVentaItem = function(index) {
    ventaItems.splice(index, 1);
    updateVentaItemsList();
    if (ventaItems.length === 0) {
        document.getElementById('facturarBtn').style.display = 'none';
    }
};

// Función para actualizar lista de items (debe ser global)
window.updateVentaItemsList = function() {
    const itemsList = document.getElementById('ventaItemsList');
    if (!itemsList) return;
    
    if (ventaItems.length === 0) {
        itemsList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay items agregados</p>';
        return;
    }

    itemsList.innerHTML = ventaItems.map((item, index) => `
        <div class="venta-item-card">
            <div class="item-info">
                <strong>${item.juguete_nombre}</strong> (${item.juguete_codigo})<br>
                <small>Empleado: ${item.empleado_nombre} | Método: ${item.metodo_pago}</small>
            </div>
            <div class="item-actions">
                <span class="item-precio">$${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                <button type="button" class="btn-remove" onclick="removeVentaItem(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
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

function showFacturarView() {
    if (ventaItems.length === 0) return;

    // Calcular total
    const total = ventaItems.reduce((sum, item) => sum + item.precio, 0);
    
    // Generar código de factura
    const codigoFactura = 'FACT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + 
        String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    // Mostrar vista de facturar
    const facturarView = document.getElementById('facturarView');
    const ventaView = document.getElementById('ventaView');
    
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
            <td>1</td>
            <td>$${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
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
        document.getElementById('facturarView').style.display = 'none';
        document.getElementById('ventaView').style.display = 'block';
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
                await window.supabaseClient
                    .from('facturas_items')
                    .insert({
                        factura_id: factura.id,
                        juguete_nombre: item.juguete_nombre,
                        juguete_codigo: item.juguete_codigo,
                        precio: item.precio,
                        cantidad: 1,
                        subtotal: item.precio
                    });
            }
            
            // Aquí deberías llamar a una función de Supabase Edge Function para enviar el correo
            // Por ahora solo mostramos éxito
            showFacturaMessage('Factura creada correctamente. El correo se enviará próximamente.', 'success');
            
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
    card.innerHTML = `
        <div class="bodega-info">
            <h3>${tienda.nombre}</h3>
            <p><i class="fas fa-map-marker-alt"></i> ${tienda.direccion}</p>
            <div class="tienda-stats">
                <span><i class="fas fa-user-tie"></i> ${tienda.empleados.length} Empleados</span>
                <span><i class="fas fa-boxes"></i> ${tienda.juguetes.length} Juguetes</span>
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

function initAbastecer() {
    const origenTipo = document.getElementById('origenTipo');
    const origenSelect = document.getElementById('origenSelect');
    const destinoTipo = document.getElementById('destinoTipo');
    const destinoSelect = document.getElementById('destinoSelect');
    const form = document.getElementById('abastecerForm');

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

        // Obtener juguetes seleccionados
        const juguetesSeleccionados = Array.from(document.querySelectorAll('.juguete-movimiento:checked'))
            .map(cb => ({
                id: parseInt(cb.dataset.jugueteId),
                cantidad: parseInt(cb.dataset.cantidad)
            }))
            .filter(j => j.cantidad > 0);

        if (juguetesSeleccionados.length === 0) {
            showAbastecerMessage('Debes seleccionar al menos un juguete para mover', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            for (const juguete of juguetesSeleccionados) {
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

                // Actualizar ubicación del juguete
                const updateData = {};
                if (destinoTipoVal === 'bodega') {
                    updateData.bodega_id = destinoId;
                    updateData.tienda_id = null;
                } else {
                    updateData.tienda_id = destinoId;
                    updateData.bodega_id = null;
                }

                await window.supabaseClient
                    .from('juguetes')
                    .update(updateData)
                    .eq('id', juguete.id);
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
                const { data: jugueteActual } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('id', juguete.id)
                    .single();

                if (!jugueteActual || jugueteActual.cantidad < juguete.cantidad) {
                    showAbastecerMessage(`No hay suficiente cantidad del juguete ${jugueteActual?.nombre || ''}`, 'error');
                    continue;
                }

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

                // Actualizar cantidad en origen (reducir)
                await window.supabaseClient
                    .from('juguetes')
                    .update({ cantidad: jugueteActual.cantidad - juguete.cantidad })
                    .eq('id', juguete.id);

                // Actualizar ubicación del juguete (mover a destino)
                const updateData = {
                    cantidad: jugueteActual.cantidad - juguete.cantidad
                };
                
                if (destinoTipoVal === 'bodega') {
                    updateData.bodega_id = destinoId;
                    updateData.tienda_id = null;
                } else {
                    updateData.tienda_id = destinoId;
                    updateData.bodega_id = null;
                }
                
                // Actualizar el juguete existente (moverlo a destino)
                await window.supabaseClient
                    .from('juguetes')
                    .update(updateData)
                    .eq('id', juguete.id);
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

