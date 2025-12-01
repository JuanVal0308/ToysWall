// ============================================
// INVENTARIO DETALLE
// ============================================

let inventarioDetalleData = [];
let inventarioDetalleFiltrado = [];
let paginaActualDetalle = 1;
const itemsPorPaginaDetalle = 20;
// Cantidad estándar por bulto (configurable, comúnmente 12 o 24)
const CANTIDAD_POR_BULTO_DEFAULT = 12;

// Función para cargar el inventario detalle
async function loadInventarioDetalle() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (!user || !user.empresa_id) {
            console.error('Usuario no autenticado');
            return;
        }

        // Obtener todos los juguetes con sus ubicaciones
        const { data: juguetes, error: juguetesError } = await window.supabaseClient
            .from('juguetes')
            .select(`
                id,
                nombre,
                codigo,
                item,
                cantidad,
                foto_url,
                precio_min,
                precio_por_mayor,
                numero_bultos,
                cantidad_por_bulto,
                bodega_id,
                tienda_id,
                bodegas(nombre),
                tiendas(nombre)
            `)
            .eq('empresa_id', user.empresa_id);

        if (juguetesError) throw juguetesError;

        // Obtener ventas por juguete
        const { data: ventas, error: ventasError } = await window.supabaseClient
            .from('ventas')
            .select('juguete_id, cantidad')
            .eq('empresa_id', user.empresa_id);

        if (ventasError) throw ventasError;

        // Agrupar juguetes por código (pueden tener múltiples ubicaciones)
        const juguetesAgrupados = {};
        
        juguetes.forEach(juguete => {
            const codigo = juguete.codigo;
            if (!juguetesAgrupados[codigo]) {
                juguetesAgrupados[codigo] = {
                    id: juguete.id,
                    nombre: juguete.nombre,
                    codigo: juguete.codigo,
                    item: juguete.item,
                    foto_url: juguete.foto_url,
                    precio_min: juguete.precio_min,
                    precio_por_mayor: juguete.precio_por_mayor,
                    cantidad_total: 0,
                    cantidad_vendida: 0,
                    ubicaciones: []
                };
            }
            
            // Sumar cantidad
            const cantidadJuguete = juguete.cantidad || 0;
            juguetesAgrupados[codigo].cantidad_total += cantidadJuguete;
            
            // Calcular bultos para esta ubicación
            // Usar cantidad_por_bulto del juguete si existe, sino usar el valor por defecto
            const cantidadPorBultoJuguete = juguete.cantidad_por_bulto || CANTIDAD_POR_BULTO_DEFAULT;
            const bultosUbicacion = Math.floor(cantidadJuguete / cantidadPorBultoJuguete);
            const unidadesSuelta = cantidadJuguete % cantidadPorBultoJuguete;
            
            // Agregar ubicación con información de bultos
            if (juguete.bodega_id && juguete.bodegas) {
                juguetesAgrupados[codigo].ubicaciones.push({
                    tipo: 'Bodega',
                    nombre: juguete.bodegas.nombre,
                    cantidad: cantidadJuguete,
                    bultos: bultosUbicacion,
                    unidades_sueltas: unidadesSuelta
                });
            } else if (juguete.tienda_id && juguete.tiendas) {
                juguetesAgrupados[codigo].ubicaciones.push({
                    tipo: 'Tienda',
                    nombre: juguete.tiendas.nombre,
                    cantidad: cantidadJuguete,
                    bultos: bultosUbicacion,
                    unidades_sueltas: unidadesSuelta
                });
            }
        });

        // Calcular cantidad vendida por juguete
        if (ventas) {
            ventas.forEach(venta => {
                // Buscar el juguete por ID
                const jugueteEncontrado = juguetes.find(j => j.id === venta.juguete_id);
                if (jugueteEncontrado && juguetesAgrupados[jugueteEncontrado.codigo]) {
                    juguetesAgrupados[jugueteEncontrado.codigo].cantidad_vendida += venta.cantidad || 0;
                }
            });
        }

        // Convertir objeto a array
        inventarioDetalleData = Object.values(juguetesAgrupados);
        
        // Calcular cantidad disponible y bultos
        inventarioDetalleData.forEach(juguete => {
            juguete.cantidad_disponible = juguete.cantidad_total - juguete.cantidad_vendida;
            
            // Usar cantidad_por_bulto del primer juguete del grupo si existe, sino usar el valor por defecto
            // Buscar en las ubicaciones para obtener el valor
            let cantidadPorBultoJuguete = CANTIDAD_POR_BULTO_DEFAULT;
            if (juguete.ubicaciones && juguete.ubicaciones.length > 0) {
                // Buscar en los juguetes originales para obtener cantidad_por_bulto
                const jugueteOriginal = juguetes.find(j => j.codigo === juguete.codigo);
                if (jugueteOriginal && jugueteOriginal.cantidad_por_bulto) {
                    cantidadPorBultoJuguete = jugueteOriginal.cantidad_por_bulto;
                }
            }
            
            // Calcular bultos totales disponibles
            juguete.bultos_disponibles = Math.floor(juguete.cantidad_disponible / cantidadPorBultoJuguete);
            juguete.unidades_sueltas_disponibles = juguete.cantidad_disponible % cantidadPorBultoJuguete;
            // Calcular bultos totales (sin vender)
            juguete.bultos_totales = Math.floor(juguete.cantidad_total / cantidadPorBultoJuguete);
        });

        // Inicializar búsqueda después de cargar los datos
        inicializarBusquedaInventarioDetalle();
        
        // Aplicar filtros si hay
        aplicarFiltrosDetalle();
        
        // Renderizar
        renderizarInventarioDetalle();
        actualizarTotalDetalle();
        
    } catch (error) {
        console.error('Error al cargar inventario detalle:', error);
        const tbody = document.getElementById('inventarioDetalleTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 40px; color: #ef4444;">
                        Error al cargar el inventario: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

// Función para aplicar filtros
function aplicarFiltrosDetalle() {
    const searchInput = document.getElementById('inventarioDetalleSearch');
    const codigoFilterInput = document.getElementById('inventarioDetalleCodigoFilter');
    
    const termino = searchInput ? searchInput.value.trim() : '';
    const codigoFilter = codigoFilterInput ? codigoFilterInput.value.trim() : '';
    
    let filtrados = [...inventarioDetalleData];
    
    // Aplicar filtro de búsqueda general
    if (termino) {
        const terminoLower = termino.toLowerCase();
        const terminoNormal = termino.replace(/\s+/g, '').toLowerCase();
        
        // Detectar si contiene letras (no es solo números)
        const tieneLetras = /[a-záéíóúñü]/i.test(termino);
        // Detectar si es un solo dígito
        const esUnSoloDigito = /^\d$/.test(terminoNormal);
        
        filtrados = filtrados.filter(juguete => {
            // Normalizar strings para búsqueda
            const nombre = String(juguete.nombre || '').toLowerCase();
            const codigo = String(juguete.codigo || '').toLowerCase().replace(/\s+/g, '');
            const item = String(juguete.item || '').toLowerCase().replace(/\s+/g, '');
            
            // Buscar en ubicaciones (nombre de bodega/tienda)
            let ubicacionesTexto = '';
            if (juguete.ubicaciones && juguete.ubicaciones.length > 0) {
                ubicacionesTexto = juguete.ubicaciones.map(u => {
                    const nombreUbicacion = (u.nombre || '').toLowerCase();
                    const tipoUbicacion = (u.tipo || '').toLowerCase();
                    return `${nombreUbicacion} ${tipoUbicacion}`;
                }).join(' ');
            }
            
            if (tieneLetras) {
                // Si tiene letras, buscar en nombre, ubicaciones e ITEM (puede tener letras y números)
                return nombre.includes(terminoLower) || 
                       ubicacionesTexto.includes(terminoLower) ||
                       item.includes(terminoLower) ||
                       item.includes(terminoNormal);
            } else {
                // Si es solo números
                if (esUnSoloDigito) {
                    // Para un solo dígito, buscar que el código o ITEM:
                    // 1. Comience con ese dígito (ej: "4" encuentra "4", "41", "42", etc.)
                    // 2. Sea exactamente ese dígito
                    // 3. Tenga ese dígito al inicio después de letras/separadores (ej: "A4", "ITM-4")
                    const codigoComienzaConDigito = codigo.startsWith(terminoNormal) || 
                                                     codigo === terminoNormal ||
                                                     (/^[a-z]*[^a-z0-9]*/.test(codigo) && codigo.replace(/^[a-z]*[^a-z0-9]*/, '').startsWith(terminoNormal));
                    const itemComienzaConDigito = item.startsWith(terminoNormal) || 
                                                   item === terminoNormal ||
                                                   (/^[a-z]*[^a-z0-9]*/.test(item) && item.replace(/^[a-z]*[^a-z0-9]*/, '').startsWith(terminoNormal));
                    return codigoComienzaConDigito || itemComienzaConDigito;
                } else {
                    // Si es más de un dígito, buscar en cualquier parte del código e ITEM
                    return codigo.includes(terminoNormal) || 
                           item.includes(terminoNormal);
                }
            }
        });
    }
    
    // Aplicar filtro específico por código
    if (codigoFilter) {
        const codigoFilterNormal = codigoFilter.toLowerCase().replace(/\s+/g, '');
        filtrados = filtrados.filter(juguete => {
            const codigo = String(juguete.codigo || '').toLowerCase().replace(/\s+/g, '');
            return codigo.includes(codigoFilterNormal);
        });
    }
    
    inventarioDetalleFiltrado = filtrados;
    paginaActualDetalle = 1;
}

// Función para renderizar la tabla
function renderizarInventarioDetalle() {
    const tbody = document.getElementById('inventarioDetalleTableBody');
    if (!tbody) return;

    if (inventarioDetalleFiltrado.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 40px; color: #64748b;">
                    No se encontraron juguetes
                </td>
            </tr>
        `;
        document.getElementById('inventarioDetallePagination').innerHTML = '';
        return;
    }

    // Calcular índices para paginación
    const inicio = (paginaActualDetalle - 1) * itemsPorPaginaDetalle;
    const fin = inicio + itemsPorPaginaDetalle;
    const itemsPagina = inventarioDetalleFiltrado.slice(inicio, fin);

    tbody.innerHTML = itemsPagina.map(juguete => {
        // Generar HTML de imagen con funcionalidad de clic para ver grande
        let imagenHTML = '';
        const fotoUrlLimpia = juguete.foto_url ? juguete.foto_url.trim() : '';
        if (fotoUrlLimpia && fotoUrlLimpia !== '') {
            try {
                new URL(fotoUrlLimpia);
                imagenHTML = `<img src="${fotoUrlLimpia}" alt="${juguete.nombre}" 
                    style="width: 50px; height: 50px; border-radius: 6px; border: 2px solid #e2e8f0; object-fit: cover; background: #f1f5f9; cursor: pointer; transition: transform 0.2s;"
                    onclick="mostrarImagenGrande('${fotoUrlLimpia.replace(/'/g, "\\'")}', '${juguete.nombre.replace(/'/g, "\\'")}')"
                    onmouseover="this.style.transform='scale(1.1)'"
                    onmouseout="this.style.transform='scale(1)'"
                    onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width: 50px; height: 50px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;\\'><i class=\\'fas fa-image\\' style=\\'color: #cbd5e1; font-size: 16px;\\'></i></div>';"
                    onload="this.style.background='transparent';"
                    title="Haz clic para ver imagen grande">`;
            } catch (e) {
                imagenHTML = `<div style="width: 50px; height: 50px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-image" style="color: #cbd5e1; font-size: 16px;"></i>
                </div>`;
            }
        } else {
            imagenHTML = `<div style="width: 50px; height: 50px; background: #f1f5f9; border-radius: 6px; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-image" style="color: #cbd5e1; font-size: 16px;"></i>
            </div>`;
        }

        // Generar HTML de ubicaciones con información de bultos
        const ubicacionesHTML = juguete.ubicaciones.length > 0
            ? juguete.ubicaciones.map(u => {
                const bultosInfo = u.bultos > 0 
                    ? `<span style="color: #3b82f6; font-weight: bold;">${u.bultos} bulto${u.bultos !== 1 ? 's' : ''}</span>`
                    : '';
                const unidadesInfo = u.unidades_sueltas > 0
                    ? `<span style="color: #64748b;">${u.unidades_sueltas} unidad${u.unidades_sueltas !== 1 ? 'es' : ''}</span>`
                    : '';
                const cantidadInfo = u.cantidad > 0
                    ? `<span style="color: #10b981; font-weight: 600;">${u.cantidad.toLocaleString('es-CO')} total</span>`
                    : '';
                
                const infoParts = [bultosInfo, unidadesInfo, cantidadInfo].filter(p => p).join(' • ');
                
                return `
                    <div style="margin: 4px 0; padding: 8px 12px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 6px; border-left: 3px solid ${u.tipo === 'Bodega' ? '#667eea' : '#10b981'}; font-size: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <i class="fas ${u.tipo === 'Bodega' ? 'fa-warehouse' : 'fa-store'}" style="color: ${u.tipo === 'Bodega' ? '#667eea' : '#10b981'};"></i>
                            <strong style="color: #1e293b;">${u.tipo}: ${u.nombre}</strong>
                        </div>
                        <div style="margin-left: 24px; color: #64748b; font-size: 11px;">
                            ${infoParts || 'Sin stock'}
                        </div>
                    </div>
                `;
            }).join('')
            : '<span style="color: #94a3b8; font-style: italic;">Sin ubicación asignada</span>';

        // Colores para cantidad disponible
        const colorDisponible = juguete.cantidad_disponible > 0 
            ? (juguete.cantidad_disponible < 10 ? '#f59e0b' : '#10b981')
            : '#ef4444';

        // Información de bultos disponibles
        const bultosHTML = juguete.bultos_disponibles > 0
            ? `<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                <span style="font-size: 16px; font-weight: bold; color: #3b82f6;">${juguete.bultos_disponibles}</span>
                <span style="font-size: 10px; color: #64748b;">bulto${juguete.bultos_disponibles !== 1 ? 's' : ''}</span>
                ${juguete.unidades_sueltas_disponibles > 0 
                    ? `<span style="font-size: 9px; color: #94a3b8;">+${juguete.unidades_sueltas_disponibles} sueltas</span>`
                    : ''
                }
            </div>`
            : '<span style="color: #ef4444; font-weight: 600;">0 bultos</span>';

        return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${juguete.cantidad_disponible > 0 ? 'white' : '#fef2f2'};">
                <td style="padding: 12px; border: 1px solid #e2e8f0;">${imagenHTML}</td>
                <td style="padding: 12px; border: 1px solid #e2e8f0;">
                    <strong style="color: #1e293b;">${juguete.nombre}</strong>
                </td>
                <td style="padding: 12px; border: 1px solid #e2e8f0;">
                    <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #3b82f6;">${juguete.codigo}</code>
                </td>
                <td style="padding: 12px; border: 1px solid #e2e8f0;">
                    ${juguete.item ? `<code style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #92400e;">${juguete.item}</code>` : '<span style="color: #94a3b8;">-</span>'}
                </td>
                <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span>${juguete.cantidad_total.toLocaleString('es-CO')}</span>
                        <span style="font-size: 10px; color: #64748b;">(${juguete.bultos_totales} bultos)</span>
                    </div>
                </td>
                <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; color: #64748b;">
                    ${juguete.cantidad_vendida.toLocaleString('es-CO')}
                </td>
                <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold; color: ${colorDisponible};">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span>${juguete.cantidad_disponible.toLocaleString('es-CO')}</span>
                    </div>
                </td>
                <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; background: #f8fafc;">
                    ${bultosHTML}
                </td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; max-width: 350px; min-width: 300px;">
                    ${ubicacionesHTML}
                </td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">
                    ${juguete.precio_min ? `<span style="font-weight: 600; color: #1e293b;">$${juguete.precio_min.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>` : '<span style="color: #94a3b8;">-</span>'}
                </td>
                <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; background: #fef3c7;">
                    ${juguete.precio_por_mayor ? `<span style="font-weight: bold; color: #92400e; font-size: 14px;">$${juguete.precio_por_mayor.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>` : '<span style="color: #94a3b8;">-</span>'}
                </td>
            </tr>
        `;
    }).join('');

    // Renderizar paginación
    renderizarPaginacionDetalle();
}

// Función para renderizar paginación
function renderizarPaginacionDetalle() {
    const paginacionDiv = document.getElementById('inventarioDetallePagination');
    if (!paginacionDiv) return;

    const totalPaginas = Math.ceil(inventarioDetalleFiltrado.length / itemsPorPaginaDetalle);
    
    if (totalPaginas <= 1) {
        paginacionDiv.innerHTML = '';
        return;
    }

    let html = '';
    
    // Botón anterior
    html += `<button 
        onclick="cambiarPaginaDetalle(${paginaActualDetalle - 1})" 
        ${paginaActualDetalle === 1 ? 'disabled' : ''}
        style="padding: 8px 16px; border: 1px solid #e2e8f0; background: ${paginaActualDetalle === 1 ? '#f1f5f9' : 'white'}; border-radius: 6px; cursor: ${paginaActualDetalle === 1 ? 'not-allowed' : 'pointer'}; color: ${paginaActualDetalle === 1 ? '#94a3b8' : '#1e293b'};">
        <i class="fas fa-chevron-left"></i> Anterior
    </button>`;

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaActualDetalle - 2 && i <= paginaActualDetalle + 2)) {
            html += `<button 
                onclick="cambiarPaginaDetalle(${i})" 
                style="padding: 8px 16px; border: 1px solid #e2e8f0; background: ${i === paginaActualDetalle ? '#667eea' : 'white'}; color: ${i === paginaActualDetalle ? 'white' : '#1e293b'}; border-radius: 6px; cursor: pointer; font-weight: ${i === paginaActualDetalle ? 'bold' : 'normal'};">
                ${i}
            </button>`;
        } else if (i === paginaActualDetalle - 3 || i === paginaActualDetalle + 3) {
            html += `<span style="padding: 8px 4px; color: #64748b;">...</span>`;
        }
    }

    // Botón siguiente
    html += `<button 
        onclick="cambiarPaginaDetalle(${paginaActualDetalle + 1})" 
        ${paginaActualDetalle === totalPaginas ? 'disabled' : ''}
        style="padding: 8px 16px; border: 1px solid #e2e8f0; background: ${paginaActualDetalle === totalPaginas ? '#f1f5f9' : 'white'}; border-radius: 6px; cursor: ${paginaActualDetalle === totalPaginas ? 'not-allowed' : 'pointer'}; color: ${paginaActualDetalle === totalPaginas ? '#94a3b8' : '#1e293b'};">
        Siguiente <i class="fas fa-chevron-right"></i>
    </button>`;

    paginacionDiv.innerHTML = html;
}

// Función global para cambiar página
window.cambiarPaginaDetalle = function(pagina) {
    const totalPaginas = Math.ceil(inventarioDetalleFiltrado.length / itemsPorPaginaDetalle);
    if (pagina < 1 || pagina > totalPaginas) return;
    paginaActualDetalle = pagina;
    renderizarInventarioDetalle();
};

// Función para actualizar total
function actualizarTotalDetalle() {
    const totalElement = document.getElementById('totalJuguetesDetalle');
    if (totalElement) {
        totalElement.textContent = inventarioDetalleFiltrado.length;
    }
}

// Función para mostrar imagen grande en modal
window.mostrarImagenGrande = function(url, nombre) {
    // Crear modal si no existe
    let modal = document.getElementById('imagenGrandeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imagenGrandeModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; cursor: pointer;';
        modal.onclick = function() {
            modal.style.display = 'none';
        };
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%; text-align: center;">
            <button onclick="document.getElementById('imagenGrandeModal').style.display='none'" 
                style="position: absolute; top: -40px; right: 0; background: white; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; font-size: 24px; color: #333; display: flex; align-items: center; justify-content: center; z-index: 10001;">
                <i class="fas fa-times"></i>
            </button>
            <img src="${url}" alt="${nombre}" style="max-width: 100%; max-height: 90vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
            <p style="color: white; margin-top: 15px; font-size: 18px;">${nombre}</p>
        </div>
    `;
    modal.style.display = 'flex';
};

// Event listener para búsqueda - se inicializa cuando se carga la vista
window.inicializarBusquedaInventarioDetalle = function() {
    const searchInput = document.getElementById('inventarioDetalleSearch');
    const codigoFilterInput = document.getElementById('inventarioDetalleCodigoFilter');
    
    if (!searchInput || !codigoFilterInput) {
        return; // Los elementos aún no existen
    }
    
    // Evitar agregar listeners múltiples veces
    if (searchInput.dataset.listenerAdded) {
        return;
    }
    
    function aplicarFiltrosYRenderizar() {
        aplicarFiltrosDetalle();
        renderizarInventarioDetalle();
        actualizarTotalDetalle();
    }
    
    searchInput.addEventListener('input', aplicarFiltrosYRenderizar);
    codigoFilterInput.addEventListener('input', aplicarFiltrosYRenderizar);
    
    // Marcar que ya se agregaron los listeners
    searchInput.dataset.listenerAdded = 'true';
    codigoFilterInput.dataset.listenerAdded = 'true';
};

// También inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    // Intentar inicializar inmediatamente
    inicializarBusquedaInventarioDetalle();
    
    // También intentar después de un pequeño delay por si los elementos se crean después
    setTimeout(inicializarBusquedaInventarioDetalle, 500);
});


