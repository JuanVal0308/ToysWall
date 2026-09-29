/**
 * Gestión de Inventario por Ubicación - UI
 * Maneja la interfaz de usuario para filtrar y editar inventario por ubicación
 */

(function() {
    'use strict';

    let ubicacionSeleccionada = null;
    let ubicacionesDisponibles = [];

    /**
     * Cargar ubicaciones en el selector
     */
    async function cargarUbicacionesEnSelector() {
        const selector = document.getElementById('inventarioDetalleUbicacionFilter');
        if (!selector) return;

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            if (!user || !user.empresa_id) return;

            // Obtener ubicaciones desde la arquitectura Clean si está disponible
            let ubicaciones = [];
            if (window.controladorInventario) {
                ubicaciones = await window.controladorInventario.cargarUbicaciones(user.empresa_id);
            } else {
                // Fallback: cargar directamente desde Supabase
                const { data, error } = await window.supabaseClient
                    .from('ubicaciones')
                    .select('*')
                    .eq('empresa_id', user.empresa_id)
                    .eq('activo', true)
                    .order('tipo', { ascending: true })
                    .order('nombre', { ascending: true });

                if (error) {
                    console.error('Error al cargar ubicaciones:', error);
                    return;
                }
                ubicaciones = data || [];
            }

            ubicacionesDisponibles = ubicaciones;

            // Limpiar y repoblar el selector
            selector.innerHTML = `
                <option value="">📦 Todas las ubicaciones</option>
                <option value="general">🏢 Inventario General</option>
            `;

            // Agrupar por tipo
            const tiendas = ubicaciones.filter(u => u.tipo === 'tienda');
            const bodegas = ubicaciones.filter(u => u.tipo === 'bodega');

            if (tiendas.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = '🏪 Tiendas';
                tiendas.forEach(tienda => {
                    const option = document.createElement('option');
                    option.value = `ubicacion-${tienda.id}`;
                    option.textContent = tienda.nombre;
                    optgroup.appendChild(option);
                });
                selector.appendChild(optgroup);
            }

            if (bodegas.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = '🏭 Bodegas';
                bodegas.forEach(bodega => {
                    const option = document.createElement('option');
                    option.value = `ubicacion-${bodega.id}`;
                    option.textContent = bodega.nombre;
                    optgroup.appendChild(option);
                });
                selector.appendChild(optgroup);
            }

        } catch (error) {
            console.error('Error al cargar ubicaciones en selector:', error);
        }
    }

    /**
     * Manejar cambio de ubicación seleccionada
     */
    function configurarEventosUbicacion() {
        const selector = document.getElementById('inventarioDetalleUbicacionFilter');
        if (!selector) return;

        selector.addEventListener('change', function() {
            ubicacionSeleccionada = this.value;
            
            // Recargar inventario con el filtro de ubicación
            if (typeof window.loadInventarioDetalle === 'function') {
                window.loadInventarioDetalle();
            } else if (typeof loadInventarioDetalle === 'function') {
                loadInventarioDetalle();
            }
        });
    }

    /**
     * Obtener la ubicación actualmente seleccionada
     */
    function obtenerUbicacionSeleccionada() {
        return ubicacionSeleccionada;
    }

    /**
     * Filtrar inventario por ubicación seleccionada
     * Esta función modifica los datos del inventario antes de renderizar
     */
    function filtrarInventarioPorUbicacion(inventarioData) {
        if (!ubicacionSeleccionada || ubicacionSeleccionada === '' || ubicacionSeleccionada === 'general') {
            // Sin filtro o "general" = mostrar todo consolidado
            return inventarioData;
        }

        // Extraer el ID de la ubicación del formato "ubicacion-123"
        const ubicacionId = parseInt(ubicacionSeleccionada.replace('ubicacion-', ''));
        if (isNaN(ubicacionId)) return inventarioData;

        // Filtrar productos que tienen stock en esta ubicación
        return inventarioData.filter(juguete => {
            if (!juguete.ubicaciones || juguete.ubicaciones.length === 0) {
                return false;
            }

            // Buscar la ubicación específica en las ubicaciones del juguete
            const ubicacion = ubicacionesDisponibles.find(u => u.id === ubicacionId);
            if (!ubicacion) return false;

            // Verificar si el juguete tiene stock en esta ubicación
            return juguete.ubicaciones.some(u => {
                const coincideNombre = u.nombre === ubicacion.nombre;
                const coincideTipo = u.tipo === (ubicacion.tipo === 'tienda' ? 'Tienda' : 'Bodega');
                return coincideNombre && coincideTipo && u.cantidad > 0;
            });
        }).map(juguete => {
            // Modificar las ubicaciones para mostrar solo la seleccionada
            const ubicacion = ubicacionesDisponibles.find(u => u.id === ubicacionId);
            const ubicacionFiltrada = juguete.ubicaciones.find(u => {
                const coincideNombre = u.nombre === ubicacion.nombre;
                const coincideTipo = u.tipo === (ubicacion.tipo === 'tienda' ? 'Tienda' : 'Bodega');
                return coincideNombre && coincideTipo;
            });

            if (ubicacionFiltrada) {
                return {
                    ...juguete,
                    ubicaciones: [ubicacionFiltrada],
                    cantidad_total: ubicacionFiltrada.cantidad,
                    cantidad_disponible: ubicacionFiltrada.cantidad
                };
            }
            return juguete;
        });
    }

    /**
     * Inicializar la funcionalidad de inventario por ubicación
     */
    function inicializarInventarioPorUbicacion() {
        // Cargar ubicaciones al iniciar
        cargarUbicacionesEnSelector();

        // Configurar eventos
        configurarEventosUbicacion();

        console.log('✅ Inventario por ubicación inicializado');
    }

    // Exportar funciones globalmente
    window.inventarioPorUbicacion = {
        inicializar: inicializarInventarioPorUbicacion,
        cargarUbicaciones: cargarUbicacionesEnSelector,
        obtenerUbicacionSeleccionada: obtenerUbicacionSeleccionada,
        filtrarPorUbicacion: filtrarInventarioPorUbicacion
    };

    // Auto-inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarInventarioPorUbicacion);
    } else {
        inicializarInventarioPorUbicacion();
    }

})();
