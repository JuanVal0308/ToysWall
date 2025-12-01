// ============================================
// VENTAS AL POR MAYOR
// ============================================

let ventaPorMayorItems = []; // Array para almacenar items de la venta al por mayor
let registrarVentaPorMayorInitialized = false;

function initVentaPorMayor() {
    const form = document.getElementById('registrarVentaPorMayorForm');
    const jugueteCodigoInput = document.getElementById('ventaPorMayorJugueteCodigo');
    const empleadoCodigoInput = document.getElementById('ventaPorMayorEmpleadoCodigo');
    const agregarItemBtn = document.getElementById('agregarItemPorMayorBtn');
    
    if (!form || !jugueteCodigoInput || !empleadoCodigoInput || !agregarItemBtn) {
        return; // Elementos no disponibles aún
    }

    // Solo inicializar una vez
    if (registrarVentaPorMayorInitialized) {
        return;
    }
    
    registrarVentaPorMayorInitialized = true;
    ventaPorMayorItems = []; // Reiniciar items

    // Buscar juguete por código
    jugueteCodigoInput.addEventListener('blur', async function() {
        const codigo = this.value.trim();
        if (!codigo) return;

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            // Buscar TODOS los juguetes con ese código
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

            const jugueteInfo = document.getElementById('juguetePorMayorInfo');
            if (juguetes && juguetes.length > 0) {
                const juguetePrincipal = juguetes[0];
                const nombreJuguete = juguetePrincipal.nombre;
                const fotoUrl = juguetePrincipal.foto_url;
                const precioPorMayor = juguetePrincipal.precio_por_mayor;
                const item = juguetePrincipal.item;
                
                // Calcular cantidad total
                const cantidadTotal = juguetes.reduce((sum, j) => sum + (j.cantidad || 0), 0);
                
                // Obtener todas las ubicaciones donde está disponible
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
                    ubicacionInfo = `<div style="margin-top: 8px;"><strong>Ubicaciones disponibles:</strong><ul style="margin: 4px 0; padding-left: 20px;">${ubicaciones.map(u => `<li>${u.tipo}: ${u.nombre} (${u.cantidad} unidades)</li>`).join('')}</ul></div>`;
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

        if (!codigoJuguete || !codigoEmpleado || !metodoPago) {
            showVentaPorMayorMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Buscar juguete
            const { data: juguetes, error: jugueteError } = await window.supabaseClient
                .from('juguetes')
                .select('*')
                .eq('codigo', codigoJuguete)
                .eq('empresa_id', user.empresa_id)
                .limit(1);

            if (jugueteError) throw jugueteError;
            if (!juguetes || juguetes.length === 0) {
                showVentaPorMayorMessage('Juguete no encontrado', 'error');
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

            // Verificar cantidad disponible
            const cantidadTotal = juguetes.reduce((sum, j) => sum + (j.cantidad || 0), 0);
            if (cantidad > cantidadTotal) {
                showVentaPorMayorMessage(`Cantidad insuficiente. Disponible: ${cantidadTotal}`, 'error');
                return;
            }

            // Agregar item
            ventaPorMayorItems.push({
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

            updateVentaPorMayorItemsList();
            
            // Limpiar campos
            jugueteCodigoInput.value = '';
            empleadoCodigoInput.value = '';
            document.getElementById('ventaPorMayorCantidad').value = '1';
            document.getElementById('ventaPorMayorMetodoPago').value = '';
            document.getElementById('juguetePorMayorInfo').style.display = 'none';
            document.getElementById('empleadoPorMayorInfo').style.display = 'none';
            
            showVentaPorMayorMessage('Item agregado correctamente', 'success');
        } catch (error) {
            console.error('Error al agregar item:', error);
            showVentaPorMayorMessage('Error al agregar item: ' + error.message, 'error');
        }
    });

    // Registrar venta al por mayor
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
            
            // Registrar cada item
            for (const item of ventaPorMayorItems) {
                const { error } = await window.supabaseClient
                    .from('ventas')
                    .insert({
                        codigo_venta: codigoVenta,
                        juguete_id: item.juguete_id,
                        empleado_id: item.empleado_id,
                        cantidad: item.cantidad,
                        precio_venta: item.precio,
                        metodo_pago: item.metodo_pago,
                        empresa_id: user.empresa_id,
                        es_por_mayor: true // Marcar como venta al por mayor
                    });

                if (error) throw error;

                // Reducir cantidad del juguete
                const { data: jugueteData, error: jugueteError } = await window.supabaseClient
                    .from('juguetes')
                    .select('cantidad, bodega_id, tienda_id')
                    .eq('id', item.juguete_id)
                    .single();

                if (jugueteError) throw jugueteError;

                const nuevaCantidad = Math.max(0, (jugueteData.cantidad || 0) - item.cantidad);
                
                const updateData = { cantidad: nuevaCantidad };
                const { error: updateError } = await window.supabaseClient
                    .from('juguetes')
                    .update(updateData)
                    .eq('id', item.juguete_id);

                if (updateError) throw updateError;
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
}

// Función para actualizar lista de items al por mayor
function updateVentaPorMayorItemsList() {
    const itemsList = document.getElementById('ventaPorMayorItemsList');
    if (!itemsList) return;
    
    if (ventaPorMayorItems.length === 0) {
        itemsList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay items agregados</p>';
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

        return `
        <div class="venta-item-card" style="display: flex; align-items: center; gap: 12px;">
            ${imagenHTML}
            <div class="item-info" style="flex: 1;">
                <strong>${item.juguete_nombre}</strong> (${item.juguete_codigo})${itemCode}<br>
                <small>Precio al por Mayor: $${item.precio.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} | Cantidad: ${cantidad} | Empleado: ${item.empleado_nombre} | Método: ${item.metodo_pago}</small>
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
}

// Función global para remover item al por mayor
window.removeVentaPorMayorItem = function(index) {
    ventaPorMayorItems.splice(index, 1);
    updateVentaPorMayorItemsList();
};

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

