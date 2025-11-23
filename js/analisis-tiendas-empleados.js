// Variables para gráficos adicionales
let ventasPorDiaTiendaChart = null;
let ventasPorHoraTiendaChart = null;
let ventasPorEmpleadoChart = null;

// Función para obtener ventas del mes con información de tiendas y empleados
async function obtenerVentasDelMesCompleto() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const ahora = new Date();
        const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
        
        const { data: ventas, error } = await window.supabaseClient
            .from('ventas')
            .select(`
                created_at, 
                precio_venta, 
                cantidad,
                juguetes!inner(tiendas(id, nombre), bodegas(id, nombre)),
                empleados(id, nombre, codigo)
            `)
            .eq('empresa_id', user.empresa_id)
            .gte('created_at', primerDiaMes.toISOString())
            .lte('created_at', ultimoDiaMes.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;
        
        return ventas || [];
    } catch (error) {
        console.error('Error al obtener ventas completas del mes:', error);
        return [];
    }
}

// Función para cargar gráficos por tienda
async function cargarGraficosPorTienda() {
    const ventas = await obtenerVentasDelMesCompleto();
    
    if (ventas.length === 0) {
        const diaInfo = document.getElementById('ventasPorDiaTiendaInfo');
        if (diaInfo) diaInfo.innerHTML = '<p style="color: #64748b;">No hay ventas en el mes actual</p>';
        return;
    }
    
    // Procesar ventas por día por tienda
    const ventasPorDiaTienda = procesarVentasPorDiaTienda(ventas);
    crearGraficoVentasPorDiaTienda(ventasPorDiaTienda);
    
    // Procesar ventas por hora por tienda
    const ventasPorHoraTienda = procesarVentasPorHoraTienda(ventas);
    crearGraficoVentasPorHoraTienda(ventasPorHoraTienda);
    
    // Actualizar información
    actualizarInfoVentasPorTienda(ventasPorDiaTienda);
}

// Función para procesar ventas por día por tienda
function procesarVentasPorDiaTienda(ventas) {
    const ventasPorTienda = {};
    const diasDelMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    
    ventas.forEach(venta => {
        const tienda = venta.juguetes?.tiendas;
        if (!tienda) return;
        
        const tiendaId = tienda.id;
        const tiendaNombre = tienda.nombre;
        
        if (!ventasPorTienda[tiendaId]) {
            ventasPorTienda[tiendaId] = {
                nombre: tiendaNombre,
                dias: {}
            };
            // Inicializar todos los días
            for (let i = 1; i <= diasDelMes; i++) {
                ventasPorTienda[tiendaId].dias[i] = { cantidad: 0, total: 0 };
            }
        }
        
        const fecha = new Date(venta.created_at);
        const dia = fecha.getDate();
        const cantidad = parseFloat(venta.cantidad || 1);
        const precio = parseFloat(venta.precio_venta || 0);
        
        if (ventasPorTienda[tiendaId].dias[dia]) {
            ventasPorTienda[tiendaId].dias[dia].cantidad += cantidad;
            ventasPorTienda[tiendaId].dias[dia].total += precio;
        }
    });
    
    return ventasPorTienda;
}

// Función para procesar ventas por hora por tienda
function procesarVentasPorHoraTienda(ventas) {
    const ventasPorTienda = {};
    
    ventas.forEach(venta => {
        const tienda = venta.juguetes?.tiendas;
        if (!tienda) return;
        
        const tiendaId = tienda.id;
        const tiendaNombre = tienda.nombre;
        
        if (!ventasPorTienda[tiendaId]) {
            ventasPorTienda[tiendaId] = {
                nombre: tiendaNombre,
                horas: {}
            };
            // Inicializar todas las horas
            for (let i = 0; i < 24; i++) {
                ventasPorTienda[tiendaId].horas[i] = { cantidad: 0, total: 0 };
            }
        }
        
        const fecha = new Date(venta.created_at);
        const hora = fecha.getHours();
        const cantidad = parseFloat(venta.cantidad || 1);
        const precio = parseFloat(venta.precio_venta || 0);
        
        if (ventasPorTienda[tiendaId].horas[hora] !== undefined) {
            ventasPorTienda[tiendaId].horas[hora].cantidad += cantidad;
            ventasPorTienda[tiendaId].horas[hora].total += precio;
        }
    });
    
    return ventasPorTienda;
}

// Función para crear gráfico de ventas por día por tienda
function crearGraficoVentasPorDiaTienda(ventasPorTienda) {
    const ctx = document.getElementById('ventasPorDiaTiendaChart');
    if (!ctx) return;
    
    if (ventasPorDiaTiendaChart) {
        ventasPorDiaTiendaChart.destroy();
    }
    
    const tiendas = Object.keys(ventasPorTienda);
    if (tiendas.length === 0) return;
    
    const diasDelMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dias = Array.from({ length: diasDelMes }, (_, i) => i + 1);
    
    const datasets = tiendas.map((tiendaId, index) => {
        const tienda = ventasPorTienda[tiendaId];
        const colores = [
            'rgba(59, 130, 246, 0.6)',
            'rgba(16, 185, 129, 0.6)',
            'rgba(245, 158, 11, 0.6)',
            'rgba(139, 92, 246, 0.6)',
            'rgba(236, 72, 153, 0.6)'
        ];
        const coloresBorde = [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(236, 72, 153, 1)'
        ];
        
        return {
            label: tienda.nombre,
            data: dias.map(d => tienda.dias[d].cantidad),
            backgroundColor: colores[index % colores.length],
            borderColor: coloresBorde[index % coloresBorde.length],
            borderWidth: 2
        };
    });
    
    ventasPorDiaTiendaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dias.map(d => `Día ${d}`),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Ventas Diarias por Tienda',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
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

// Función para crear gráfico de ventas por hora por tienda
function crearGraficoVentasPorHoraTienda(ventasPorTienda) {
    const ctx = document.getElementById('ventasPorHoraTiendaChart');
    if (!ctx) return;
    
    if (ventasPorHoraTiendaChart) {
        ventasPorHoraTiendaChart.destroy();
    }
    
    const tiendas = Object.keys(ventasPorTienda);
    if (tiendas.length === 0) return;
    
    const horas = Array.from({ length: 24 }, (_, i) => i);
    
    const datasets = tiendas.map((tiendaId, index) => {
        const tienda = ventasPorTienda[tiendaId];
        const colores = [
            'rgba(59, 130, 246, 0.6)',
            'rgba(16, 185, 129, 0.6)',
            'rgba(245, 158, 11, 0.6)',
            'rgba(139, 92, 246, 0.6)',
            'rgba(236, 72, 153, 0.6)'
        ];
        const coloresBorde = [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(236, 72, 153, 1)'
        ];
        
        return {
            label: tienda.nombre,
            data: horas.map(h => tienda.horas[h].cantidad),
            backgroundColor: colores[index % colores.length],
            borderColor: coloresBorde[index % coloresBorde.length],
            borderWidth: 2
        };
    });
    
    ventasPorHoraTiendaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: horas.map(h => `${h}:00`),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Ventas por Hora por Tienda',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
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

// Función para actualizar información de tiendas
function actualizarInfoVentasPorTienda(ventasPorTienda) {
    let tiendaMax = null;
    let cantidadMax = -1;
    let totalMax = 0;
    
    Object.keys(ventasPorTienda).forEach(tiendaId => {
        const tienda = ventasPorTienda[tiendaId];
        let totalCantidad = 0;
        let totalDinero = 0;
        
        Object.keys(tienda.dias).forEach(dia => {
            totalCantidad += tienda.dias[dia].cantidad;
            totalDinero += tienda.dias[dia].total;
        });
        
        if (totalCantidad > cantidadMax) {
            cantidadMax = totalCantidad;
            totalMax = totalDinero;
            tiendaMax = tienda.nombre;
        }
    });
    
    const infoDiv = document.getElementById('ventasPorDiaTiendaInfo');
    if (infoDiv) {
        if (tiendaMax) {
            infoDiv.innerHTML = `
                <p><strong>Tienda con más ventas:</strong> <span style="color: #10b981;">${tiendaMax}</span> (${cantidadMax} juguetes - $${totalMax.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</p>
            `;
        } else {
            infoDiv.innerHTML = '<p style="color: #64748b;">No hay datos disponibles</p>';
        }
    }
}

// Función para cargar gráfico de ventas por empleado
async function cargarGraficoVentasPorEmpleado() {
    const ventas = await obtenerVentasDelMesCompleto();
    
    if (ventas.length === 0) {
        const infoDiv = document.getElementById('ventasPorEmpleadoInfo');
        if (infoDiv) infoDiv.innerHTML = '<p style="color: #64748b;">No hay ventas en el mes actual</p>';
        return;
    }
    
    const ventasPorEmpleado = procesarVentasPorEmpleado(ventas);
    crearGraficoVentasPorEmpleado(ventasPorEmpleado);
    actualizarInfoVentasPorEmpleado(ventasPorEmpleado);
}

// Función para procesar ventas por empleado
function procesarVentasPorEmpleado(ventas) {
    const ventasPorEmpleado = {};
    
    ventas.forEach(venta => {
        const empleado = venta.empleados;
        if (!empleado) return;
        
        const empleadoId = empleado.id;
        const empleadoNombre = empleado.nombre || empleado.codigo || 'Sin nombre';
        
        if (!ventasPorEmpleado[empleadoId]) {
            ventasPorEmpleado[empleadoId] = {
                nombre: empleadoNombre,
                cantidad: 0,
                total: 0
            };
        }
        
        const cantidad = parseFloat(venta.cantidad || 1);
        const precio = parseFloat(venta.precio_venta || 0);
        
        ventasPorEmpleado[empleadoId].cantidad += cantidad;
        ventasPorEmpleado[empleadoId].total += precio;
    });
    
    return ventasPorEmpleado;
}

// Función para crear gráfico de ventas por empleado
function crearGraficoVentasPorEmpleado(ventasPorEmpleado) {
    const ctx = document.getElementById('ventasPorEmpleadoChart');
    if (!ctx) return;
    
    if (ventasPorEmpleadoChart) {
        ventasPorEmpleadoChart.destroy();
    }
    
    const empleados = Object.keys(ventasPorEmpleado);
    if (empleados.length === 0) return;
    
    const nombres = empleados.map(id => ventasPorEmpleado[id].nombre);
    const cantidades = empleados.map(id => ventasPorEmpleado[id].cantidad);
    const totales = empleados.map(id => ventasPorEmpleado[id].total);
    
    ventasPorEmpleadoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombres,
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
                    text: 'Ventas por Empleado (Mes Actual)',
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
                        text: 'Empleados'
                    }
                }
            }
        }
    });
}

// Función para actualizar información de empleados
function actualizarInfoVentasPorEmpleado(ventasPorEmpleado) {
    let empleadoMax = null;
    let cantidadMax = -1;
    let totalMax = 0;
    
    Object.keys(ventasPorEmpleado).forEach(empleadoId => {
        const empleado = ventasPorEmpleado[empleadoId];
        if (empleado.cantidad > cantidadMax) {
            cantidadMax = empleado.cantidad;
            totalMax = empleado.total;
            empleadoMax = empleado.nombre;
        }
    });
    
    const infoDiv = document.getElementById('ventasPorEmpleadoInfo');
    if (infoDiv) {
        if (empleadoMax) {
            infoDiv.innerHTML = `
                <p><strong>Empleado con más ventas:</strong> <span style="color: #10b981;">${empleadoMax}</span> (${cantidadMax} juguetes - $${totalMax.toLocaleString('es-CO', { minimumFractionDigits: 2 })})</p>
            `;
        } else {
            infoDiv.innerHTML = '<p style="color: #64748b;">No hay datos disponibles</p>';
        }
    }
}

