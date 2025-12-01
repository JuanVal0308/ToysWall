// ============================================
// GESTIÓN DE CLIENTES
// ============================================

let clientesData = [];
let clientesFiltrados = [];
let paginaActualClientes = 1;
const itemsPorPaginaClientes = 20;
let clientesInitialized = false;

// Función para inicializar la vista de clientes
function initClientes() {
    const clientesView = document.getElementById('clientesView');
    if (!clientesView) return;

    // Solo inicializar una vez
    if (clientesInitialized) return;
    clientesInitialized = true;

    // Cargar clientes
    loadClientes();

    // Formulario agregar cliente
    const nuevoClienteForm = document.getElementById('nuevoClienteForm');
    if (nuevoClienteForm) {
        nuevoClienteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await agregarCliente();
        });
    }

    // Modal de cliente
    const clienteModalForm = document.getElementById('clienteModalForm');
    if (clienteModalForm) {
        clienteModalForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await guardarClienteModal();
        });
    }

    // Botones del modal
    const clienteModal = document.getElementById('clienteModal');
    const closeClienteModal = document.getElementById('closeClienteModal');
    const cancelClienteModalBtn = document.getElementById('cancelClienteModalBtn');
    
    const cerrarModalCliente = () => {
        if (clienteModal) {
            clienteModal.style.display = 'none';
            // Limpiar formulario
            const form = document.getElementById('clienteModalForm');
            if (form) form.reset();
            // Limpiar mensajes
            const errorMsg = document.getElementById('clienteModalErrorMessage');
            const successMsg = document.getElementById('clienteModalSuccessMessage');
            if (errorMsg) errorMsg.style.display = 'none';
            if (successMsg) successMsg.style.display = 'none';
        }
    };
    
    if (closeClienteModal) {
        closeClienteModal.addEventListener('click', cerrarModalCliente);
    }
    if (cancelClienteModalBtn) {
        cancelClienteModalBtn.addEventListener('click', cerrarModalCliente);
    }
    
    // Cerrar modal al hacer click fuera
    if (clienteModal) {
        clienteModal.addEventListener('click', function(e) {
            if (e.target === clienteModal) {
                cerrarModalCliente();
            }
        });
    }

    // Búsqueda de clientes
    const buscarCliente = document.getElementById('buscarCliente');
    if (buscarCliente) {
        buscarCliente.addEventListener('input', function() {
            filtrarClientes();
        });
    }

    // Acordeón agregar cliente
    const agregarClienteHeader = document.getElementById('agregarClienteHeader');
    if (agregarClienteHeader) {
        agregarClienteHeader.addEventListener('click', function() {
            const content = document.getElementById('agregarClienteContent');
            const icon = this.querySelector('.accordion-icon');
            if (content && icon) {
                content.classList.toggle('active');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    }

    // Modal de pago
    const pagoModalForm = document.getElementById('pagoModalForm');
    if (pagoModalForm) {
        pagoModalForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await registrarPago();
        });
    }

    const closePagoModal = document.getElementById('closePagoModal');
    const cancelPagoModalBtn = document.getElementById('cancelPagoModalBtn');
    const pagoModal = document.getElementById('pagoModal');
    
    const cerrarModalPago = () => {
        if (pagoModal) {
            pagoModal.style.display = 'none';
            const form = document.getElementById('pagoModalForm');
            if (form) form.reset();
            const errorMsg = document.getElementById('pagoModalErrorMessage');
            const successMsg = document.getElementById('pagoModalSuccessMessage');
            if (errorMsg) errorMsg.style.display = 'none';
            if (successMsg) successMsg.style.display = 'none';
        }
    };
    
    if (closePagoModal) {
        closePagoModal.addEventListener('click', cerrarModalPago);
    }
    if (cancelPagoModalBtn) {
        cancelPagoModalBtn.addEventListener('click', cerrarModalPago);
    }
    if (pagoModal) {
        pagoModal.addEventListener('click', function(e) {
            if (e.target === pagoModal) {
                cerrarModalPago();
            }
        });
    }
}

// Función para cargar clientes
async function loadClientes() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user || !user.empresa_id) {
            console.error('Usuario no autenticado');
            return;
        }

        const { data: clientes, error } = await window.supabaseClient
            .from('clientes')
            .select('*')
            .eq('empresa_id', user.empresa_id)
            .order('nombre', { ascending: true });

        if (error) throw error;

        clientesData = clientes || [];
        clientesFiltrados = [...clientesData];
        paginaActualClientes = 1;
        renderizarClientes();
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        showClienteMessage('Error al cargar clientes: ' + error.message, 'error');
    }
}

// Función para filtrar clientes
function filtrarClientes() {
    const termino = document.getElementById('buscarCliente').value.trim().toLowerCase();
    
    if (!termino) {
        clientesFiltrados = [...clientesData];
    } else {
        clientesFiltrados = clientesData.filter(cliente => {
            const nombre = (cliente.nombre || '').toLowerCase();
            const telefono = (cliente.telefono || '').toLowerCase();
            const correo = (cliente.correo || '').toLowerCase();
            return nombre.includes(termino) || telefono.includes(termino) || correo.includes(termino);
        });
    }
    
    paginaActualClientes = 1;
    renderizarClientes();
}

// Función para renderizar clientes
function renderizarClientes() {
    const clientesList = document.getElementById('clientesList');
    if (!clientesList) return;

    if (clientesFiltrados.length === 0) {
        clientesList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">No hay clientes registrados</p>';
        document.getElementById('clientesPagination').innerHTML = '';
        return;
    }

    const inicio = (paginaActualClientes - 1) * itemsPorPaginaClientes;
    const fin = inicio + itemsPorPaginaClientes;
    const clientesPagina = clientesFiltrados.slice(inicio, fin);

    // Renderizar clientes (la información de ventas se carga de forma asíncrona)
    // Renderizar clientes y cargar información de ventas después
    clientesList.innerHTML = clientesPagina.map(cliente => {
        return `
            <div class="cliente-card" data-cliente-id="${cliente.id}" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
                    <div style="flex: 1; min-width: 250px;">
                        <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 18px;">
                            <i class="fas fa-user" style="color: #6366f1; margin-right: 8px;"></i>
                            ${cliente.nombre}
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 8px; color: #64748b; font-size: 14px;">
                            ${cliente.telefono ? `<div><i class="fas fa-phone" style="color: #10b981; margin-right: 6px;"></i>${cliente.telefono}</div>` : ''}
                            ${cliente.correo ? `<div><i class="fas fa-envelope" style="color: #3b82f6; margin-right: 6px;"></i>${cliente.correo}</div>` : ''}
                            ${cliente.direccion ? `<div><i class="fas fa-map-marker-alt" style="color: #f59e0b; margin-right: 6px;"></i>${cliente.direccion}</div>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: flex-end;">
                        <div id="saldoCliente${cliente.id}" class="saldo-pendiente-container" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 15px; text-align: right;">
                            <div style="color: #991b1b; font-size: 12px; margin-bottom: 4px;">Saldo Pendiente</div>
                            <div class="saldo-pendiente" style="color: #dc2626; font-size: 18px; font-weight: bold;">$0</div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn-secondary" onclick="editarCliente(${cliente.id})" style="padding: 8px 16px;">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button type="button" class="btn-secondary" onclick="verVentasCliente(${cliente.id})" style="padding: 8px 16px; background: #6366f1; color: white;">
                                <i class="fas fa-shopping-cart"></i> Ventas
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Cargar información de ventas para cada cliente
    clientesPagina.forEach(cliente => {
        obtenerInfoVentasCliente(cliente.id).then(info => {
            const saldoContainer = document.getElementById(`saldoCliente${cliente.id}`);
            if (saldoContainer && info.totalPendiente > 0) {
                const saldoElement = saldoContainer.querySelector('.saldo-pendiente');
                if (saldoElement) {
                    saldoElement.textContent = `$${info.totalPendiente.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                    saldoContainer.style.display = 'block';
                }
            }
        });
    });

    // Paginación
    const totalPaginas = Math.ceil(clientesFiltrados.length / itemsPorPaginaClientes);
    renderizarPaginacionClientes(totalPaginas);
}

// Función para obtener información de ventas del cliente
async function obtenerInfoVentasCliente(clienteId) {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user || !user.empresa_id) {
            return { totalPendiente: 0, totalPagado: 0, ventasCount: 0 };
        }

        // Obtener todas las ventas del cliente (solo al por mayor)
        const { data: ventas, error: ventasError } = await window.supabaseClient
            .from('ventas')
            .select('id, precio_venta, metodo_pago, abono, created_at')
            .eq('cliente_id', clienteId)
            .eq('empresa_id', user.empresa_id)
            .eq('es_por_mayor', true);

        if (ventasError) throw ventasError;

        // Obtener todos los pagos del cliente
        const { data: pagos, error: pagosError } = await window.supabaseClient
            .from('pagos')
            .select('monto, venta_id')
            .eq('cliente_id', clienteId)
            .eq('empresa_id', user.empresa_id);

        if (pagosError) throw pagosError;

        // Calcular totales
        let totalPendiente = 0;
        let totalPagado = 0;
        const ventasIds = ventas.map(v => v.id);

        ventas.forEach(venta => {
            const totalVenta = parseFloat(venta.precio_venta || 0);
            const abonoInicial = parseFloat(venta.abono || 0);
            
            // Sumar pagos adicionales de esta venta
            const pagosVenta = (pagos || []).filter(p => p.venta_id === venta.id);
            const totalPagos = pagosVenta.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
            
            const totalPagadoVenta = abonoInicial + totalPagos;
            const pendienteVenta = totalVenta - totalPagadoVenta;
            
            if (venta.metodo_pago === 'credito' && pendienteVenta > 0) {
                totalPendiente += pendienteVenta;
            }
            
            totalPagado += totalPagadoVenta;
        });

        return {
            totalPendiente: totalPendiente,
            totalPagado: totalPagado,
            ventasCount: ventas ? ventas.length : 0
        };
    } catch (error) {
        console.error('Error al obtener información de ventas:', error);
        return { totalPendiente: 0, totalPagado: 0, ventasCount: 0 };
    }
}

// Función para renderizar paginación
function renderizarPaginacionClientes(totalPaginas) {
    const pagination = document.getElementById('clientesPagination');
    if (!pagination) return;

    if (totalPaginas <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    if (paginaActualClientes > 1) {
        html += `<button class="pagination-btn" onclick="cambiarPaginaClientes(${paginaActualClientes - 1})">
            <i class="fas fa-chevron-left"></i> Anterior
        </button>`;
    }

    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaActualClientes - 2 && i <= paginaActualClientes + 2)) {
            html += `<button class="pagination-btn ${i === paginaActualClientes ? 'active' : ''}" onclick="cambiarPaginaClientes(${i})">
                ${i}
            </button>`;
        } else if (i === paginaActualClientes - 3 || i === paginaActualClientes + 3) {
            html += `<span class="pagination-dots">...</span>`;
        }
    }

    if (paginaActualClientes < totalPaginas) {
        html += `<button class="pagination-btn" onclick="cambiarPaginaClientes(${paginaActualClientes + 1})">
            Siguiente <i class="fas fa-chevron-right"></i>
        </button>`;
    }

    pagination.innerHTML = html;
}

// Función para cambiar página
window.cambiarPaginaClientes = function(pagina) {
    paginaActualClientes = pagina;
    renderizarClientes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Función para agregar cliente
async function agregarCliente() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const nombre = document.getElementById('clienteNombre').value.trim();
        const telefono = document.getElementById('clienteTelefono').value.trim();
        const correo = document.getElementById('clienteCorreo').value.trim();
        const direccion = document.getElementById('clienteDireccion').value.trim();

        if (!nombre) {
            showClienteMessage('El nombre es obligatorio', 'error');
            return;
        }

        const { error } = await window.supabaseClient
            .from('clientes')
            .insert({
                nombre,
                telefono: telefono || null,
                correo: correo || null,
                direccion: direccion || null,
                empresa_id: user.empresa_id
            });

        if (error) throw error;

        showClienteMessage('Cliente agregado correctamente', 'success');
        document.getElementById('nuevoClienteForm').reset();
        await loadClientes();
    } catch (error) {
        console.error('Error al agregar cliente:', error);
        showClienteMessage('Error al agregar cliente: ' + error.message, 'error');
    }
}

// Función para abrir modal de cliente
window.abrirClienteModal = function(clienteId = null) {
    const modal = document.getElementById('clienteModal');
    const form = document.getElementById('clienteModalForm');
    const title = document.getElementById('clienteModalTitle');
    
    if (!modal || !form || !title) return;

    if (clienteId) {
        const cliente = clientesData.find(c => c.id === clienteId);
        if (cliente) {
            title.textContent = 'Editar Cliente';
            document.getElementById('clienteModalId').value = cliente.id;
            document.getElementById('clienteModalNombre').value = cliente.nombre || '';
            document.getElementById('clienteModalTelefono').value = cliente.telefono || '';
            document.getElementById('clienteModalCorreo').value = cliente.correo || '';
            document.getElementById('clienteModalDireccion').value = cliente.direccion || '';
        }
    } else {
        title.textContent = 'Agregar Cliente';
        form.reset();
        document.getElementById('clienteModalId').value = '';
    }

    modal.style.display = 'flex';
};

// Función para guardar cliente desde modal
async function guardarClienteModal() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const id = document.getElementById('clienteModalId').value;
        const nombre = document.getElementById('clienteModalNombre').value.trim();
        const telefono = document.getElementById('clienteModalTelefono').value.trim();
        const correo = document.getElementById('clienteModalCorreo').value.trim();
        const direccion = document.getElementById('clienteModalDireccion').value.trim();

        if (!nombre) {
            showClienteModalMessage('El nombre es obligatorio', 'error');
            return;
        }

        if (id) {
            // Actualizar
            const { error } = await window.supabaseClient
                .from('clientes')
                .update({
                    nombre,
                    telefono: telefono || null,
                    correo: correo || null,
                    direccion: direccion || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('empresa_id', user.empresa_id);

            if (error) throw error;
            showClienteModalMessage('Cliente actualizado correctamente', 'success');
        } else {
            // Crear
            const { error } = await window.supabaseClient
                .from('clientes')
                .insert({
                    nombre,
                    telefono: telefono || null,
                    correo: correo || null,
                    direccion: direccion || null,
                    empresa_id: user.empresa_id
                });

            if (error) throw error;
            showClienteModalMessage('Cliente agregado correctamente', 'success');
        }

        setTimeout(() => {
            document.getElementById('clienteModal').style.display = 'none';
            loadClientes();
            // Recargar clientes en el select de ventas al por mayor si existe
            if (typeof loadClientesParaVenta === 'function') {
                loadClientesParaVenta();
            }
        }, 1000);
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        showClienteModalMessage('Error al guardar cliente: ' + error.message, 'error');
    }
}

// Función para editar cliente
window.editarCliente = function(clienteId) {
    abrirClienteModal(clienteId);
};

// Función para ver ventas del cliente
window.verVentasCliente = async function(clienteId) {
    const cliente = clientesData.find(c => c.id === clienteId);
    if (!cliente) return;

    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Obtener ventas del cliente
        const { data: ventas, error: ventasError } = await window.supabaseClient
            .from('ventas')
            .select(`
                id,
                codigo_venta,
                precio_venta,
                cantidad,
                metodo_pago,
                abono,
                created_at,
                juguetes(nombre, codigo, item),
                empleados(nombre)
            `)
            .eq('cliente_id', clienteId)
            .eq('empresa_id', user.empresa_id)
            .eq('es_por_mayor', true)
            .order('created_at', { ascending: false });

        if (ventasError) throw ventasError;

        // Obtener pagos
        const { data: pagos, error: pagosError } = await window.supabaseClient
            .from('pagos')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('empresa_id', user.empresa_id)
            .order('created_at', { ascending: false });

        if (pagosError) throw pagosError;

        // Crear modal de ventas
        mostrarModalVentasCliente(cliente, ventas || [], pagos || [], clienteId);
    } catch (error) {
        console.error('Error al cargar ventas del cliente:', error);
        alert('Error al cargar las ventas del cliente: ' + error.message);
    }
};

// Función para mostrar modal de ventas del cliente
function mostrarModalVentasCliente(cliente, ventas, pagos, clienteId) {
    // Crear modal dinámicamente
    const modalHTML = `
        <div class="modal-overlay" id="ventasClienteModal" style="display: flex;">
            <div class="modal-content" style="max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>Ventas y Pagos - ${cliente.nombre}</h3>
                    <button class="modal-close" id="closeVentasClienteModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #1e293b; margin-bottom: 15px;">Información del Cliente</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            ${cliente.telefono ? `<div><strong>Teléfono:</strong> ${cliente.telefono}</div>` : ''}
                            ${cliente.correo ? `<div><strong>Correo:</strong> ${cliente.correo}</div>` : ''}
                            ${cliente.direccion ? `<div><strong>Dirección:</strong> ${cliente.direccion}</div>` : ''}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #1e293b; margin-bottom: 15px;">Ventas</h4>
                        <div id="ventasClienteList" style="max-height: 400px; overflow-y: auto;">
                            ${renderizarVentasCliente(ventas, pagos, clienteId)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remover modal anterior si existe
    const modalAnterior = document.getElementById('ventasClienteModal');
    if (modalAnterior) modalAnterior.remove();

    // Agregar modal al body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Configurar botón cerrar
    const closeBtn = document.getElementById('closeVentasClienteModal');
    const modal = document.getElementById('ventasClienteModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.remove();
        });
    }
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

// Función para renderizar ventas del cliente
function renderizarVentasCliente(ventas, pagos, clienteId) {
    if (!ventas || ventas.length === 0) {
        return '<p style="text-align: center; color: #64748b; padding: 20px;">No hay ventas registradas</p>';
    }

    return ventas.map(venta => {
        const totalVenta = parseFloat(venta.precio_venta || 0);
        const abonoInicial = parseFloat(venta.abono || 0);
        const pagosVenta = pagos.filter(p => p.venta_id === venta.id);
        const totalPagos = pagosVenta.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
        const totalPagado = abonoInicial + totalPagos;
        const pendiente = totalVenta - totalPagado;
        const esCredito = venta.metodo_pago === 'credito';
        const estaPagado = pendiente <= 0.01; // Tolerancia para errores de redondeo

        const fecha = new Date(venta.created_at).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 15px;">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="font-weight: bold; color: #1e293b; margin-bottom: 8px;">
                            Venta #${venta.codigo_venta}
                        </div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
                            ${fecha}
                        </div>
                        ${venta.juguetes ? `
                            <div style="color: #64748b; font-size: 14px;">
                                <strong>Juguete:</strong> ${venta.juguetes.nombre} (${venta.juguetes.codigo})
                                ${venta.juguetes.item ? ` | ITEM: ${venta.juguetes.item}` : ''}
                            </div>
                            <div style="color: #64748b; font-size: 14px;">
                                <strong>Cantidad:</strong> ${venta.cantidad || 1}
                            </div>
                        ` : ''}
                        ${venta.empleados ? `
                            <div style="color: #64748b; font-size: 14px;">
                                <strong>Empleado:</strong> ${venta.empleados.nombre}
                            </div>
                        ` : ''}
                        <div style="color: #64748b; font-size: 14px;">
                            <strong>Método de Pago:</strong> ${venta.metodo_pago}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 8px;">
                            Total: $${totalVenta.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        ${esCredito ? `
                            <div style="font-size: 14px; color: #10b981; margin-bottom: 4px;">
                                Pagado: $${totalPagado.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            ${!estaPagado ? `
                                <div style="font-size: 16px; font-weight: bold; color: #dc2626; margin-bottom: 8px;">
                                    Pendiente: $${pendiente.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                                <button type="button" class="btn-primary" onclick="abrirModalPago(${venta.id}, ${clienteId})" style="padding: 6px 12px; font-size: 14px;">
                                    <i class="fas fa-money-bill-wave"></i> Registrar Pago
                                </button>
                            ` : `
                                <div style="font-size: 14px; color: #10b981; font-weight: bold;">
                                    <i class="fas fa-check-circle"></i> Pagado
                                </div>
                            `}
                        ` : ''}
                    </div>
                </div>
                ${pagosVenta.length > 0 ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;"><strong>Historial de Pagos:</strong></div>
                        ${pagosVenta.map(pago => {
                            const fechaPago = new Date(pago.created_at).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            });
                            return `
                                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
                                    <span>${fechaPago} - ${pago.metodo_pago}</span>
                                    <span style="font-weight: bold; color: #10b981;">
                                        $${parseFloat(pago.monto || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Función para mostrar mensajes
function showClienteMessage(message, type) {
    const errorMsg = document.getElementById('clienteErrorMessage');
    const successMsg = document.getElementById('clienteSuccessMessage');
    
    if (type === 'error') {
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
        if (successMsg) successMsg.style.display = 'none';
    } else {
        if (successMsg) {
            successMsg.textContent = message;
            successMsg.style.display = 'block';
        }
        if (errorMsg) errorMsg.style.display = 'none';
    }
    
    setTimeout(() => {
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
    }, 5000);
}

// Función para mostrar mensajes en modal
function showClienteModalMessage(message, type) {
    const errorMsg = document.getElementById('clienteModalErrorMessage');
    const successMsg = document.getElementById('clienteModalSuccessMessage');
    
    if (type === 'error') {
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
        if (successMsg) successMsg.style.display = 'none';
    } else {
        if (successMsg) {
            successMsg.textContent = message;
            successMsg.style.display = 'block';
        }
        if (errorMsg) errorMsg.style.display = 'none';
    }
    
    setTimeout(() => {
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
    }, 5000);
}

// Función para abrir modal de pago
window.abrirModalPago = async function(ventaId, clienteId) {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        
        // Obtener información de la venta
        const { data: venta, error: ventaError } = await window.supabaseClient
            .from('ventas')
            .select('precio_venta, abono, metodo_pago')
            .eq('id', ventaId)
            .eq('empresa_id', user.empresa_id)
            .single();

        if (ventaError) throw ventaError;

        // Obtener pagos de la venta
        const { data: pagos, error: pagosError } = await window.supabaseClient
            .from('pagos')
            .select('monto')
            .eq('venta_id', ventaId)
            .eq('empresa_id', user.empresa_id);

        if (pagosError) throw pagosError;

        const totalVenta = parseFloat(venta.precio_venta || 0);
        const abonoInicial = parseFloat(venta.abono || 0);
        const totalPagos = pagos.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
        const totalPagado = abonoInicial + totalPagos;
        const pendiente = totalVenta - totalPagado;

        // Llenar modal
        document.getElementById('pagoModalVentaId').value = ventaId;
        document.getElementById('pagoModalClienteId').value = clienteId || '';
        document.getElementById('pagoModalTotal').value = `$${totalVenta.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById('pagoModalPagado').value = `$${totalPagado.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById('pagoModalPendiente').value = `$${pendiente.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById('pagoModalMonto').max = pendiente;
        document.getElementById('pagoModalMonto').value = '';

        // Mostrar modal
        document.getElementById('pagoModal').style.display = 'flex';
    } catch (error) {
        console.error('Error al abrir modal de pago:', error);
        alert('Error al cargar información del pago: ' + error.message);
    }
};

// Función para registrar pago
async function registrarPago() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const ventaId = parseInt(document.getElementById('pagoModalVentaId').value);
        const clienteId = document.getElementById('pagoModalClienteId').value;
        const monto = parseFloat(document.getElementById('pagoModalMonto').value);
        const metodoPago = document.getElementById('pagoModalMetodo').value;

        if (!ventaId || !monto || monto <= 0 || !metodoPago) {
            showPagoModalMessage('Por favor, completa todos los campos correctamente', 'error');
            return;
        }

        // Verificar que el monto no exceda el pendiente
        const pendienteText = document.getElementById('pagoModalPendiente').value;
        const pendiente = parseFloat(pendienteText.replace(/[^0-9.]/g, ''));
        
        if (monto > pendiente) {
            showPagoModalMessage(`El monto no puede exceder el saldo pendiente ($${pendiente.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`, 'error');
            return;
        }

        // Registrar pago
        const { error } = await window.supabaseClient
            .from('pagos')
            .insert({
                venta_id: ventaId,
                cliente_id: clienteId || null,
                monto: monto,
                metodo_pago: metodoPago,
                empresa_id: user.empresa_id
            });

        if (error) throw error;

        showPagoModalMessage('Pago registrado correctamente', 'success');
        
        // Cerrar modal y recargar
        setTimeout(() => {
            document.getElementById('pagoModal').style.display = 'none';
            // Si hay un modal de ventas abierto, recargarlo
            const ventasModal = document.getElementById('ventasClienteModal');
            if (ventasModal && clienteId) {
                verVentasCliente(parseInt(clienteId));
            }
            // Recargar clientes para actualizar saldos
            loadClientes();
        }, 1000);
    } catch (error) {
        console.error('Error al registrar pago:', error);
        showPagoModalMessage('Error al registrar el pago: ' + error.message, 'error');
    }
}

// Función para mostrar mensajes en modal de pago
function showPagoModalMessage(message, type) {
    const errorMsg = document.getElementById('pagoModalErrorMessage');
    const successMsg = document.getElementById('pagoModalSuccessMessage');
    
    if (type === 'error') {
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
        if (successMsg) successMsg.style.display = 'none';
    } else {
        if (successMsg) {
            successMsg.textContent = message;
            successMsg.style.display = 'block';
        }
        if (errorMsg) errorMsg.style.display = 'none';
    }
    
    setTimeout(() => {
        if (errorMsg) errorMsg.style.display = 'none';
        if (successMsg) successMsg.style.display = 'none';
    }, 5000);
}

