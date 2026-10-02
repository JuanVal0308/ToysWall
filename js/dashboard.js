// Dashboard functionality

document.addEventListener('DOMContentLoaded', async function() {
    // Con Supabase Auth la sesión real es la de Supabase: se valida y se reconstruye el usuario desde la BD
    const usarSupabaseAuth = window.APP_CONFIG?.USAR_SUPABASE_AUTH === true;
    const autenticadorAuth = usarSupabaseAuth && window.AutenticacionSupabaseAuth
        ? new window.AutenticacionSupabaseAuth(window.supabaseClient)
        : null;

    if (usarSupabaseAuth) {
        const habiaUsuarioEnPestana = !!sessionStorage.getItem('user');
        const usuarioSesion = autenticadorAuth ? await autenticadorAuth.obtenerUsuarioDeSesion() : null;
        if (!usuarioSesion) {
            if (autenticadorAuth) await autenticadorAuth.cerrarSesion();
            sessionStorage.removeItem('user');
            window.location.href = 'index.html';
            return;
        }
        sessionStorage.setItem('user', JSON.stringify(usuarioSesion.toSession()));
        if (!habiaUsuarioEnPestana) {
            // Pestaña nueva con sesión de Supabase vigente: los demás módulos ya se inicializaron sin usuario,
            // se recarga una vez para que todos arranquen con el usuario reconstruido.
            window.location.reload();
            return;
        }

        window.supabaseClient.auth.onAuthStateChange((evento) => {
            if (evento === 'SIGNED_OUT') {
                sessionStorage.removeItem('user');
                window.location.href = 'index.html';
            }
        });
    }

    // Verificar si hay usuario en sessionStorage
    const userData = sessionStorage.getItem('user');
    
    if (!userData) {
        // Si no hay usuario, redirigir al login
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userData);
    
    // Verificar permisos - empleados solo pueden ver ciertas páginas
    const isAdmin = user.tipo_usuario_id === 1 || user.tipo_usuario_id === 2;
    const isEmpleado = user.tipo_usuario_id === 3;
    
    if (!isAdmin && !isEmpleado) {
        alert('No tienes permisos para acceder a esta página');
        window.location.href = 'index.html';
        return;
    }

    // Avisar a los módulos que dependen del usuario (la sesión de Supabase Auth se valida de forma asíncrona)
    window.dispatchEvent(new CustomEvent('toyswall:sesion-lista', { detail: user }));
    
    // Ocultar botones del sidebar para empleados
    if (isEmpleado) {
        const sidebarButtons = document.querySelectorAll('.sidebar-btn');
        sidebarButtons.forEach(btn => {
            const page = btn.getAttribute('data-page');
            // Permitir: Dashboard (default), Registrar Venta (venta), Inventario (inventario), Ajustes (ajustes)
            // No permitir la sección de análisis para empleados
            if (page === 'analisis' || (page !== 'default' && page !== 'venta' && page !== 'facturar' && page !== 'inventario' && page !== 'ajustes')) {
                btn.style.display = 'none';
            }
        });

        // Ocultar tarjeta de "Ganancias Totales" en el dashboard para empleados
        const gananciasCardIcon = document.querySelector('.summary-card .card-icon i.fas.fa-dollar-sign');
        if (gananciasCardIcon) {
            const gananciasCard = gananciasCardIcon.closest('.summary-card');
            if (gananciasCard) {
                gananciasCard.style.display = 'none';
            }
        }
    }

    // Elementos del DOM
    const empresaNombreEl = document.getElementById('empresaNombre');
    const empresaLogoEl = document.getElementById('empresaLogo');
    const logoContainer = document.getElementById('logoContainer');
    const userNameEl = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileModal = document.getElementById('profileModal');
    const closeModal = document.getElementById('closeModal');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editProfileForm = document.getElementById('editProfileForm');
    const userNameClick = document.getElementById('userName');
    
    // Cargar información del usuario (el que ingresó)
    empresaNombreEl.textContent = 'ToysWalls - Sistema de Inventario';
    userNameEl.textContent = user.nombre || 'Usuario';

    // Cargar datos completos del usuario desde la base de datos
    let currentUserData = null;
    
    async function loadUserData() {
        try {
            // Con Supabase Auth la contraseña no se lee nunca (ni existe en la tabla)
            const columnas = usarSupabaseAuth ? 'id, nombre, email, empresa_id, tipo_usuario_id, activo' : '*';
            const { data, error } = await window.supabaseClient
                .from('usuarios')
                .select(columnas)
                .eq('id', user.id)
                .single();

            if (error) throw error;
            currentUserData = data;
            
            // Llenar el formulario con los datos actuales
            document.getElementById('editNombre').value = data.nombre || '';
            document.getElementById('editEmail').value = data.email || '';
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
        }
    }

    await loadUserData();

    // Logo de ToysWalls estático
    empresaLogoEl.src = 'https://i.imgur.com/RBbjVnp.jpeg';
    empresaLogoEl.alt = 'Logo ToysWalls';
                    logoContainer.style.display = 'flex';

    // Abrir modal al hacer click en el nombre de usuario
    userNameClick.addEventListener('click', function() {
        profileModal.style.display = 'flex';
        // Cargar datos actuales
        if (currentUserData) {
            document.getElementById('editNombre').value = currentUserData.nombre || '';
            document.getElementById('editEmail').value = currentUserData.email || '';
        }
        // Limpiar campos
        document.getElementById('currentPassword').value = '';
        document.getElementById('editPassword').value = '';
        hideProfileMessages();
    });

    // Cerrar modal
    function closeProfileModal() {
        profileModal.style.display = 'none';
        editProfileForm.reset();
        hideProfileMessages();
    }

    closeModal.addEventListener('click', closeProfileModal);
    cancelEditBtn.addEventListener('click', closeProfileModal);

    // Cerrar modal al hacer click fuera
    profileModal.addEventListener('click', function(e) {
        if (e.target === profileModal) {
            closeProfileModal();
        }
    });

    // Toggle para mostrar/ocultar contraseñas
    const toggleCurrentPassword = document.getElementById('toggleCurrentPassword');
    const currentPasswordInput = document.getElementById('currentPassword');
    const eyeCurrentIcon = document.getElementById('eyeCurrentIcon');
    
    toggleCurrentPassword.addEventListener('click', function() {
        const type = currentPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        currentPasswordInput.setAttribute('type', type);
        eyeCurrentIcon.classList.toggle('fa-eye');
        eyeCurrentIcon.classList.toggle('fa-eye-slash');
    });

    const toggleEditPassword = document.getElementById('toggleEditPassword');
    const editPasswordInput = document.getElementById('editPassword');
    const eyeEditIcon = document.getElementById('eyeEditIcon');
    
    toggleEditPassword.addEventListener('click', function() {
        const type = editPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        editPasswordInput.setAttribute('type', type);
        eyeEditIcon.classList.toggle('fa-eye');
        eyeEditIcon.classList.toggle('fa-eye-slash');
    });

    // Funciones para mostrar mensajes
    const profileErrorMessage = document.getElementById('profileErrorMessage');
    const profileSuccessMessage = document.getElementById('profileSuccessMessage');

    function showProfileMessage(message, type) {
        profileErrorMessage.style.display = 'none';
        profileSuccessMessage.style.display = 'none';

        if (type === 'error') {
            profileErrorMessage.textContent = message;
            profileErrorMessage.style.display = 'flex';
        } else if (type === 'success') {
            profileSuccessMessage.textContent = message;
            profileSuccessMessage.style.display = 'flex';
        }
    }

    function hideProfileMessages() {
        profileErrorMessage.style.display = 'none';
        profileSuccessMessage.style.display = 'none';
    }

    // Manejar envío del formulario de edición
    editProfileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideProfileMessages();

        const saveBtn = document.getElementById('saveProfileBtn');
        const saveBtnText = document.getElementById('saveBtnText');
        const saveLoadingSpinner = document.getElementById('saveLoadingSpinner');

        const currentPassword = document.getElementById('currentPassword').value;
        const newNombre = document.getElementById('editNombre').value.trim();
        const newEmail = document.getElementById('editEmail').value.trim();
        const newPassword = document.getElementById('editPassword').value;

        // Validar contraseña actual (siempre requerida)
        if (!currentPassword) {
            showProfileMessage('Debes ingresar tu contraseña actual para realizar cambios', 'error');
            return;
        }

        if (!currentUserData) {
            showProfileMessage('No se pudieron cargar tus datos. Recarga la página e intenta nuevamente.', 'error');
            return;
        }

        // Modo anterior: la contraseña se compara en el navegador. Con Supabase Auth la verifica la BD (RPC).
        if (!usarSupabaseAuth) {
            const passwordAlmacenada = currentUserData.password || currentUserData.contraseña;
            if (passwordAlmacenada !== currentPassword) {
                showProfileMessage('La contraseña actual es incorrecta', 'error');
                return;
            }
        }

        // Verificar que al menos un campo tenga cambios
        const nombreCambio = newNombre && newNombre !== currentUserData.nombre;
        const emailCambio = newEmail && newEmail !== currentUserData.email;
        const passwordCambio = newPassword && newPassword.length > 0;

        if (!nombreCambio && !emailCambio && !passwordCambio) {
            showProfileMessage('No hay cambios para guardar', 'error');
            return;
        }

        // Validar formato de email si se está cambiando
        if (emailCambio) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                showProfileMessage('El formato del email no es válido', 'error');
                return;
            }
        }

        if (passwordCambio && newPassword.length < 6) {
            showProfileMessage('La nueva contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        // Verificar que el nuevo nombre de usuario no esté en uso por otro usuario en la misma empresa
        // (con Supabase Auth lo valida la RPC actualizar_mi_perfil)
        if (nombreCambio && !usarSupabaseAuth) {
            try {
                const { data: existingUser, error: checkError } = await window.supabaseClient
                    .from('usuarios')
                    .select('id, nombre')
                    .eq('empresa_id', user.empresa_id)
                    .ilike('nombre', newNombre)
                    .neq('id', user.id); // Excluir el usuario actual

                if (checkError) {
                    throw checkError;
                }

                // Si existe otro usuario con el mismo nombre en la misma empresa
                if (existingUser && existingUser.length > 0) {
                    showProfileMessage('Este nombre de usuario ya está en uso en tu empresa. Por favor, elige otro.', 'error');
                    saveBtn.disabled = false;
                    saveBtnText.textContent = 'Guardar Cambios';
                    saveLoadingSpinner.style.display = 'none';
                    return;
                }
            } catch (checkError) {
                console.error('Error al verificar nombre de usuario:', checkError);
                showProfileMessage('Error al verificar disponibilidad del nombre. Por favor, intenta nuevamente.', 'error');
                saveBtn.disabled = false;
                saveBtnText.textContent = 'Guardar Cambios';
                saveLoadingSpinner.style.display = 'none';
                return;
            }
        }

        // Deshabilitar botón y mostrar loading
        saveBtn.disabled = true;
        saveBtnText.textContent = 'Guardando...';
        saveLoadingSpinner.style.display = 'inline-block';

        try {
            if (usarSupabaseAuth) {
                // La RPC verifica la contraseña actual contra Supabase Auth y actualiza perfil + credenciales
                const { error: rpcError } = await window.supabaseClient.rpc('actualizar_mi_perfil', {
                    p_password_actual: currentPassword,
                    p_nombre: nombreCambio ? newNombre : null,
                    p_email: emailCambio ? newEmail : null,
                    p_password_nueva: passwordCambio ? newPassword : null
                });
                if (rpcError) throw rpcError;

                await loadUserData();
                user.nombre = currentUserData?.nombre || user.nombre;
                user.email = currentUserData?.email || user.email;
                userNameEl.textContent = user.nombre;
                sessionStorage.setItem('user', JSON.stringify(user));
                showProfileMessage('Información actualizada correctamente', 'success');
                setTimeout(() => closeProfileModal(), 1500);
                return;
            }

            // Preparar datos para actualizar (solo los que cambiaron)
            const updateData = {};

            if (nombreCambio) {
                updateData.nombre = newNombre;
            }

            if (emailCambio) {
                updateData.email = newEmail;
            }

            if (passwordCambio) {
                updateData.password = newPassword;
            }

            // Actualizar en Supabase
            const { error: updateError } = await window.supabaseClient
                .from('usuarios')
                .update(updateData)
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Recargar los datos actualizados del usuario
            const { data: updatedUser, error: fetchError } = await window.supabaseClient
                .from('usuarios')
                .select('id, nombre, email, empresa_id, tipo_usuario_id, activo')
                .eq('id', user.id)
                .single();

            if (fetchError) throw fetchError;

            // Actualizar datos locales
            currentUserData = updatedUser;

            // Actualizar datos en sessionStorage
            if (nombreCambio) {
                user.nombre = newNombre;
                userNameEl.textContent = newNombre;
            }
            if (emailCambio) {
                user.email = newEmail;
            }
            sessionStorage.setItem('user', JSON.stringify(user));

            showProfileMessage('Información actualizada correctamente', 'success');

            // Cerrar modal después de 1.5 segundos
            setTimeout(() => {
                closeProfileModal();
            }, 1500);

        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            
            // Mensaje de error más descriptivo
            let errorMessage = 'Error al actualizar la información. ';
            
            if (error.message && error.message.includes('Failed to fetch')) {
                errorMessage += 'Error de conexión. Verifica tu conexión a internet.';
            } else if (error.message && (error.message.includes('permission denied') || error.message.includes('RLS'))) {
                errorMessage += 'No tienes permisos para actualizar. Verifica las políticas RLS en Supabase.';
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Por favor, intenta nuevamente.';
            }
            
            showProfileMessage(errorMessage, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtnText.textContent = 'Guardar Cambios';
            saveLoadingSpinner.style.display = 'none';
        }
    });

    // Cerrar sesión
    logoutBtn.addEventListener('click', async function() {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            if (autenticadorAuth) {
                await autenticadorAuth.cerrarSesion();
            }
            sessionStorage.removeItem('user');
            window.location.href = 'index.html';
        }
    });

    // ============================================
    // NAVEGACIÓN ENTRE VISTAS
    // ============================================
    const defaultView = document.getElementById('defaultView');
    const ventaView = document.getElementById('ventaView');
    const facturarView = document.getElementById('facturarView');
    const juguetesView = document.getElementById('juguetesView');
    const inventarioView = document.getElementById('inventarioView');
    const bodegasView = document.getElementById('bodegasView');
    const tiendasView = document.getElementById('tiendasView');
    const empleadosView = document.getElementById('empleadosView');
    const usuariosView = document.getElementById('usuariosView');
    const abastecerView = document.getElementById('abastecerView');
    const planesMovimientoView = document.getElementById('planesMovimientoView');
    const ventasListView = document.getElementById('ventasListView');
    const analisisView = document.getElementById('analisisView');
    const ajustesView = document.getElementById('ajustesView');
    
    let currentBodegaId = null;
    let currentEmpleadoId = null;
    let currentTiendaId = null;
    let currentUsuarioId = null;
    let ventaItems = []; // Array para almacenar items de la venta actual
    let ultimoJugueteAgregado = null; // Variable global para guardar el último juguete agregado (para deshacer)

    function showView(viewName) {
        // Cerrar cualquier modal abierto: antes quedaban encima de la nueva vista y bloqueaban los clics
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
        });

        // Ocultar todas las vistas
        defaultView.style.display = 'none';
        ventaView.style.display = 'none';
        facturarView.style.display = 'none';
        juguetesView.style.display = 'none';
        inventarioView.style.display = 'none';
        bodegasView.style.display = 'none';
        tiendasView.style.display = 'none';
        empleadosView.style.display = 'none';
        usuariosView.style.display = 'none';
        abastecerView.style.display = 'none';
        if (planesMovimientoView) planesMovimientoView.style.display = 'none';
        if (ventasListView) ventasListView.style.display = 'none';
        analisisView.style.display = 'none';
        ajustesView.style.display = 'none';
        
        // Ocultar vistas nuevas
        const ventaPorMayorView = document.getElementById('ventaPorMayorView');
        if (ventaPorMayorView) ventaPorMayorView.style.display = 'none';
        const inventarioDetalleView = document.getElementById('inventarioDetalleView');
        if (inventarioDetalleView) inventarioDetalleView.style.display = 'none';
        const clientesView = document.getElementById('clientesView');
        if (clientesView) clientesView.style.display = 'none';
        
        // Verificar permisos para empleados (pueden acceder a Dashboard, Registrar Venta, Inventario, Ajustes y Análisis)
        if (isEmpleado && viewName !== 'default' && viewName !== 'venta' && viewName !== 'facturar' && viewName !== 'inventario' && viewName !== 'ajustes' && viewName !== 'analisis') {
            alert('No tienes permisos para acceder a esta sección');
            return;
        }
        
        // Mostrar la vista seleccionada
        switch(viewName) {
            case 'venta':
                ventaView.style.display = 'block';
                // Inicializar venta y botón deshacer
                if (typeof initRegistrarVenta === 'function') {
                    initRegistrarVenta();
                }
                if (typeof updateVentaItemsList === 'function') {
                    updateVentaItemsList();
                }
                break;
            case 'ventaPorMayor':
                const ventaPorMayorView = document.getElementById('ventaPorMayorView');
                if (ventaPorMayorView) {
                    ventaPorMayorView.style.display = 'block';
                    if (typeof initVentaPorMayor === 'function') {
                        initVentaPorMayor();
                    }
                }
                break;
            case 'facturar':
                // Esta vista se abre desde el botón facturar
                break;
            case 'juguetes':
                if (isAdmin) {
                    juguetesView.style.display = 'block';
                    loadUbicacionesForSelect();
                    // Configurar autocompletado cuando se muestra la vista
                    setTimeout(() => {
                        configurarAutocompletadoJuguete();
                    }, 100);
                }
                break;
            case 'inventario':
                    inventarioView.style.display = 'block';
                    loadInventario();
                break;
            case 'inventarioDetalle':
                inventarioDetalleView.style.display = 'block';
                if (typeof loadInventarioDetalle === 'function') {
                    loadInventarioDetalle();
                }
                break;
            case 'bodegas':
                if (isAdmin) {
                    bodegasView.style.display = 'block';
                    loadBodegas();
                }
                break;
            case 'tiendas':
                if (isAdmin) {
                    tiendasView.style.display = 'block';
                    // Inicializar acordeón primero
                    if (typeof initAgregarTiendaAccordion === 'function') {
                        initAgregarTiendaAccordion();
                    } else {
                        // Fallback: inicializar directamente
                        setTimeout(() => {
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
                        }, 100);
                    }
                    // Cargar tiendas
                    if (typeof loadTiendas === 'function') {
                        loadTiendas();
                    }
                    // Configurar formulario
                    if (typeof setupTiendaForm === 'function') {
                        setupTiendaForm();
                    }
                }
                break;
            case 'empleados':
                if (isAdmin) {
                    empleadosView.style.display = 'block';
                    loadEmpleados();
                    if (typeof loadTiendasForEmpleados === 'function') {
                        loadTiendasForEmpleados();
                    }
                }
                break;
            case 'usuarios':
                if (isAdmin) {
                    usuariosView.style.display = 'block';
                    if (typeof loadUsuarios === 'function') {
                        loadUsuarios();
                    }
                    if (typeof setupUsuarioForm === 'function') {
                        setupUsuarioForm();
                    }
                }
                break;
            case 'clientes':
                if (isAdmin) {
                    const clientesView = document.getElementById('clientesView');
                    if (clientesView) {
                        clientesView.style.display = 'block';
                        if (typeof initClientes === 'function') {
                            initClientes();
                        }
                    }
                }
                break;
            case 'abastecer':
                if (isAdmin) {
                    abastecerView.style.display = 'block';
                    if (typeof initAbastecer === 'function') {
                        initAbastecer();
                    }
                }
                break;
            case 'planesMovimiento':
                if (isAdmin) {
                    if (planesMovimientoView) {
                        planesMovimientoView.style.display = 'block';
                        if (typeof initPlanesMovimiento === 'function') {
                            initPlanesMovimiento();
                        }
                    }
                }
                break;
            case 'analisis':
                // Solo administradores y super administradores pueden ver análisis
                if (isAdmin && analisisView) {
                    analisisView.style.display = 'block';
                    if (typeof loadAnalisis === 'function') {
                        loadAnalisis();
                    }
                } else {
                    // Si un empleado intenta abrir 'analisis', mostrar vista por defecto
                    defaultView.style.display = 'block';
                    if (typeof loadDashboardSummary === 'function') {
                        loadDashboardSummary();
                    }
                }
                break;
            case 'ajustes':
                ajustesView.style.display = 'block';
                if (typeof initAjustes === 'function') {
                    initAjustes();
                }
                break;
            case 'ventas':
                if (ventasListView) {
                    ventasListView.style.display = 'block';
                    if (typeof initVentasLista === 'function') {
                        initVentasLista();
                    }
                }
                break;
            default:
                defaultView.style.display = 'block';
                if (typeof loadDashboardSummary === 'function') {
                    loadDashboardSummary();
                }
                break;
        }
    }

    // Manejar clicks en los botones del sidebar
    const sidebarButtons = document.querySelectorAll('.sidebar-btn');
    
    sidebarButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover clase active de todos los botones
            sidebarButtons.forEach(b => b.classList.remove('active'));
            
            // Agregar clase active al botón clickeado
            this.classList.add('active');
            
            // Obtener la página asociada
            const page = this.getAttribute('data-page');
            showView(page);
        });
    });

    // ============================================
    // FUNCIONALIDAD DE BODEGAS
    // ============================================
    
    // Toggle del acordeón "Agregar Bodega"
    const agregarBodegaHeader = document.getElementById('agregarBodegaHeader');
    const agregarBodegaContent = document.getElementById('agregarBodegaContent');
    
    agregarBodegaHeader.addEventListener('click', function() {
        agregarBodegaContent.classList.toggle('active');
        const icon = agregarBodegaHeader.querySelector('.accordion-icon');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    });

    // Cargar bodegas desde Supabase
    // Variables de paginación para bodegas
    let paginaActualBodegas = 1;
    const itemsPorPaginaBodegas = 10;
    let todasLasBodegas = [];

    async function loadBodegas() {
        const bodegasList = document.getElementById('bodegasList');
        bodegasList.innerHTML = '<p style="text-align: center; color: #64748b;">Cargando bodegas...</p>';
        
        try {
            const { data: bodegas, error } = await window.supabaseClient
                .from('bodegas')
                .select('*')
                .eq('empresa_id', user.empresa_id)
                .order('nombre');

            if (error) throw error;

            todasLasBodegas = bodegas || [];
            paginaActualBodegas = 1;
            renderizarPaginaBodegas();
        } catch (error) {
            console.error('Error al cargar bodegas:', error);
            bodegasList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar las bodegas. Por favor, recarga la página.</p>';
        }
    }

    function renderizarPaginaBodegas() {
        const bodegasList = document.getElementById('bodegasList');
        
        if (!todasLasBodegas || todasLasBodegas.length === 0) {
                bodegasList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay bodegas registradas. Agrega una nueva bodega.</p>';
            document.getElementById('bodegasPagination').innerHTML = '';
                return;
            }

        // Calcular paginación
        const totalPaginas = Math.ceil(todasLasBodegas.length / itemsPorPaginaBodegas);
        const inicio = (paginaActualBodegas - 1) * itemsPorPaginaBodegas;
        const fin = inicio + itemsPorPaginaBodegas;
        const bodegasPagina = todasLasBodegas.slice(inicio, fin);

        // Renderizar bodegas de la página actual
            bodegasList.innerHTML = '';
        bodegasPagina.forEach(bodega => {
                const bodegaCard = createBodegaCard(bodega);
                bodegasList.appendChild(bodegaCard);
            });

        renderizarPaginacionBodegas(totalPaginas, todasLasBodegas.length);
    }

    function renderizarPaginacionBodegas(totalPaginas, totalBodegas) {
        const paginationContainer = document.getElementById('bodegasPagination');
        
        if (totalPaginas <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginacionHTML = '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">';
        
        // Botón Anterior
        if (paginaActualBodegas > 1) {
            paginacionHTML += `
                <button onclick="cambiarPaginaBodegas(${paginaActualBodegas - 1})" 
                        style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
            `;
        }

        // Pestañas de páginas (mostrar máximo 7 pestañas)
        const maxPestañas = 7;
        let inicioPestañas = Math.max(1, paginaActualBodegas - Math.floor(maxPestañas / 2));
        let finPestañas = Math.min(totalPaginas, inicioPestañas + maxPestañas - 1);
        
        if (finPestañas - inicioPestañas < maxPestañas - 1) {
            inicioPestañas = Math.max(1, finPestañas - maxPestañas + 1);
        }

        // Primera página si no está visible
        if (inicioPestañas > 1) {
            paginacionHTML += `
                <button onclick="cambiarPaginaBodegas(1)" 
                        style="padding: 8px 12px; background: ${paginaActualBodegas === 1 ? '#3b82f6' : 'white'}; color: ${paginaActualBodegas === 1 ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
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
                <button onclick="cambiarPaginaBodegas(${i})" 
                        style="padding: 8px 12px; background: ${paginaActualBodegas === i ? '#3b82f6' : 'white'}; color: ${paginaActualBodegas === i ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
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
                <button onclick="cambiarPaginaBodegas(${totalPaginas})" 
                        style="padding: 8px 12px; background: ${paginaActualBodegas === totalPaginas ? '#3b82f6' : 'white'}; color: ${paginaActualBodegas === totalPaginas ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    ${totalPaginas}
                </button>
            `;
        }

        // Botón Siguiente
        if (paginaActualBodegas < totalPaginas) {
            paginacionHTML += `
                <button onclick="cambiarPaginaBodegas(${paginaActualBodegas + 1})" 
                        style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Siguiente <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginacionHTML += '</div>';
        paginationContainer.innerHTML = paginacionHTML;
    }

    window.cambiarPaginaBodegas = function(nuevaPagina) {
        paginaActualBodegas = nuevaPagina;
        renderizarPaginaBodegas();
    };

    // Crear tarjeta de bodega
    function createBodegaCard(bodega) {
        const card = document.createElement('div');
        card.className = 'bodega-card';
        card.innerHTML = `
            <div class="bodega-info">
                <h3>${bodega.nombre}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${bodega.direccion}</p>
            </div>
            <div class="bodega-actions">
                <button class="menu-toggle" data-bodega-id="${bodega.id}">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="dropdown-menu" id="menu-${bodega.id}" style="display: none;">
                    <button class="dropdown-item" data-action="edit" data-bodega-id="${bodega.id}">
                        <i class="fas fa-edit"></i> Actualizar
                    </button>
                    <button class="dropdown-item" data-action="add-juguetes" data-bodega-id="${bodega.id}">
                        <i class="fas fa-plus"></i> Agregar Juguetes
                    </button>
                    <button class="dropdown-item danger" data-action="delete" data-bodega-id="${bodega.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
        return card;
    }

    // Manejar clicks en el menú de 3 puntos
    document.addEventListener('click', function(e) {
        // Toggle del menú
        if (e.target.closest('.menu-toggle')) {
            const menuToggle = e.target.closest('.menu-toggle');
            const bodegaId = menuToggle.getAttribute('data-bodega-id');
            if (!bodegaId) return;
            
            const menu = document.getElementById(`menu-${bodegaId}`);
            if (!menu) return;
            
            // Cerrar todos los demás menús
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m.id !== `menu-${bodegaId}`) {
                    m.style.display = 'none';
                }
            });
            
            // Toggle del menú actual
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
        
        // Cerrar menús al hacer click fuera
        if (!e.target.closest('.bodega-actions')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                m.style.display = 'none';
            });
        }
        
        // Acciones del menú
        if (e.target.closest('.dropdown-item')) {
            const item = e.target.closest('.dropdown-item');
            const action = item.getAttribute('data-action');
            const bodegaId = item.getAttribute('data-bodega-id');
            
            // Validar que bodegaId existe
            if (!bodegaId) {
                console.warn('No se encontró bodegaId en el elemento');
                return;
            }
            
            // Cerrar el menú
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                m.style.display = 'none';
            });
            
            if (action === 'edit') {
                openEditBodegaModal(bodegaId);
            } else if (action === 'add-juguetes') {
                openAgregarJuguetesModal(bodegaId);
            } else if (action === 'delete') {
                deleteBodega(bodegaId);
            }
        }
    });

    // Formulario para agregar nueva bodega
    const nuevaBodegaForm = document.getElementById('nuevaBodegaForm');
    window.preventFormDoubleSubmit(nuevaBodegaForm, async function(e) { // Protegido contra doble envío
        e.preventDefault();
        
        const nombre = document.getElementById('bodegaNombre').value.trim();
        const direccion = document.getElementById('bodegaDireccion').value.trim();
        
        if (!nombre || !direccion) {
            showBodegaMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('bodegas')
                .insert({
                    nombre: nombre,
                    direccion: direccion,
                    empresa_id: user.empresa_id
                });

            if (error) throw error;

            showBodegaMessage('Bodega agregada correctamente', 'success');
            nuevaBodegaForm.reset();
            await loadBodegas();
        } catch (error) {
            console.error('Error al agregar bodega:', error);
            showBodegaMessage('Error al agregar la bodega: ' + error.message, 'error');
        }
    });

    // Funciones para mostrar mensajes de bodegas
    function showBodegaMessage(message, type) {
        const errorMsg = document.getElementById('bodegaErrorMessage');
        const successMsg = document.getElementById('bodegaSuccessMessage');
        
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

    // Abrir modal para editar bodega
    async function openEditBodegaModal(bodegaId) {
        // Validar que bodegaId existe y es válido
        if (!bodegaId || bodegaId === 'null' || bodegaId === 'undefined') {
            console.error('Error: bodegaId inválido:', bodegaId);
            alert('Error: No se pudo identificar la bodega a editar');
            return;
        }
        
        try {
            const bodegaIdNum = parseInt(bodegaId, 10);
            if (isNaN(bodegaIdNum)) {
                throw new Error('ID de bodega inválido');
            }
            
            const { data: bodega, error } = await window.supabaseClient
                .from('bodegas')
                .select('*')
                .eq('id', bodegaIdNum)
                .single();

            if (error) throw error;

            document.getElementById('editBodegaNombre').value = bodega.nombre;
            document.getElementById('editBodegaDireccion').value = bodega.direccion;
            currentBodegaId = bodegaId;
            
            const modal = document.getElementById('editBodegaModal');
            modal.style.display = 'flex';
        } catch (error) {
            console.error('Error al cargar bodega:', error);
            alert('Error al cargar los datos de la bodega');
        }
    }

    // Formulario para editar bodega
    const editBodegaForm = document.getElementById('editBodegaForm');
    window.preventFormDoubleSubmit(editBodegaForm, async function(e) { // Protegido contra doble envío
        e.preventDefault();
        
        const nombre = document.getElementById('editBodegaNombre').value.trim();
        const direccion = document.getElementById('editBodegaDireccion').value.trim();
        
        if (!nombre || !direccion) {
            showEditBodegaMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('bodegas')
                .update({
                    nombre: nombre,
                    direccion: direccion
                })
                .eq('id', currentBodegaId);

            if (error) throw error;

            showEditBodegaMessage('Bodega actualizada correctamente', 'success');
            setTimeout(() => {
                closeEditBodegaModal();
                loadBodegas();
            }, 1500);
        } catch (error) {
            console.error('Error al actualizar bodega:', error);
            showEditBodegaMessage('Error al actualizar la bodega: ' + error.message, 'error');
        }
    });

    // Funciones para mostrar mensajes en modal de edición
    function showEditBodegaMessage(message, type) {
        const errorMsg = document.getElementById('editBodegaErrorMessage');
        const successMsg = document.getElementById('editBodegaSuccessMessage');
        
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

    // Cerrar modal de editar bodega
    function closeEditBodegaModal() {
        const modal = document.getElementById('editBodegaModal');
        modal.style.display = 'none';
        editBodegaForm.reset();
        document.getElementById('editBodegaErrorMessage').style.display = 'none';
        document.getElementById('editBodegaSuccessMessage').style.display = 'none';
        currentBodegaId = null;
    }

    document.getElementById('closeEditBodegaModal').addEventListener('click', closeEditBodegaModal);
    document.getElementById('cancelEditBodegaBtn').addEventListener('click', closeEditBodegaModal);
    document.getElementById('editBodegaModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditBodegaModal();
        }
    });

    // Eliminar bodega
    async function deleteBodega(bodegaId) {
        // Validar que bodegaId existe y es válido
        if (!bodegaId || bodegaId === 'null' || bodegaId === 'undefined') {
            console.error('Error: bodegaId inválido:', bodegaId);
            alert('Error: No se pudo identificar la bodega a eliminar');
            return;
        }
        
        // No permitir borrar una bodega con juguetes: quedarían sin ubicación (ON DELETE SET NULL)
        try {
            const resumen = await window.servicioStock.resumenUbicacion('bodega', bodegaId);
            if (resumen.registros > 0) {
                alert(`No se puede eliminar: la bodega tiene ${resumen.registros} juguete(s) registrados (${resumen.unidades} unidades). Muévelos primero con "Abastecer" o elimínalos.`);
                return;
            }
        } catch (error) {
            console.error('Error al verificar el inventario de la bodega:', error);
            alert('No se pudo verificar el inventario de la bodega. Intenta de nuevo.');
            return;
        }

        if (!confirm('¿Estás seguro de que deseas eliminar esta bodega? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const bodegaIdNum = parseInt(bodegaId, 10);
            if (isNaN(bodegaIdNum)) {
                throw new Error('ID de bodega inválido');
            }
            
            const { error } = await window.supabaseClient
                .from('bodegas')
                .delete()
                .eq('id', bodegaIdNum);

            if (error) throw error;

            alert('Bodega eliminada correctamente');
            loadBodegas();
        } catch (error) {
            console.error('Error al eliminar bodega:', error);
            alert('Error al eliminar la bodega: ' + error.message);
        }
    }

    // Abrir modal para agregar juguetes (si existe)
    function openAgregarJuguetesModal(bodegaId) {
        // Validar que bodegaId existe y es válido
        if (!bodegaId || bodegaId === 'null' || bodegaId === 'undefined') {
            console.error('Error: bodegaId inválido:', bodegaId);
            alert('Error: No se pudo identificar la bodega');
            return;
        }
        
        currentBodegaId = bodegaId;
        const modal = document.getElementById('agregarJuguetesModal');
        if (modal) {
        modal.style.display = 'flex';
            const form = document.getElementById('agregarJuguetesForm');
            if (form) form.reset();
            const errorMsg = document.getElementById('jugueteErrorMessage');
            const successMsg = document.getElementById('jugueteSuccessMessage');
            if (errorMsg) errorMsg.style.display = 'none';
            if (successMsg) successMsg.style.display = 'none';
        } else {
            // Si no existe el modal, redirigir a la vista de juguetes
            showView('juguetes');
        }
    }

    // Formulario para agregar juguetes (desde modal de bodega - obsoleto, usar formulario principal)
    const agregarJuguetesForm = document.getElementById('agregarJuguetesForm');
    if (agregarJuguetesForm) {
    window.preventFormDoubleSubmit(agregarJuguetesForm, async function(e) { // Protegido contra doble envío
        e.preventDefault();
        
            const nombre = capitalizarPrimeraLetra(document.getElementById('jugueteNombre')?.value.trim());
            const codigo = document.getElementById('jugueteCodigo')?.value.trim();
            const cantidad = parseInt(document.getElementById('jugueteCantidad')?.value || 0);

            if (!nombre || !codigo || isNaN(cantidad) || cantidad < 0) {
            showJugueteMessage('Por favor, completa todos los campos correctamente', 'error');
            return;
        }

        try {
                // Verificar si ya existe un juguete con el mismo código en la misma ubicación
                // Nota: Ahora permitimos nombres duplicados, solo verificamos código + ubicación
                const { data: jugueteExistenteData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', codigo)
                    .eq('empresa_id', user.empresa_id)
                    .eq('bodega_id', currentBodegaId)
                    .limit(1);

                if (jugueteExistenteData && jugueteExistenteData.length > 0) {
                    // Si existe, sumar la cantidad al registro existente
                    const jugueteExistente = jugueteExistenteData[0];
                    const nuevaCantidad = jugueteExistente.cantidad + cantidad;
                    
                    const { error: updateError } = await window.supabaseClient
                        .from('juguetes')
                        .update({ cantidad: nuevaCantidad })
                        .eq('id', jugueteExistente.id);

                    if (updateError) throw updateError;
                    
                    showJugueteMessage(`Juguete actualizado: se agregaron ${cantidad} unidades (Total: ${nuevaCantidad})`, 'success');
                } else {
                    // Si no existe, crear un nuevo registro
            const { error } = await window.supabaseClient
                .from('juguetes')
                .insert({
                    nombre: nombre,
                    codigo: codigo,
                    cantidad: cantidad,
                            bodega_id: currentBodegaId,
                            empresa_id: user.empresa_id
                });

            if (error) throw error;

            showJugueteMessage('Juguete agregado correctamente', 'success');
                }

            setTimeout(() => {
                closeAgregarJuguetesModal();
            }, 1500);
        } catch (error) {
            console.error('Error al agregar juguete:', error);
            showJugueteMessage('Error al agregar el juguete: ' + error.message, 'error');
        }
    });
    }

    // Funciones para mostrar mensajes en modal de juguetes
    function showJugueteMessage(message, type) {
        const errorMsg = document.getElementById('jugueteErrorMessage');
        const successMsg = document.getElementById('jugueteSuccessMessage');
        
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

    // Cerrar modal de agregar juguetes (si existe)
    function closeAgregarJuguetesModal() {
        const modal = document.getElementById('agregarJuguetesModal');
        if (modal) {
        modal.style.display = 'none';
            const form = document.getElementById('agregarJuguetesForm');
            if (form) form.reset();
            const errorMsg = document.getElementById('jugueteErrorMessage');
            const successMsg = document.getElementById('jugueteSuccessMessage');
            if (errorMsg) errorMsg.style.display = 'none';
            if (successMsg) successMsg.style.display = 'none';
        currentBodegaId = null;
    }
    }

    // Solo agregar event listeners si los elementos existen
    const closeModalBtn = document.getElementById('closeAgregarJuguetesModal');
    const cancelBtn = document.getElementById('cancelAgregarJuguetesBtn');
    const modal = document.getElementById('agregarJuguetesModal');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeAgregarJuguetesModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAgregarJuguetesModal);
    }
    if (modal) {
        modal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeAgregarJuguetesModal();
        }
    });
    }

    // ============================================
    // FUNCIONALIDAD DE JUGUETES
    // ============================================

    // Cargar ubicaciones (bodegas y tiendas) para el select
    let ubicacionListenerAdded = false;
    async function loadUbicacionesForSelect() {
        const tipoSelect = document.getElementById('jugueteUbicacionTipo');
        const ubicacionSelect = document.getElementById('jugueteUbicacionSelect');
        const container = document.getElementById('jugueteUbicacionContainer');

        if (!tipoSelect || !ubicacionSelect || !container) return;

        // Solo agregar el listener una vez
        if (!ubicacionListenerAdded) {
        tipoSelect.addEventListener('change', async function() {
            const tipo = this.value;
            ubicacionSelect.innerHTML = '<option value="">Selecciona una ubicación</option>';
            
            if (!tipo) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';

            try {
                if (tipo === 'bodega') {
                    const { data: bodegas, error } = await window.supabaseClient
                        .from('bodegas')
                        .select('*')
                        .eq('empresa_id', user.empresa_id)
                        .order('nombre');

                    if (error) throw error;
                        if (bodegas && bodegas.length > 0) {
                        bodegas.forEach(bodega => {
                            const option = document.createElement('option');
                            option.value = bodega.id;
                            option.textContent = bodega.nombre;
                            ubicacionSelect.appendChild(option);
                        });
                    }
                } else if (tipo === 'tienda') {
                    const { data: tiendas, error } = await window.supabaseClient
                        .from('tiendas')
                        .select('*')
                        .eq('empresa_id', user.empresa_id)
                        .order('nombre');

                    if (error) throw error;
                        if (tiendas && tiendas.length > 0) {
                        tiendas.forEach(tienda => {
                            const option = document.createElement('option');
                            option.value = tienda.id;
                            option.textContent = tienda.nombre;
                            ubicacionSelect.appendChild(option);
                        });
                    }
                }
            } catch (error) {
                console.error('Error al cargar ubicaciones:', error);
            }
            });
            ubicacionListenerAdded = true;
        }
    }

    // Configurar autocompletado para formulario de agregar juguete
    // Función para convertir URL de Imgur a formato directo de imagen
    function convertirUrlImgur(url) {
        if (!url || !url.trim()) return url;
        
        const urlLimpia = url.trim();
        
        // Si ya es una URL directa de imagen (i.imgur.com), devolverla tal cual
        if (urlLimpia.includes('i.imgur.com/')) {
            return urlLimpia;
        }
        
        // Si es una URL de álbum (imgur.com/a/xxx), intentar convertir
        const matchAlbum = urlLimpia.match(/imgur\.com\/a\/([a-zA-Z0-9]+)/i);
        if (matchAlbum) {
            // Para álbumes de Imgur, intentar con formato de imagen directa
            // Nota: Esto puede no funcionar para todos los álbumes, pero es un intento
            const albumId = matchAlbum[1];
            // Intentar con diferentes extensiones comunes
            return `https://i.imgur.com/${albumId}.jpg`;
        }
        
        // Si es una URL de imagen (imgur.com/xxx), convertir a i.imgur.com/xxx.jpg
        const matchImagen = urlLimpia.match(/imgur\.com\/([a-zA-Z0-9]+)/i);
        if (matchImagen) {
            return `https://i.imgur.com/${matchImagen[1]}.jpg`;
        }
        
        // Si no coincide con ningún patrón, devolver la URL original
        return urlLimpia;
    }
    
    function configurarAutocompletadoJuguete() {
        const nombreInput = document.getElementById('jugueteNombreInput');
        const codigoInput = document.getElementById('jugueteCodigoInput');
        const precioMinInput = document.getElementById('juguetePrecioMinInput');
        const fotoUrlInput = document.getElementById('jugueteFotoUrlInput');
        
        if (!nombreInput || !codigoInput) return;
        
        let timeoutNombre = null;
        let timeoutCodigo = null;
        
        // Función para autocompletar todos los campos excepto cantidad y ubicación
        function autocompletarCampos(juguete) {
            if (juguete.codigo) {
                codigoInput.value = juguete.codigo;
            }
            if (juguete.nombre) {
                nombreInput.value = juguete.nombre;
            }
            if (juguete.precio_min !== null && juguete.precio_min !== undefined && precioMinInput) {
                window.FormatoMoneda.asignar(precioMinInput, juguete.precio_min);
            }
            if (juguete.precio_por_mayor !== null && juguete.precio_por_mayor !== undefined) {
                const precioPorMayorInput = document.getElementById('juguetePrecioPorMayorInput');
                if (precioPorMayorInput) {
                    window.FormatoMoneda.asignar(precioPorMayorInput, juguete.precio_por_mayor);
                }
            }
            if (juguete.item) {
                const itemInput = document.getElementById('jugueteItemInput');
                if (itemInput) {
                    itemInput.value = juguete.item;
                }
            }
            if (juguete.foto_url && fotoUrlInput) {
                const fotoUrlConvertida = convertirUrlImgur(juguete.foto_url);
                fotoUrlInput.value = fotoUrlConvertida;
                // Actualizar campo hidden también
                const jugueteFotoUrl = document.getElementById('jugueteFotoUrl');
                if (jugueteFotoUrl) {
                    jugueteFotoUrl.value = fotoUrlConvertida;
                }
            }
            // Autocompletar campos de bultos si existen
            if (juguete.numero_bultos !== null && juguete.numero_bultos !== undefined) {
                const numeroBultosInput = document.getElementById('jugueteNumeroBultosInput');
                if (numeroBultosInput) {
                    numeroBultosInput.value = juguete.numero_bultos;
                }
            }
            if (juguete.cantidad_por_bulto !== null && juguete.cantidad_por_bulto !== undefined) {
                const cantidadPorBultoInput = document.getElementById('jugueteCantidadPorBultoInput');
                if (cantidadPorBultoInput) {
                    cantidadPorBultoInput.value = juguete.cantidad_por_bulto;
                }
            }
            // Mostrar vista previa de foto si existe
            if (juguete.foto_url && fotoUrlInput) {
                const fotoUrlConvertida = convertirUrlImgur(juguete.foto_url);
                const fotoPreview = document.getElementById('fotoPreview');
                const fotoPreviewImg = document.getElementById('fotoPreviewImg');
                if (fotoPreviewImg && fotoPreview) {
                    fotoPreviewImg.src = fotoUrlConvertida;
                    fotoPreview.style.display = 'block';
                    fotoPreviewImg.onerror = function() {
                        fotoPreview.style.display = 'none';
                    };
                }
            }
        }
        
        // Autocompletar código cuando se ingresa nombre
        nombreInput.addEventListener('input', async function() {
            clearTimeout(timeoutNombre);
            const nombre = this.value.trim();
            
            if (nombre.length < 1) {
                codigoInput.value = '';
                return;
            }
            
            timeoutNombre = setTimeout(async () => {
                try {
                    const user = JSON.parse(sessionStorage.getItem('user'));
                    const { data: juguetes, error } = await window.supabaseClient
                        .from('juguetes')
                        .select('codigo, nombre, precio_min, precio_por_mayor, item, foto_url')
                        .eq('empresa_id', user.empresa_id)
                        .ilike('nombre', nombre)
                        .limit(1);
                    
                    if (error) throw error;
                    
                    // Si hay un resultado, autocompletar todos los campos
                    if (juguetes && juguetes.length > 0) {
                        const juguete = juguetes[0];
                        // Solo autocompletar si el nombre coincide exactamente (ignorando mayúsculas)
                        if (juguete.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()) {
                            autocompletarCampos(juguete);
                        }
                    }
                } catch (error) {
                    console.error('Error en autocompletado por nombre:', error);
                }
            }, 300);
        });
        
        // Autocompletar nombre y demás campos cuando se ingresa un código (solo al salir del input)
        codigoInput.addEventListener('blur', async function() {
            clearTimeout(timeoutCodigo);
            const codigo = this.value.trim();
            
            if (codigo.length < 1) {
                // Si se borra el código, no tocamos el nombre ni otros campos
                return;
            }
            
            timeoutCodigo = setTimeout(async () => {
                try {
                    const user = JSON.parse(sessionStorage.getItem('user'));
                    const { data: juguetes, error } = await window.supabaseClient
                        .from('juguetes')
                        .select('codigo, nombre, precio_min, precio_por_mayor, item, foto_url')
                        .eq('empresa_id', user.empresa_id)
                        .ilike('codigo', codigo)
                        .limit(1);
                    
                    if (error) throw error;
                    
                    // Si hay un resultado, autocompletar todos los campos
                    if (juguetes && juguetes.length > 0) {
                        const juguete = juguetes[0];
                        // Solo autocompletar si el código coincide exactamente (ignorando mayúsculas)
                        if (juguete.codigo.toLowerCase().trim() === codigo.toLowerCase().trim()) {
                            autocompletarCampos(juguete);
                        }
                    }
                } catch (error) {
                    console.error('Error en autocompletado por código:', error);
                }
            }, 0);
        });
    }

    // Formulario para agregar juguete
    const agregarJugueteForm = document.getElementById('agregarJugueteForm');
    if (agregarJugueteForm) {
        // Configurar autocompletado
        configurarAutocompletadoJuguete();
        
        // Precios en pesos colombianos ($28.000): se muestran formateados y se guarda el número
        window.FormatoMoneda.configurarInput(document.getElementById('juguetePrecioMinInput'));
        window.FormatoMoneda.configurarInput(document.getElementById('juguetePrecioPorMayorInput'));
        
        // Configurar campo de URL de foto
        const jugueteFotoUrl = document.getElementById('jugueteFotoUrl');
        const jugueteFotoUrlInput = document.getElementById('jugueteFotoUrlInput');
        const fotoPreview = document.getElementById('fotoPreview');
        const fotoPreviewImg = document.getElementById('fotoPreviewImg');
        
        // Manejar input de URL de foto
        if (jugueteFotoUrlInput) {
            jugueteFotoUrlInput.addEventListener('input', function() {
                let url = this.value.trim();
                
                // Convertir URL de Imgur si es necesario
                if (url) {
                    url = convertirUrlImgur(url);
                    this.value = url;
                }
                
                if (url) {
                    // Actualizar campo hidden
                    if (jugueteFotoUrl) {
                        jugueteFotoUrl.value = url;
                    }
                    // Mostrar vista previa
                    if (fotoPreviewImg) {
                        fotoPreviewImg.src = url;
                        fotoPreviewImg.onerror = function() {
                            // Si la imagen no carga, ocultar la vista previa
                            if (fotoPreview) {
                                fotoPreview.style.display = 'none';
                            }
                        };
                    }
                    if (fotoPreview) {
                        fotoPreview.style.display = 'block';
                    }
                } else {
                    // Limpiar si está vacío
                    if (jugueteFotoUrl) {
                        jugueteFotoUrl.value = '';
                    }
                    if (fotoPreview) {
                        fotoPreview.style.display = 'none';
                    }
                }
            });
        }
        
        // Código de subida de archivos eliminado - solo se usa URL
        if (false && subirFotoBtn && jugueteFotoInput) {
            subirFotoBtn.addEventListener('click', async function() {
                const archivo = jugueteFotoInput.files[0];
                
                if (!archivo) {
                    showJugueteFormMessage('Por favor, selecciona una foto primero', 'error');
                    return;
                }
                
                // Validar que sea una imagen (incluyendo HEIC/HEIF)
                const esImagen = archivo.type.startsWith('image/') || 
                                archivo.name.toLowerCase().endsWith('.heic') || 
                                archivo.name.toLowerCase().endsWith('.heif');
                
                if (!esImagen) {
                    showJugueteFormMessage('Por favor, selecciona un archivo de imagen válido (JPEG, PNG, GIF, WEBP, HEIC, etc.)', 'error');
                    return;
                }
                
                // Validar tamaño (máximo 10MB)
                if (archivo.size > 10 * 1024 * 1024) {
                    showJugueteFormMessage('La imagen es demasiado grande. El tamaño máximo es 10MB', 'error');
                    return;
                }
                
                // Verificar que Supabase Storage esté disponible
                if (!window.subirImagen) {
                    showJugueteFormMessage('Error: La función de subida de imágenes no está disponible. Verifica que Supabase Storage esté configurado correctamente. Puedes ingresar la URL manualmente.', 'error');
                    // Mostrar vista previa local
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        fotoPreviewImg.src = e.target.result;
                        fotoPreview.style.display = 'block';
                        fotoUrlText.textContent = 'Supabase Storage no configurado. Usa el campo de URL manual.';
                    };
                    reader.readAsDataURL(archivo);
                    return;
                }
                
                try {
                    subirFotoBtn.disabled = true;
                    subirFotoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
                    
                    // Subir imagen a Supabase Storage
                    const url = await window.subirImagen(archivo);
                    
                    // Actualizar URL y vista previa
                    actualizarFotoUrl(url);
                    
                    showJugueteFormMessage('Foto subida exitosamente a Supabase Storage', 'success');
                    
                    subirFotoBtn.disabled = false;
                    subirFotoBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir Foto';
                } catch (error) {
                    console.error('Error al subir foto:', error);
                    let mensajeError = 'Error al subir la foto: ' + error.message;
                    
                    // Mensaje más específico si el bucket no existe
                    if (error.message.includes('Bucket no existe') || error.message.includes('bucket')) {
                        mensajeError = 'El bucket de Supabase Storage no está configurado. Por favor, crea el bucket "juguetes" en Supabase Storage (público). Puedes ingresar la URL manualmente mientras tanto.';
                    }
                    
                    showJugueteFormMessage(mensajeError, 'error');
                    subirFotoBtn.disabled = false;
                    subirFotoBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir Foto';
                    
                    // Mostrar vista previa local aunque falle la subida
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (fotoPreviewImg) {
                            fotoPreviewImg.src = e.target.result;
                        }
                        if (fotoPreview) {
                            fotoPreview.style.display = 'block';
                        }
                        if (fotoUrlText) {
                            fotoUrlText.textContent = 'Error al subir. Usa el campo de URL manual.';
                        }
                    };
                    reader.readAsDataURL(archivo);
                }
            });
            
            // Mostrar vista previa cuando se selecciona un archivo
            jugueteFotoInput.addEventListener('change', async function(e) {
                const archivo = e.target.files[0];
                if (!archivo) {
                    fotoPreview.style.display = 'none';
                    jugueteFotoUrl.value = '';
                    return;
                }

                // Verificar si es una imagen (incluyendo HEIC)
                const esImagen = archivo.type.startsWith('image/') || 
                                archivo.name.toLowerCase().endsWith('.heic') || 
                                archivo.name.toLowerCase().endsWith('.heif');
                
                if (esImagen) {
                    try {
                        let archivoParaVistaPrevia = archivo;
                        
                        // Si es HEIC, convertirlo para la vista previa
                        if (window.esHeic && window.esHeic(archivo)) {
                            try {
                                archivoParaVistaPrevia = await window.convertirHeicAJpeg(archivo);
                                fotoUrlText.textContent = 'Archivo HEIC detectado. Se convertirá a JPEG al subir.';
                            } catch (error) {
                                console.warn('No se pudo convertir HEIC para vista previa:', error);
                                fotoUrlText.textContent = 'Archivo HEIC detectado. Haz clic en "Subir Foto".';
                            }
                        } else {
                            fotoUrlText.textContent = 'Haz clic en "Subir Foto" para guardar la imagen';
                        }
                        
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            fotoPreviewImg.src = e.target.result;
                            fotoPreview.style.display = 'block';
                        };
                        reader.readAsDataURL(archivoParaVistaPrevia);
                    } catch (error) {
                        console.error('Error al mostrar vista previa:', error);
                        fotoPreview.style.display = 'none';
                        jugueteFotoUrl.value = '';
                    }
                } else {
                    fotoPreview.style.display = 'none';
                    jugueteFotoUrl.value = '';
                    showJugueteFormMessage('Por favor, selecciona un archivo de imagen válido', 'error');
                }
            });
        }
        
        window.preventFormDoubleSubmit(agregarJugueteForm, async function(e) { // Protegido contra doble envío
            e.preventDefault();
            
            const nombre = capitalizarPrimeraLetra(document.getElementById('jugueteNombreInput').value.trim());
            const codigo = document.getElementById('jugueteCodigoInput').value.trim();
            const item = document.getElementById('jugueteItemInput')?.value.trim() || null;
            const cantidad = parseInt(document.getElementById('jugueteCantidadInput').value);
            // Obtener el valor numérico real del campo de precio mínimo (puede estar formateado)
            const precioMinInput = document.getElementById('juguetePrecioMinInput');
            const precioMinRaw = precioMinInput?.dataset.numericValue || precioMinInput?.value.replace(/[^\d]/g, '') || '0';
            const precioMin = parseFloat(precioMinRaw);
            // Obtener el valor numérico real del campo de precio al por mayor (puede estar formateado)
            const precioPorMayorInput = document.getElementById('juguetePrecioPorMayorInput');
            const precioPorMayorRaw = precioPorMayorInput?.dataset.numericValue || precioPorMayorInput?.value.replace(/[^\d]/g, '') || null;
            const precioPorMayor = precioPorMayorRaw ? parseFloat(precioPorMayorRaw) : null;
            const ubicacionTipo = document.getElementById('jugueteUbicacionTipo').value;
            const ubicacionId = document.getElementById('jugueteUbicacionSelect').value;
            // Obtener URL de foto (del campo oculto o del input manual)
            const jugueteFotoUrlInput = document.getElementById('jugueteFotoUrlInput');
            const fotoUrl = jugueteFotoUrlInput && jugueteFotoUrlInput.value.trim() 
                ? jugueteFotoUrlInput.value.trim() 
                : document.getElementById('jugueteFotoUrl').value.trim();
            // Obtener campos de bultos (opcionales)
            const numeroBultosInput = document.getElementById('jugueteNumeroBultosInput');
            const cantidadPorBultoInput = document.getElementById('jugueteCantidadPorBultoInput');
            const numeroBultos = numeroBultosInput && numeroBultosInput.value.trim() 
                ? parseInt(numeroBultosInput.value) 
                : null;
            const cantidadPorBulto = cantidadPorBultoInput && cantidadPorBultoInput.value.trim() 
                ? parseInt(cantidadPorBultoInput.value) 
                : null;

            if (!nombre || !codigo || isNaN(cantidad) || cantidad < 0 || !ubicacionTipo || !ubicacionId || 
                isNaN(precioMin) || precioMin < 0) {
                showJugueteFormMessage('Por favor, completa todos los campos obligatorios', 'error');
                return;
            }

            try {
                // Todas las filas con este código (en cualquier tienda/bodega). El código se busca sin
                // distinguir mayúsculas; los comodines de ILIKE se escapan para que la coincidencia sea exacta.
                const { data: filasMismoCodigo, error: errorCodigo } = await window.supabaseClient
                    .from('juguetes')
                    .select('id, codigo, nombre, cantidad, tienda_id, bodega_id, item, foto_url, precio_min, precio_por_mayor, numero_bultos, cantidad_por_bulto')
                    .eq('empresa_id', user.empresa_id)
                    .ilike('codigo', codigo.replace(/[\\%_]/g, '\\$&'));
                if (errorCodigo) throw errorCodigo;

                const plan = window.ReglasAltaJuguete.planificar(filasMismoCodigo, {
                    codigo,
                    nombre,
                    cantidad,
                    tipoUbicacion: ubicacionTipo,
                    ubicacionId,
                    empresaId: user.empresa_id,
                    campos: {
                        item,
                        foto_url: fotoUrl || null,
                        precio_min: precioMin,
                        precio_por_mayor: precioPorMayor,
                        numero_bultos: numeroBultos,
                        cantidad_por_bulto: cantidadPorBulto
                    }
                });

                const selectUbicacion = document.getElementById('jugueteUbicacionSelect');
                const nombreUbicacion = selectUbicacion.options[selectUbicacion.selectedIndex]?.textContent || 'la ubicación elegida';

                if (plan.accion === 'error') {
                    showJugueteFormMessage(plan.mensaje, 'error');
                    return;
                }

                if (plan.accion === 'sumar') {
                    // Ya existe en esta ubicación: sumar a su cantidad (con control de concurrencia)
                    const { anterior, nueva } = await window.servicioStock.ajustarCantidad(plan.fila.id, plan.cantidad);
                    if (Object.keys(plan.actualizar).length > 0) {
                        const { error: updateError } = await window.supabaseClient
                            .from('juguetes')
                            .update(plan.actualizar)
                            .eq('id', plan.fila.id);
                        if (updateError) throw updateError;
                    }

                    ultimoJugueteAgregado = {
                        id: plan.fila.id,
                        tipo: 'update',
                        cantidadOriginal: anterior,
                        cantidadAgregada: plan.cantidad
                    };
                    if (window.actualizarEstadoBotonDeshacer) {
                        window.actualizarEstadoBotonDeshacer(true);
                    }
                    showJugueteFormMessage(`"${plan.fila.nombre}" ya estaba en ${nombreUbicacion}: se sumaron ${plan.cantidad} unidades (total en esta ubicación: ${nueva}).`, 'success');
                } else {
                    // No existe en esta ubicación: crear su fila (con los datos compartidos si el código ya existía)
                    const { data: nuevoJuguete, error: jugueteError } = await window.supabaseClient
                        .from('juguetes')
                        .insert(plan.registro)
                        .select('id')
                        .single();
                    if (jugueteError) throw jugueteError;

                    ultimoJugueteAgregado = {
                        id: nuevoJuguete.id,
                        tipo: 'insert'
                    };
                    if (window.actualizarEstadoBotonDeshacer) {
                        window.actualizarEstadoBotonDeshacer(true);
                    }
                    showJugueteFormMessage(plan.existiaEnOtraUbicacion
                        ? `"${plan.registro.nombre}" agregado a ${nombreUbicacion} con ${plan.cantidad} unidades (mismos datos que en las demás ubicaciones).`
                        : 'Juguete agregado correctamente', 'success');
                }

                agregarJugueteForm.reset();
                // reset() no limpia los valores numéricos guardados en data-*: limpiarlos para no reutilizar precios anteriores
                ['juguetePrecioMinInput', 'juguetePrecioPorMayorInput'].forEach(id => {
                    const campo = document.getElementById(id);
                    if (campo) campo.dataset.numericValue = '';
                });
                document.getElementById('jugueteUbicacionContainer').style.display = 'none';
                // Limpiar vista previa de foto
                const fotoPreview = document.getElementById('fotoPreview');
                const jugueteFotoUrl = document.getElementById('jugueteFotoUrl');
                const jugueteFotoUrlInput = document.getElementById('jugueteFotoUrlInput');
                if (fotoPreview) fotoPreview.style.display = 'none';
                if (jugueteFotoUrl) jugueteFotoUrl.value = '';
                if (jugueteFotoUrlInput) jugueteFotoUrlInput.value = '';
            } catch (error) {
                console.error('Error al agregar juguete:', error);
                showJugueteFormMessage('Error al agregar el juguete: ' + error.message, 'error');
            }
        });
    }

    // Función para deshacer el último juguete agregado
    window.deshacerUltimoJuguete = async function() {
        console.log('=== INICIO deshacerUltimoJuguete ===');
        console.log('ultimoJugueteAgregado:', ultimoJugueteAgregado);
        
        const deshacerBtn = document.getElementById('deshacerUltimoJugueteBtn');
        
        // Verificar que el botón existe y está habilitado
        if (!deshacerBtn) {
            console.error('Botón deshacer no encontrado en el DOM');
            alert('Error: No se encontró el botón deshacer. Por favor, recarga la página.');
            return;
        }
        
        if (deshacerBtn.disabled) {
            console.log('Botón deshacer está deshabilitado');
            return;
        }
        
        // Verificar que hay un juguete para deshacer
        if (!ultimoJugueteAgregado) {
            console.log('No hay juguete para deshacer');
            alert('No hay ningún juguete reciente para deshacer');
            if (window.actualizarEstadoBotonDeshacer) {
                window.actualizarEstadoBotonDeshacer(false);
            }
            return;
        }

        // Confirmar acción
        const confirmacion = confirm('¿Estás seguro de que deseas deshacer el último juguete agregado?\n\nEsta acción eliminará el último registro que agregaste.');
        if (!confirmacion) {
            console.log('Usuario canceló la operación');
            return;
        }

        // Deshabilitar el botón inmediatamente para prevenir múltiples clics
        if (window.actualizarEstadoBotonDeshacer) {
            window.actualizarEstadoBotonDeshacer(false);
        }
        
        // Mostrar mensaje de procesamiento
        if (typeof showJugueteFormMessage === 'function') {
            showJugueteFormMessage('Procesando deshacer...', 'success');
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            if (!user || !user.empresa_id) {
                throw new Error('No se pudo obtener la información del usuario');
            }

            let operacionExitosa = false;
            
            if (ultimoJugueteAgregado.tipo === 'insert') {
                // Eliminar el registro completo
                console.log('Eliminando juguete con ID:', ultimoJugueteAgregado.id);
                
                // Verificar que el juguete existe antes de eliminarlo
                const { data: jugueteVerificado, error: verificarError } = await window.supabaseClient
                    .from('juguetes')
                    .select('id, empresa_id')
                    .eq('id', ultimoJugueteAgregado.id)
                    .eq('empresa_id', user.empresa_id)
                    .single();

                if (verificarError) {
                    console.error('Error al verificar juguete:', verificarError);
                    throw new Error('No se pudo verificar el juguete: ' + verificarError.message);
                }

                if (!jugueteVerificado) {
                    throw new Error('El juguete no existe o no pertenece a tu empresa');
                }
                
                const { data: jugueteEliminado, error } = await window.supabaseClient
                    .from('juguetes')
                    .delete()
                    .eq('id', ultimoJugueteAgregado.id)
                    .eq('empresa_id', user.empresa_id)
                    .select();

                if (error) {
                    console.error('Error al eliminar:', error);
                    throw new Error('Error al eliminar el juguete: ' + (error.message || 'Error desconocido') + '. Código: ' + (error.code || 'N/A'));
                }
                
                if (jugueteEliminado && jugueteEliminado.length > 0) {
                    operacionExitosa = true;
                    console.log('Juguete eliminado exitosamente:', jugueteEliminado[0]);
                    if (typeof showJugueteFormMessage === 'function') {
                        showJugueteFormMessage('Juguete eliminado correctamente. Actualizando inventario...', 'success');
                    }
                } else {
                    console.warn('No se encontró el juguete para eliminar');
                    throw new Error('El juguete ya no existe en la base de datos');
                }
            } else if (ultimoJugueteAgregado.tipo === 'update') {
                // Restaurar la cantidad original
                console.log('Restaurando cantidad del juguete con ID:', ultimoJugueteAgregado.id);
                console.log('Cantidad original:', ultimoJugueteAgregado.cantidadOriginal);
                
                // Restar solo las unidades agregadas: si entre medio hubo ventas, no se pierden
                const { nueva } = await window.servicioStock.ajustarCantidad(
                    ultimoJugueteAgregado.id, -Math.abs(ultimoJugueteAgregado.cantidadAgregada || 0));
                operacionExitosa = true;
                if (typeof showJugueteFormMessage === 'function') {
                    showJugueteFormMessage(`Se quitaron las ${ultimoJugueteAgregado.cantidadAgregada} unidades agregadas (cantidad actual: ${nueva}). Actualizando inventario...`, 'success');
                }
            } else {
                throw new Error('Tipo de operación desconocido: ' + ultimoJugueteAgregado.tipo);
            }

            // Limpiar variable después de procesar
            const jugueteDeshecho = ultimoJugueteAgregado;
            ultimoJugueteAgregado = null;

            // Actualizar inventario y totales si la operación fue exitosa
            if (operacionExitosa) {
                console.log('Actualizando inventario y totales...');
                
                try {
                    // Recargar inventario
                    if (typeof loadInventario === 'function') {
                        await loadInventario();
                    }
                    
                    // Recargar dashboard summary
                    if (typeof loadDashboardSummary === 'function') {
                        await loadDashboardSummary();
                    }
                    
                    // Recargar tiendas
                    if (typeof loadTiendas === 'function') {
                        await loadTiendas();
                    }
                    
                    // Recargar bodegas
                    if (typeof loadBodegas === 'function') {
                        await loadBodegas();
                    }
                    
                    console.log('Inventario actualizado correctamente');
                } catch (updateError) {
                    console.error('Error al actualizar vistas:', updateError);
                    // No lanzar error aquí, la operación principal fue exitosa
                }
            }
        } catch (error) {
            console.error('Error completo al deshacer:', error);
            const mensajeError = error.message || 'Error desconocido';
            alert('Error al deshacer: ' + mensajeError + '\n\nPor favor, verifica la consola para más detalles.');
            if (typeof showJugueteFormMessage === 'function') {
                showJugueteFormMessage('Error al deshacer: ' + mensajeError, 'error');
            }
            // Limpiar variable incluso si hay error
            ultimoJugueteAgregado = null;
            // Mantener el botón deshabilitado
        }
        
        console.log('=== FIN deshacerUltimoJuguete ===');
    };

    // Función para toggle de ubicaciones
    window.toggleUbicaciones = function(id) {
        const ubicacionesDiv = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        
        if (ubicacionesDiv && icon) {
            if (ubicacionesDiv.style.display === 'none' || !ubicacionesDiv.style.display) {
                // Cerrar otros desplegables abiertos
                document.querySelectorAll('[id^="ubicaciones-"]').forEach(div => {
                    if (div.id !== id) {
                        div.style.display = 'none';
                        const otherIcon = document.getElementById('icon-' + div.id);
                        if (otherIcon) {
                            otherIcon.classList.remove('fa-chevron-up');
                            otherIcon.classList.add('fa-chevron-down');
                        }
                    }
                });
                
                ubicacionesDiv.style.display = 'block';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                ubicacionesDiv.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }
    };

    // Cerrar desplegables al hacer click fuera
    document.addEventListener('click', function(event) {
        if (!event.target.closest('[onclick*="toggleUbicaciones"]') && 
            !event.target.closest('[id^="ubicaciones-"]') &&
            !event.target.closest('[id^="icon-ubicaciones-"]')) {
            document.querySelectorAll('[id^="ubicaciones-"]').forEach(div => {
                div.style.display = 'none';
                const iconId = 'icon-' + div.id;
                const icon = document.getElementById(iconId);
                if (icon) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            });
        }
    });

    // Configurar botón deshacer - se inicializa más abajo con setTimeout

    function showJugueteFormMessage(message, type) {
        const errorMsg = document.getElementById('jugueteFormErrorMessage');
        const successMsg = document.getElementById('jugueteFormSuccessMessage');
        
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
    // FUNCIONALIDAD DE INVENTARIO
    // ============================================
    
    // Variable global para almacenar todos los juguetes y la página actual
    let todosLosJuguetes = [];
    // Inventario por ubicación: 'general' (consolidado) o la clave de una tienda/bodega ("tienda-7")
    let ubicacionInventario = 'general';
    let productosInventarioVisibles = null; // lista actual (ubicación + búsqueda), usada por la paginación
    let tiendasInventario = [];
    let bodegasInventario = [];
    let aplicarFiltrosInventario = null;
    let paginaActualInventario = 1;
    const productosPorPagina = 10;
    
    // Función para habilitar/deshabilitar el botón deshacer
    window.actualizarEstadoBotonDeshacer = function(habilitado) {
        const deshacerBtn = document.getElementById('deshacerUltimoJugueteBtn');
        if (deshacerBtn) {
            if (habilitado && ultimoJugueteAgregado) {
                // Habilitar botón - color rojo
                deshacerBtn.disabled = false;
                deshacerBtn.style.opacity = '1';
                deshacerBtn.style.cursor = 'pointer';
                deshacerBtn.style.background = '#ef4444';
                deshacerBtn.style.color = 'white';
                deshacerBtn.style.border = 'none';
                console.log('Botón deshacer habilitado');
            } else {
                // Deshabilitar botón - color gris
                deshacerBtn.disabled = true;
                deshacerBtn.style.opacity = '0.5';
                deshacerBtn.style.cursor = 'not-allowed';
                deshacerBtn.style.background = '#94a3b8';
                deshacerBtn.style.color = 'white';
                deshacerBtn.style.border = 'none';
                console.log('Botón deshacer deshabilitado');
            }
        }
    };
    
    // Función para inicializar el botón deshacer
    function inicializarBotonDeshacer() {
        const deshacerBtn = document.getElementById('deshacerUltimoJugueteBtn');
        if (deshacerBtn) {
            console.log('Botón deshacer encontrado, inicializando...');
            
            // Remover listeners anteriores si existen (clonar y reemplazar)
            const nuevoBtn = deshacerBtn.cloneNode(true);
            deshacerBtn.parentNode.replaceChild(nuevoBtn, deshacerBtn);
            
            // Inicializar estado
            if (window.actualizarEstadoBotonDeshacer) {
                window.actualizarEstadoBotonDeshacer(false);
            }
            
            // Agregar event listener
            nuevoBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('=== Click en botón deshacer detectado ===');
                console.log('window.deshacerUltimoJuguete existe?', typeof window.deshacerUltimoJuguete === 'function');
                console.log('ultimoJugueteAgregado:', ultimoJugueteAgregado);
                
                if (typeof window.deshacerUltimoJuguete === 'function') {
                    window.deshacerUltimoJuguete();
                } else {
                    console.error('window.deshacerUltimoJuguete no está definido');
                    alert('Error: La función de deshacer no está disponible. Por favor, recarga la página.');
                }
            });
            
            console.log('Botón deshacer inicializado correctamente');
        } else {
            console.warn('Botón deshacer no encontrado en el DOM');
        }
    }
    
    // Intentar inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarBotonDeshacer);
    } else {
        inicializarBotonDeshacer();
    }
    
    // También intentar después de delays por si el botón se carga dinámicamente
    setTimeout(inicializarBotonDeshacer, 500);
    setTimeout(inicializarBotonDeshacer, 1000);

    // Función para capitalizar la primera letra
    function capitalizarPrimeraLetra(texto) {
        if (!texto || typeof texto !== 'string') return texto;
        return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
    }
    
    async function loadInventario() {
        const tbody = document.getElementById('inventarioTableBody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">Cargando inventario...</td></tr>';
        
        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            
            // Cargar juguetes, tiendas y bodegas en paralelo
            // Ordenar juguetes para que los que tienen ITEM aparezcan primero
            const [juguetesResult, tiendasResult, bodegasResult] = await Promise.all([
                window.supabaseClient
                .from('juguetes')
                .select(`
                    *,
                    bodegas(nombre, direccion),
                        tiendas(nombre, direccion)
                `)
                .eq('empresa_id', user.empresa_id)
                    .order('nombre'),
                window.supabaseClient
                    .from('tiendas')
                    .select('id, nombre')
                    .eq('empresa_id', user.empresa_id)
                    .order('nombre'),
                window.supabaseClient
                    .from('bodegas')
                    .select('id, nombre')
                    .eq('empresa_id', user.empresa_id)
                    .order('nombre')
            ]);

            if (juguetesResult.error) throw juguetesResult.error;
            if (tiendasResult.error) throw tiendasResult.error;
            if (bodegasResult.error) throw bodegasResult.error;

            let juguetes = juguetesResult.data || [];
            // Ordenar juguetes para que los que tienen ITEM aparezcan primero (así se prioriza el ITEM al agrupar)
            juguetes.sort((a, b) => {
                const aTieneItem = a.item && a.item.trim() !== '';
                const bTieneItem = b.item && b.item.trim() !== '';
                if (aTieneItem && !bTieneItem) return -1;
                if (!aTieneItem && bTieneItem) return 1;
                return 0; // Mantener orden original si ambos tienen o no tienen ITEM
            });
            
            const todasLasTiendas = tiendasResult.data || [];
            const todasLasBodegas = bodegasResult.data || [];

            if (juguetes.length === 0 && todasLasTiendas.length === 0 && todasLasBodegas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">No hay juguetes en el inventario</td></tr>';
                document.getElementById('inventarioPagination').innerHTML = '';
                return;
            }

            // Agrupar juguetes por código y nombre
            const juguetesAgrupados = new Map();
            juguetes.forEach(juguete => {
                const key = `${juguete.codigo}-${juguete.nombre}`;
                if (!juguetesAgrupados.has(key)) {
                    juguetesAgrupados.set(key, {
                        id_principal: juguete.id, // Usar el primer registro como referencia para edición
                        codigo: juguete.codigo,
                        nombre: juguete.nombre,
                        item: (juguete.item && juguete.item.trim() !== '') ? juguete.item : null, // Inicializar con el item del primer registro (solo si tiene valor)
                        foto_url: juguete.foto_url,
                        precio_min: juguete.precio_min,
                        precio_por_mayor: juguete.precio_por_mayor,
                        ubicaciones: new Map() // Usar Map para evitar duplicados
                    });
                } else {
                    // Si el juguete agrupado no tiene ITEM pero este registro sí lo tiene, actualizarlo
                    const jugueteAgrupado = juguetesAgrupados.get(key);
                    const itemActual = juguete.item ? juguete.item.trim() : '';
                    const itemAgrupado = jugueteAgrupado.item ? jugueteAgrupado.item.trim() : '';
                    
                    // Si el agrupado no tiene ITEM (o está vacío) pero este registro sí lo tiene, actualizarlo
                    if ((!itemAgrupado || itemAgrupado === '') && itemActual && itemActual !== '') {
                        jugueteAgrupado.item = juguete.item;
                    }
                    // También actualizar foto_url si no existe
                    if (!jugueteAgrupado.foto_url && juguete.foto_url) {
                        jugueteAgrupado.foto_url = juguete.foto_url;
                    }
                    // Actualizar precios de referencia si no están definidos aún
                    if ((jugueteAgrupado.precio_min === null || jugueteAgrupado.precio_min === undefined) && juguete.precio_min !== null && juguete.precio_min !== undefined) {
                        jugueteAgrupado.precio_min = juguete.precio_min;
                    }
                    if ((jugueteAgrupado.precio_por_mayor === null || jugueteAgrupado.precio_por_mayor === undefined) && juguete.precio_por_mayor !== null && juguete.precio_por_mayor !== undefined) {
                        jugueteAgrupado.precio_por_mayor = juguete.precio_por_mayor;
                    }
                }
                
                const ubicacionKey = juguete.bodega_id 
                    ? `bodega-${juguete.bodega_id}`
                    : `tienda-${juguete.tienda_id}`;
                
                const ubicacionNombre = juguete.bodega_id 
                    ? (juguete.bodegas?.nombre || 'N/A')
                    : (juguete.tiendas?.nombre || 'N/A');
                
                // Si ya existe esta ubicación, sumar la cantidad
                if (juguetesAgrupados.get(key).ubicaciones.has(ubicacionKey)) {
                    const ubicacionExistente = juguetesAgrupados.get(key).ubicaciones.get(ubicacionKey);
                    ubicacionExistente.cantidad += juguete.cantidad;
                } else {
                    // Crear nueva ubicación
                    juguetesAgrupados.get(key).ubicaciones.set(ubicacionKey, {
                        tipo: juguete.bodega_id ? 'bodega' : 'tienda',
                        id: juguete.bodega_id || juguete.tienda_id,
                        nombre: ubicacionNombre,
                        cantidad: juguete.cantidad,
                        registro: true // hay una fila real en esta ubicación
                    });
                }
            });
            
            // Convertir Maps de ubicaciones a arrays
            juguetesAgrupados.forEach((juguete, key) => {
                juguete.ubicaciones = Array.from(juguete.ubicaciones.values());
            });

            // Convertir a array y agregar todas las ubicaciones (incluso las que no tienen cantidad)
            todosLosJuguetes = Array.from(juguetesAgrupados.values()).map(j => {
                // Crear mapa de ubicaciones existentes
                const ubicacionesMap = new Map();
                j.ubicaciones.forEach(u => {
                    const key = `${u.tipo}-${u.id}`;
                    ubicacionesMap.set(key, u);
                });

                // Agregar todas las tiendas (con cantidad 0 si no existe)
                todasLasTiendas.forEach(tienda => {
                    const key = `tienda-${tienda.id}`;
                    if (!ubicacionesMap.has(key)) {
                        j.ubicaciones.push({
                            tipo: 'tienda',
                            id: tienda.id,
                            nombre: tienda.nombre,
                            cantidad: 0,
                            registro: false // solo para mostrar: no hay fila en esta ubicación
                        });
        }
                });

                // Agregar todas las bodegas (con cantidad 0 si no existe)
                todasLasBodegas.forEach(bodega => {
                    const key = `bodega-${bodega.id}`;
                    if (!ubicacionesMap.has(key)) {
                        j.ubicaciones.push({
                            tipo: 'bodega',
                            id: bodega.id,
                            nombre: bodega.nombre,
                            cantidad: 0,
                            registro: false // solo para mostrar: no hay fila en esta ubicación
                        });
                    }
                });

                // Ordenar ubicaciones: primero las que tienen cantidad, luego las que no
                j.ubicaciones.sort((a, b) => {
                    if (b.cantidad > 0 && a.cantidad === 0) return 1;
                    if (a.cantidad > 0 && b.cantidad === 0) return -1;
                    return a.nombre.localeCompare(b.nombre);
                });

                j.cantidadTotal = j.ubicaciones.reduce((sum, u) => sum + u.cantidad, 0);
                return j;
    });

            // Selector de ubicación con las tiendas y bodegas actuales
            tiendasInventario = todasLasTiendas;
            bodegasInventario = todasLasBodegas;
            poblarSelectorUbicacionInventario();

            // Resetear a página 1 cuando se carga el inventario
            paginaActualInventario = 1;

            // Configurar búsqueda y mostrar la ubicación elegida (aplica también los filtros escritos)
            configurarBusquedaInventario();
            aplicarFiltrosInventario();
        } catch (error) {
            console.error('Error al cargar inventario:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">Error al cargar el inventario</td></tr>';
            document.getElementById('inventarioPagination').innerHTML = '';
        }
    }

    /** Llena el selector de ubicación (General / tiendas / bodegas) conservando la opción elegida. */
    function poblarSelectorUbicacionInventario() {
        const select = document.getElementById('inventarioUbicacionSelect');
        if (!select) return;
        const R = window.ReglasInventarioUbicacion;
        const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const grupo = (etiqueta, tipo, lista) => lista.length === 0 ? '' :
            `<optgroup label="${etiqueta}">` +
            lista.map(u => `<option value="${R.clave(tipo, u.id)}">${escapar(capitalizarPrimeraLetra(u.nombre))}</option>`).join('') +
            '</optgroup>';
        select.innerHTML = '<option value="general">General (todas las ubicaciones)</option>' +
            grupo('Tiendas', 'tienda', tiendasInventario) +
            grupo('Bodegas', 'bodega', bodegasInventario);
        // Si la ubicación elegida ya no existe, volver a General
        if (!R.describir(ubicacionInventario, tiendasInventario, bodegasInventario)) ubicacionInventario = 'general';
        select.value = ubicacionInventario;

        if (select.dataset.listenerAdded !== 'true') {
            select.addEventListener('change', function() {
                ubicacionInventario = this.value || 'general';
                paginaActualInventario = 1;
                if (aplicarFiltrosInventario) aplicarFiltrosInventario();
            });
            select.dataset.listenerAdded = 'true';
        }
    }

    /** Nombre de la ubicación elegida para mostrar ("Tienda San victoriano") o null si es General. */
    function describirUbicacionInventario() {
        const descripcion = window.ReglasInventarioUbicacion.describir(ubicacionInventario, tiendasInventario, bodegasInventario);
        return descripcion ? descripcion.replace(/^(Tienda|Bodega) (.*)$/, (m, tipo, nombre) => `${tipo} ${capitalizarPrimeraLetra(nombre)}`) : null;
    }

    /** Total, etiqueta y encabezado según la ubicación elegida (antes de la búsqueda por texto). */
    function actualizarResumenInventario(productosUbicacion) {
        const descripcion = describirUbicacionInventario();
        const etiqueta = document.getElementById('totalInventarioEtiqueta');
        const total = document.getElementById('totalJuguetesInventario');
        const columna = document.getElementById('inventarioColumnaCantidad');
        const resumen = document.getElementById('inventarioUbicacionResumen');
        if (etiqueta) etiqueta.textContent = descripcion ? `Total en ${descripcion}:` : 'Total:';
        if (total) total.textContent = window.ReglasInventarioUbicacion.total(productosUbicacion);
        if (columna) columna.textContent = descripcion ? 'Cantidad aquí' : 'Cantidad';
        if (resumen) resumen.textContent = descripcion ? `${productosUbicacion.length} producto(s) registrados en esta ubicación` : '';
    }

    function renderizarPaginaInventario(juguetesFiltrados = null) {
        const tbody = document.getElementById('inventarioTableBody');
        // La paginación vuelve a llamar sin argumentos: se conserva la lista filtrada actual
        if (juguetesFiltrados) productosInventarioVisibles = juguetesFiltrados;
        const productos = productosInventarioVisibles || todosLosJuguetes;
        
        if (!productos || productos.length === 0) {
            const descripcion = describirUbicacionInventario();
            const texto = descripcion ? `No hay juguetes para mostrar en ${descripcion}` : 'No hay juguetes para mostrar';
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">${texto}</td></tr>`;
            document.getElementById('inventarioPagination').innerHTML = '';
            return;
        }

        // Calcular paginación
        const totalPaginas = Math.ceil(productos.length / productosPorPagina);
        const inicio = (paginaActualInventario - 1) * productosPorPagina;
        const fin = inicio + productosPorPagina;
        const productosPagina = productos.slice(inicio, fin);

        // Renderizar productos de la página actual
        tbody.innerHTML = '';
        productosPagina.forEach(juguete => {
            const row = document.createElement('tr');
            const nombreCapitalizado = capitalizarPrimeraLetra(juguete.nombre);
            let foto = '';
            if (juguete.foto_url) {
                const fotoUrlEscapada = juguete.foto_url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const nombreEscapado = nombreCapitalizado.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                foto = `<img src="${juguete.foto_url}" alt="${nombreCapitalizado}" 
                    style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; cursor: pointer; transition: transform 0.2s;"
                    onclick="if(typeof mostrarImagenGrande === 'function') mostrarImagenGrande('${fotoUrlEscapada}', '${nombreEscapado}');"
                    onmouseover="this.style.transform='scale(1.1)'"
                    onmouseout="this.style.transform='scale(1)'"
                    title="Haz clic para ver imagen grande">`;
            } else {
                foto = '<span style="color: #64748b;">Sin foto</span>';
            }
            
            // Construir desplegable de ubicaciones
            const ubicacionesConCantidad = juguete.ubicaciones.filter(u => u.cantidad > 0).length;
            const totalUbicaciones = juguete.ubicaciones.length;
            
            let ubicacionesHTML = '';
            if (juguete.ubicaciones && juguete.ubicaciones.length > 0) {
                const ubicacionesList = juguete.ubicaciones.map(u => {
                    const tipoTexto = u.tipo === 'bodega' ? 'Bodega' : 'Tienda';
                    const nombreUbicacion = capitalizarPrimeraLetra(u.nombre);
                    const cantidadTexto = u.cantidad > 0 ? `<strong style="color: #10b981;">${u.cantidad}</strong>` : `<span style="color: #94a3b8;">0</span>`;
                    const bgColor = u.cantidad > 0 ? (u.tipo === 'bodega' ? '#e0e7ff' : '#fef3c7') : '#f1f5f9';
                    const textColor = u.cantidad > 0 ? (u.tipo === 'bodega' ? '#3b82f6' : '#f59e0b') : '#64748b';
                    
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: ${bgColor}; border-radius: 4px; margin-bottom: 4px;">
                            <span style="color: ${textColor}; font-size: 13px;">
                                <strong>${tipoTexto}:</strong> ${nombreUbicacion}
                            </span>
                            <span style="font-size: 13px;">
                                Cantidad: ${cantidadTexto}
                            </span>
            </div>
                    `;
                }).join('');
                
                ubicacionesHTML = `
                    <div style="position: relative;">
                        <button 
                            type="button"
                            onclick="toggleUbicaciones('ubicaciones-${juguete.codigo}')"
                            style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Ver Ubicaciones (${ubicacionesConCantidad}/${totalUbicaciones})</span>
                            <i class="fas fa-chevron-down" id="icon-ubicaciones-${juguete.codigo}"></i>
                </button>
                        <div 
                            id="ubicaciones-${juguete.codigo}"
                            style="display: none; position: absolute; top: 100%; left: 0; margin-top: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 12px; min-width: 300px; max-width: 400px; z-index: 1000; max-height: 400px; overflow-y: auto;">
                            <div style="font-weight: bold; margin-bottom: 8px; color: #1e293b; font-size: 14px;">Ubicaciones:</div>
                            ${ubicacionesList}
                </div>
            </div>
        `;
            } else {
                ubicacionesHTML = '<span style="color: #94a3b8; font-style: italic;">Sin ubicación</span>';
            }
            
            const accionesHTML = isAdmin
                ? `
                    <button 
                        type="button" 
                        onclick="abrirMenuEditarJuguete(${juguete.id_principal}, event)" 
                        title="Editar información del juguete"
                        style="
                            background: #f1f5f9;
                            border: 1px solid #e2e8f0;
                            border-radius: 999px;
                            padding: 6px 10px;
                            cursor: pointer;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            color: #64748b;
                            transition: background 0.2s, color 0.2s, box-shadow 0.2s;
                        "
                        onmouseover="this.style.background='#e5e7eb'; this.style.color='#111827'; this.style.boxShadow='0 2px 6px rgba(15,23,42,0.12)';"
                        onmouseout="this.style.background='#f1f5f9'; this.style.color='#64748b'; this.style.boxShadow='none';"
                    >
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                `
                : '<span style="color: #94a3b8;">-</span>';

            row.innerHTML = `
                <td>${nombreCapitalizado}</td>
                <td>${juguete.codigo}</td>
                <td>${juguete.item ? `<code style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #92400e;">${juguete.item}</code>` : '<span style="color: #94a3b8;">-</span>'}</td>
                <td>${foto}</td>
                <td>${juguete.cantidadMostrada ?? juguete.cantidadTotal ?? 0}</td>
                <td>${ubicacionesHTML}</td>
                <td style="text-align: center;">${accionesHTML}</td>
            `;
            tbody.appendChild(row);
        });

        // Renderizar controles de paginación
        renderizarPaginacionInventario(totalPaginas, productos.length);
    }

    function renderizarPaginacionInventario(totalPaginas, totalProductos) {
        const paginationContainer = document.getElementById('inventarioPagination');
        
        if (totalPaginas <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginacionHTML = '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">';
        
        // Botón Anterior
        if (paginaActualInventario > 1) {
            paginacionHTML += `
                <button onclick="cambiarPaginaInventario(${paginaActualInventario - 1})" 
                        style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
            `;
        }

        // Pestañas de páginas (mostrar máximo 7 pestañas)
        const maxPestañas = 7;
        let inicioPestañas = Math.max(1, paginaActualInventario - Math.floor(maxPestañas / 2));
        let finPestañas = Math.min(totalPaginas, inicioPestañas + maxPestañas - 1);
        
        if (finPestañas - inicioPestañas < maxPestañas - 1) {
            inicioPestañas = Math.max(1, finPestañas - maxPestañas + 1);
        }

        // Primera página si no está visible
        if (inicioPestañas > 1) {
            paginacionHTML += `
                <button onclick="cambiarPaginaInventario(1)" 
                        style="padding: 8px 12px; background: ${paginaActualInventario === 1 ? '#3b82f6' : 'white'}; 
                               color: ${paginaActualInventario === 1 ? 'white' : '#3b82f6'}; 
                               border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: ${paginaActualInventario === 1 ? 'bold' : 'normal'};">
                    1
                </button>
            `;
            if (inicioPestañas > 2) {
                paginacionHTML += '<span style="color: #64748b; padding: 0 4px;">...</span>';
            }
        }

        // Pestañas visibles
        for (let i = inicioPestañas; i <= finPestañas; i++) {
            paginacionHTML += `
                <button onclick="cambiarPaginaInventario(${i})" 
                        style="padding: 8px 12px; background: ${paginaActualInventario === i ? '#3b82f6' : 'white'}; 
                               color: ${paginaActualInventario === i ? 'white' : '#3b82f6'}; 
                               border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: ${paginaActualInventario === i ? 'bold' : 'normal'};">
                    ${i}
                </button>
            `;
        }

        // Última página si no está visible
        if (finPestañas < totalPaginas) {
            if (finPestañas < totalPaginas - 1) {
                paginacionHTML += '<span style="color: #64748b; padding: 0 4px;">...</span>';
            }
            paginacionHTML += `
                <button onclick="cambiarPaginaInventario(${totalPaginas})" 
                        style="padding: 8px 12px; background: ${paginaActualInventario === totalPaginas ? '#3b82f6' : 'white'}; 
                               color: ${paginaActualInventario === totalPaginas ? 'white' : '#3b82f6'}; 
                               border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: ${paginaActualInventario === totalPaginas ? 'bold' : 'normal'};">
                    ${totalPaginas}
                </button>
            `;
        }

        // Botón Siguiente
        if (paginaActualInventario < totalPaginas) {
            paginacionHTML += `
                <button onclick="cambiarPaginaInventario(${paginaActualInventario + 1})" 
                        style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Siguiente <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        // Información de paginación
        const inicio = (paginaActualInventario - 1) * productosPorPagina + 1;
        const fin = Math.min(paginaActualInventario * productosPorPagina, totalProductos);
        paginacionHTML += `
            <span style="color: #64748b; font-size: 14px; margin-left: 12px;">
                Mostrando ${inicio}-${fin} de ${totalProductos} productos
            </span>
        `;

        paginacionHTML += '</div>';
        paginationContainer.innerHTML = paginacionHTML;
        }

    // Función global para cambiar de página
    window.cambiarPaginaInventario = function(nuevaPagina) {
        paginaActualInventario = nuevaPagina;
        renderizarPaginaInventario();
        // Scroll al inicio de la tabla
        document.getElementById('inventarioView').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    function configurarBusquedaInventario() {
        const searchInput = document.getElementById('inventarioSearch');
        const codigoFilterInput = document.getElementById('inventarioCodigoFilter');
        
        if (!searchInput || !codigoFilterInput) {
            console.error('No se encontraron los campos de búsqueda');
            return;
        }
        
        // Función para aplicar ambos filtros (usa getElementById para obtener valores actuales)
        function aplicarFiltros() {
            const currentSearchInput = document.getElementById('inventarioSearch');
            const currentCodigoFilterInput = document.getElementById('inventarioCodigoFilter');
            
            if (!currentSearchInput || !currentCodigoFilterInput) {
                return;
            }
            
            const searchTerm = currentSearchInput.value.trim();
            const codigoFilter = currentCodigoFilterInput.value.trim();
        
            // Primero la ubicación elegida (General o una tienda/bodega); el total no depende de la búsqueda
            let juguetesFiltrados = window.ReglasInventarioUbicacion.filtrar(todosLosJuguetes, ubicacionInventario);
            actualizarResumenInventario(juguetesFiltrados);
            
            // Aplicar filtro de búsqueda general
            if (searchTerm !== '') {
                const searchTermLower = searchTerm.toLowerCase();
                const searchTermNormal = searchTerm.replace(/\s+/g, '').toLowerCase();
                
                // Detectar si contiene letras (no es solo números)
                const tieneLetras = /[a-záéíóúñü]/i.test(searchTerm);
                // Detectar si es un solo dígito
                const esUnSoloDigito = /^\d$/.test(searchTermNormal);
                
                juguetesFiltrados = juguetesFiltrados.filter(juguete => {
                    const nombre = juguete.nombre?.toLowerCase() || '';
                    const codigo = juguete.codigo?.toLowerCase().replace(/\s+/g, '') || '';
                    const item = juguete.item?.toLowerCase().replace(/\s+/g, '') || '';
                    
                    // Buscar en todas las ubicaciones (nombre de bodega/tienda)
                    const ubicaciones = juguete.ubicaciones || [];
                    
                    if (tieneLetras) {
                        // Búsqueda por texto:
                        // - nombre de juguete
                        // - ubicaciones con cantidad > 0
                        // - ITEM
                        const coincideNombre = nombre.includes(searchTermLower);
                        
                        const coincideUbicacionConStock = ubicaciones.some(u => {
                            const nombreUbicacion = u.nombre?.toLowerCase() || '';
                            const tipoUbicacion = u.tipo?.toLowerCase() || '';
                            // Solo considerar ubicaciones con cantidad > 0
                            if (!u.cantidad || u.cantidad <= 0) return false;
                            const textoUbicacion = `${nombreUbicacion} ${tipoUbicacion}`;
                            return textoUbicacion.includes(searchTermLower);
                        });
                        
                        const coincideItem = item.includes(searchTermLower) || item.includes(searchTermNormal);
                        
                        return coincideNombre || coincideUbicacionConStock || coincideItem;
                    } else {
                        // Si es solo números
                        if (esUnSoloDigito) {
                            // Para un solo dígito, buscar que el código o ITEM:
                            // 1. Comience con ese dígito (ej: "4" encuentra "4", "41", "42", etc.)
                            // 2. Sea exactamente ese dígito
                            // 3. Tenga ese dígito al inicio después de letras (ej: "A4", "ITM-4")
                            const codigoComienzaConDigito = codigo.startsWith(searchTermNormal) || 
                                                             codigo === searchTermNormal ||
                                                             (/^[a-z]*[^a-z0-9]*/.test(codigo) && codigo.replace(/^[a-z]*[^a-z0-9]*/, '').startsWith(searchTermNormal));
                            const itemComienzaConDigito = item.startsWith(searchTermNormal) || 
                                                           item === searchTermNormal ||
                                                           (/^[a-z]*[^a-z0-9]*/.test(item) && item.replace(/^[a-z]*[^a-z0-9]*/, '').startsWith(searchTermNormal));
                            return codigoComienzaConDigito || itemComienzaConDigito;
                        } else {
                            // Si es más de un dígito, buscar en cualquier parte del código e ITEM
                            return codigo.includes(searchTermNormal) || 
                                   item.includes(searchTermNormal);
                        }
                    }
                });
            }
            
            // Aplicar filtro específico por código (búsqueda exacta)
            if (codigoFilter !== '') {
                const codigoFilterNormal = codigoFilter.toLowerCase().replace(/\s+/g, '');
                juguetesFiltrados = juguetesFiltrados.filter(juguete => {
                    const codigo = juguete.codigo?.toLowerCase().replace(/\s+/g, '') || '';
                    return codigo === codigoFilterNormal;
                });
            }

            // Resetear a página 1 cuando se filtra
            paginaActualInventario = 1;
            renderizarPaginaInventario(juguetesFiltrados);
        }
        
        aplicarFiltrosInventario = aplicarFiltros;

        // Remover listeners anteriores si existen (usando una bandera para evitar duplicados)
        if (searchInput.dataset.listenerAdded === 'true') {
            // Ya tiene listeners, remover los anteriores y agregar nuevos
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            const newCodigoFilterInput = codigoFilterInput.cloneNode(true);
            codigoFilterInput.parentNode.replaceChild(newCodigoFilterInput, codigoFilterInput);
            
            // Actualizar referencias
            const updatedSearchInput = document.getElementById('inventarioSearch');
            const updatedCodigoFilterInput = document.getElementById('inventarioCodigoFilter');
            
            // Agregar listeners a los nuevos elementos
            updatedSearchInput.addEventListener('input', aplicarFiltros);
            updatedCodigoFilterInput.addEventListener('input', aplicarFiltros);
            updatedSearchInput.dataset.listenerAdded = 'true';
            updatedCodigoFilterInput.dataset.listenerAdded = 'true';
            return;
        }
        
        // Agregar listeners
        searchInput.addEventListener('input', aplicarFiltros);
        codigoFilterInput.addEventListener('input', aplicarFiltros);
        
        // Marcar que ya se agregaron los listeners
        searchInput.dataset.listenerAdded = 'true';
        codigoFilterInput.dataset.listenerAdded = 'true';
    }

    // ---- Edición de juguete: ubicación cuya cantidad se corrige ----
    // Cada juguete tiene una fila por tienda/bodega. Los precios y datos generales se guardan en
    // todas; la cantidad es el valor NUEVO (absoluto) de la ubicación elegida.
    let estadoEdicionJuguete = { idReferencia: null, filas: [] };

    function nombreUbicacionFila(fila) {
        if (fila.tienda_id) {
            const t = tiendasInventario.find(x => Number(x.id) === Number(fila.tienda_id));
            return `Tienda ${t ? capitalizarPrimeraLetra(t.nombre) : '#' + fila.tienda_id}`;
        }
        if (fila.bodega_id) {
            const b = bodegasInventario.find(x => Number(x.id) === Number(fila.bodega_id));
            return `Bodega ${b ? capitalizarPrimeraLetra(b.nombre) : '#' + fila.bodega_id}`;
        }
        return 'Sin ubicación';
    }

    function aplicarFilaEdicion(fila) {
        const form = document.getElementById('editarJugueteForm');
        const cantidadInput = document.getElementById('editarJugueteCantidad');
        const numeroBultosInput = document.getElementById('editarJugueteNumeroBultos');
        const etiqueta = document.getElementById('editarJugueteCantidadLabel');
        const ayuda = document.getElementById('editarJugueteCantidadAyuda');
        const eliminarBtn = document.getElementById('eliminarJugueteBtn');

        if (fila) {
            const nombre = nombreUbicacionFila(fila);
            document.getElementById('editarJugueteId').value = fila.id;
            form.dataset.ubicacion = nombre;
            cantidadInput.disabled = false;
            cantidadInput.required = true;
            cantidadInput.value = fila.cantidad ?? 0;
            if (numeroBultosInput) {
                numeroBultosInput.disabled = false;
                numeroBultosInput.value = fila.numero_bultos || '';
            }
            if (etiqueta) etiqueta.textContent = `Cantidad en ${nombre}`;
            if (ayuda) ayuda.textContent = `Hoy hay ${fila.cantidad ?? 0}. Escribe la cantidad total que debe quedar en ${nombre} (reemplaza la actual; no se suma ni se resta).`;
            if (eliminarBtn) { eliminarBtn.disabled = false; eliminarBtn.style.opacity = ''; }
        } else {
            document.getElementById('editarJugueteId').value = estadoEdicionJuguete.idReferencia;
            form.dataset.ubicacion = '';
            cantidadInput.value = '';
            cantidadInput.disabled = true;
            cantidadInput.required = false;
            if (numeroBultosInput) {
                numeroBultosInput.value = '';
                numeroBultosInput.disabled = true;
            }
            if (etiqueta) etiqueta.textContent = 'Cantidad (elige primero la ubicación)';
            if (ayuda) ayuda.textContent = 'Para corregir una cantidad elige arriba la tienda o bodega. Si no eliges, solo se guardan los precios y datos generales.';
            if (eliminarBtn) { eliminarBtn.disabled = true; eliminarBtn.style.opacity = '0.5'; }
        }
    }

    async function prepararUbicacionesEdicion(filaBase) {
        const R = window.ReglasEdicionJuguete;
        let filas = [filaBase];
        try {
            const repositorio = new RepositorioJuguetesSupabase(window.supabaseClient);
            const candidatas = await repositorio.buscarFilasPorCodigo(filaBase.codigo, filaBase.empresa_id);
            filas = R.filasDelProducto(candidatas, filaBase);
            if (!filas.some(f => Number(f.id) === Number(filaBase.id))) filas.unshift(filaBase);
        } catch (error) {
            console.warn('No se pudieron cargar las demás ubicaciones del juguete:', error);
        }
        filas = filas.slice().sort((a, b) => nombreUbicacionFila(a).localeCompare(nombreUbicacionFila(b), 'es'));
        estadoEdicionJuguete = { idReferencia: filaBase.id, filas };

        const select = document.getElementById('editarJugueteUbicacion');
        const preseleccion = R.filaPreseleccionada(filas, ubicacionInventario);
        const repetidas = new Map();
        filas.forEach(f => repetidas.set(nombreUbicacionFila(f), (repetidas.get(nombreUbicacionFila(f)) || 0) + 1));
        const opciones = filas.map(f => {
            const nombre = nombreUbicacionFila(f);
            const extra = repetidas.get(nombre) > 1 ? ` (registro #${f.id})` : '';
            return `<option value="${f.id}">${escaparTextoEdicion(nombre + extra)} — ${Number(f.cantidad) || 0} unidades</option>`;
        });
        const vacia = filas.length > 1 || !preseleccion
            ? '<option value="">— Elige la ubicación para corregir su cantidad —</option>'
            : '';
        select.innerHTML = vacia + opciones.join('');
        select.value = preseleccion ? String(preseleccion.id) : '';
        aplicarFilaEdicion(preseleccion);

        if (!select.dataset.listenerAdded) {
            select.addEventListener('change', function() {
                const fila = estadoEdicionJuguete.filas.find(f => String(f.id) === this.value) || null;
                aplicarFilaEdicion(fila);
            });
            select.dataset.listenerAdded = 'true';
        }
    }

    function escaparTextoEdicion(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Función global para abrir menú de editar juguete
    window.abrirMenuEditarJuguete = async function(jugueteId, event) {
        event.stopPropagation();
        
        try {
            // Buscar el juguete en todosLosJuguetes usando id_principal
            const jugueteAgrupado = todosLosJuguetes.find(j => j.id_principal === jugueteId);
            
            // Siempre buscar en la base de datos para obtener datos actualizados y completos
            const { data, error } = await window.supabaseClient
                .from('juguetes')
                .select(`
                    *,
                    bodegas(nombre, direccion),
                    tiendas(nombre, direccion)
                `)
                .eq('id', jugueteId)
                .single();

            if (error || !data) {
                console.error('Error al cargar juguete:', error);
                alert('Error al cargar el juguete');
                return;
            }
            
            // Llenar el formulario con datos de la base de datos
            document.getElementById('editarJugueteNombre').value = data.nombre;
            document.getElementById('editarJugueteCodigo').value = data.codigo;

            // Precios en pesos colombianos ($28.000); al guardar se vuelven número
            const editarPrecioMinInput = document.getElementById('editarJuguetePrecioMin');
            const editarPrecioPorMayorInput = document.getElementById('editarJuguetePrecioPorMayor');
            window.FormatoMoneda.configurarInput(editarPrecioMinInput);
            window.FormatoMoneda.configurarInput(editarPrecioPorMayorInput);
            window.FormatoMoneda.asignar(editarPrecioMinInput, data.precio_min);
            window.FormatoMoneda.asignar(editarPrecioPorMayorInput, data.precio_por_mayor);

            const cantidadPorBultoInput = document.getElementById('editarJugueteCantidadPorBulto');
            if (cantidadPorBultoInput) {
                cantidadPorBultoInput.value = data.cantidad_por_bulto || '';
            }

            // Filas del mismo juguete en cada tienda/bodega: la cantidad se corrige en UNA de ellas
            await prepararUbicacionesEdicion(data);
            
            // Llenar campo ITEM si existe
            const itemInput = document.getElementById('editarJugueteItem');
            if (itemInput) {
                itemInput.value = data.item || '';
            }
            
            const fotoUrlInput = document.getElementById('editarJugueteFotoUrl');
            const fotoPreview = document.getElementById('editarFotoPreview');
            const fotoPreviewImg = document.getElementById('editarFotoPreviewImg');
            if (fotoUrlInput) {
                fotoUrlInput.value = data.foto_url || '';
                // Mostrar vista previa si hay URL
                if (data.foto_url && fotoPreviewImg && fotoPreview) {
                    fotoPreviewImg.src = data.foto_url;
                    fotoPreview.style.display = 'block';
                    fotoPreviewImg.onerror = function() {
                        fotoPreview.style.display = 'none';
                    };
                } else if (fotoPreview) {
                    fotoPreview.style.display = 'none';
                }
            }
            
            // Configurar vista previa de foto en modal de editar
            const editarFotoUrlInput = document.getElementById('editarJugueteFotoUrl');
            const editarFotoPreview = document.getElementById('editarFotoPreview');
            const editarFotoPreviewImg = document.getElementById('editarFotoPreviewImg');
            
            if (editarFotoUrlInput) {
                // Remover listener anterior si existe
                const nuevoListener = function() {
                    const url = editarFotoUrlInput.value.trim();
                    if (url && editarFotoPreviewImg && editarFotoPreview) {
                        editarFotoPreviewImg.src = url;
                        editarFotoPreview.style.display = 'block';
                        editarFotoPreviewImg.onerror = function() {
                            editarFotoPreview.style.display = 'none';
                        };
                    } else if (editarFotoPreview) {
                        editarFotoPreview.style.display = 'none';
                    }
                };
                
                // Remover listeners anteriores
                editarFotoUrlInput.removeEventListener('input', nuevoListener);
                editarFotoUrlInput.addEventListener('input', nuevoListener);
            }
            
            // Mostrar modal
            document.getElementById('editarJugueteModal').style.display = 'flex';
            
            // Ocultar mensajes
            document.getElementById('editarJugueteErrorMessage').style.display = 'none';
            document.getElementById('editarJugueteSuccessMessage').style.display = 'none';
        } catch (error) {
            console.error('Error al abrir modal de edición:', error);
            alert('Error al cargar el juguete');
        }
    };

    // Función para cerrar modal
    window.cerrarModalEditarJuguete = function() {
        document.getElementById('editarJugueteModal').style.display = 'none';
        document.getElementById('editarJugueteForm').reset();
        document.getElementById('editarJugueteErrorMessage').style.display = 'none';
        document.getElementById('editarJugueteSuccessMessage').style.display = 'none';
    };
    
    // Función para eliminar juguete actual
    window.eliminarJugueteActual = async function() {
        if (!document.getElementById('editarJugueteUbicacion')?.value) {
            alert('Elige primero la tienda o bodega cuyo registro quieres eliminar.');
            return;
        }
        const jugueteId = parseInt(document.getElementById('editarJugueteId').value);
        const jugueteNombre = document.getElementById('editarJugueteNombre').value;
        const jugueteCodigo = document.getElementById('editarJugueteCodigo').value;
        
        // Confirmación con detalles del juguete
        const ubicacion = document.getElementById('editarJugueteForm')?.dataset.ubicacion || '';
        const confirmacion = confirm(
            `¿Está seguro de que desea eliminar este juguete?\n\n` +
            `Nombre: ${jugueteNombre}\n` +
            `Código: ${jugueteCodigo}\n` +
            (ubicacion ? `Ubicación: ${ubicacion} (solo se elimina el registro de esta ubicación)\n` : '') +
            `\nEsta acción no se puede deshacer.`
        );
        
        if (!confirmacion) {
            return;
        }
        
        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            const errorMsg = document.getElementById('editarJugueteErrorMessage');
            const successMsg = document.getElementById('editarJugueteSuccessMessage');
            
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
            
            // Eliminar el juguete usando el repositorio
            if (window.RepositorioJuguetesSupabase && window.supabaseClient) {
                const repositorio = new RepositorioJuguetesSupabase(window.supabaseClient);
                await repositorio.eliminar(jugueteId);
                
                successMsg.textContent = 'Juguete eliminado correctamente. Recargando...';
                successMsg.style.display = 'block';
                
                // Recargar inventario
                await loadInventario();
                
                // Cerrar modal después de un breve delay
                setTimeout(() => {
                    cerrarModalEditarJuguete();
                }, 1000);
            } else {
                // Fallback a eliminación directa si el repositorio no está disponible
                console.warn('Repositorio no disponible, usando eliminación directa');
                
                const { error } = await window.supabaseClient
                    .from('juguetes')
                    .delete()
                    .eq('id', jugueteId);
                
                if (error) {
                    throw new Error(error.message);
                }
                
                successMsg.textContent = 'Juguete eliminado correctamente. Recargando...';
                successMsg.style.display = 'block';
                
                await loadInventario();
                
                setTimeout(() => {
                    cerrarModalEditarJuguete();
                }, 1000);
            }
        } catch (error) {
            console.error('Error al eliminar juguete:', error);
            const errorMsg = document.getElementById('editarJugueteErrorMessage');
            errorMsg.textContent = 'Error al eliminar juguete: ' + error.message;
            errorMsg.style.display = 'block';
        }
    };

    // Configurar formulario de edición (ya estamos dentro de DOMContentLoaded del dashboard)
    const editarJugueteForm = document.getElementById('editarJugueteForm');
    if (editarJugueteForm) {
        window.preventFormDoubleSubmit(editarJugueteForm, async function(e) { // Protegido contra doble envío
            e.preventDefault();
            
                const jugueteId = parseInt(document.getElementById('editarJugueteId').value);
                const nombre = capitalizarPrimeraLetra(document.getElementById('editarJugueteNombre').value.trim());
                const codigo = document.getElementById('editarJugueteCodigo').value.trim();
                // Ubicación elegida: su cantidad es el valor NUEVO (no se suma ni se resta)
                const ubicacionSelect = document.getElementById('editarJugueteUbicacion');
                const filaElegida = estadoEdicionJuguete.filas.find(f => String(f.id) === ubicacionSelect.value) || null;
                const nombreUbicacion = filaElegida ? nombreUbicacionFila(filaElegida) : '';
                const precioMin = window.FormatoMoneda.leer(document.getElementById('editarJuguetePrecioMin'));
                const precioPorMayor = window.FormatoMoneda.leer(document.getElementById('editarJuguetePrecioPorMayor'));
                const fotoUrl = document.getElementById('editarJugueteFotoUrl')?.value.trim() || null;
                // Obtener campos de bultos (opcionales)
                const numeroBultosInput = document.getElementById('editarJugueteNumeroBultos');
                const cantidadPorBultoInput = document.getElementById('editarJugueteCantidadPorBulto');
                const numeroBultos = numeroBultosInput && numeroBultosInput.value.trim() 
                    ? parseInt(numeroBultosInput.value) 
                    : null;
                const cantidadPorBulto = cantidadPorBultoInput && cantidadPorBultoInput.value.trim() 
                    ? parseInt(cantidadPorBultoInput.value) 
                    : null;
                
                const errorMsg = document.getElementById('editarJugueteErrorMessage');
                const successMsg = document.getElementById('editarJugueteSuccessMessage');
        
        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';

                let cantidad;
                if (filaElegida) {
                    const validacionCantidad = window.ReglasEdicionJuguete.validarCantidad(document.getElementById('editarJugueteCantidad').value);
                    if (!validacionCantidad.valido) {
                        errorMsg.textContent = validacionCantidad.mensaje;
                        errorMsg.style.display = 'block';
                        return;
                    }
                    cantidad = validacionCantidad.valor;
                }
        
                if (!nombre || !codigo || precioMin === null || precioMin < 0 || (precioPorMayor !== null && precioPorMayor < 0)) {
                    errorMsg.textContent = 'Por favor, completa todos los campos correctamente (nombre, código y precio mínimo son obligatorios)';
                    errorMsg.style.display = 'block';
                    return;
                }

        try {
                    const user = JSON.parse(sessionStorage.getItem('user'));
                    
                    // Datos compartidos (se guardan en todas las ubicaciones del juguete)
                    const updateData = {
                        nombre: nombre,
                        codigo: codigo,
                        precio_min: precioMin,
                        precio_por_mayor: precioPorMayor
                    };
                    // Datos de la ubicación elegida (solo esa fila). Sin ubicación no se tocan cantidades.
                    if (filaElegida) {
                        updateData.cantidad = cantidad;
                        updateData.numero_bultos = (numeroBultos !== null && !isNaN(numeroBultos)) ? numeroBultos : null;
                    }
                    
                    if (fotoUrl !== null) {
                        updateData.foto_url = fotoUrl || null;
                    }
                    
                    // Agregar campo ITEM si existe en el formulario (campo compartido)
                    const itemInput = document.getElementById('editarJugueteItem');
                    if (itemInput) {
                        updateData.item = itemInput.value.trim() || null;
                    }
                    
                    if (cantidadPorBulto !== null && !isNaN(cantidadPorBulto)) {
                        updateData.cantidad_por_bulto = cantidadPorBulto;
                    } else {
                        updateData.cantidad_por_bulto = null;
                    }
                    
                    // Usar el controlador de la arquitectura Clean
                    if (window.controladorInventario) {
                        const resultado = await window.controladorInventario.actualizarJuguete(
                            jugueteId,
                            updateData,
                            user.empresa_id
                        );
                        
                        if (!resultado.exito) {
                            errorMsg.textContent = resultado.mensaje;
                            errorMsg.style.display = 'block';
                            return;
                        }
                        
                        successMsg.textContent = filaElegida
                            ? `Juguete actualizado. ${nombreUbicacion} queda con ${cantidad} unidades. Recargando...`
                            : 'Precios y datos actualizados en todas las ubicaciones. Recargando...';
                        successMsg.style.display = 'block';
                    } else {
                        // Fallback a implementación directa si el controlador no está disponible
                        console.warn('Controlador no disponible, usando implementación legacy');
                        
                        const repositorio = new RepositorioJuguetesSupabase(window.supabaseClient);
                        await repositorio.actualizar(jugueteId, updateData, user.empresa_id);
                        
                        successMsg.textContent = filaElegida
                            ? `Juguete actualizado. ${nombreUbicacion} queda con ${cantidad} unidades. Recargando...`
                            : 'Precios y datos actualizados en todas las ubicaciones. Recargando...';
                        successMsg.style.display = 'block';
                    }
                    
                    // Recargar inventario completo desde la base de datos
                    await loadInventario();
                    
                    // Cerrar modal después de un breve delay para que el usuario vea el mensaje
                    setTimeout(() => {
                        cerrarModalEditarJuguete();
                    }, 500);
            } catch (error) {
                    console.error('Error al actualizar juguete:', error);
                    errorMsg.textContent = 'Error al actualizar el juguete: ' + error.message;
                    errorMsg.style.display = 'block';
            }
        });
    }

    // ============================================
    // FUNCIONALIDAD DE EMPLEADOS
    // ============================================
    
    // Toggle del acordeón "Agregar Empleado"
    const agregarEmpleadoHeader = document.getElementById('agregarEmpleadoHeader');
    const agregarEmpleadoContent = document.getElementById('agregarEmpleadoContent');
    
    agregarEmpleadoHeader.addEventListener('click', function() {
        agregarEmpleadoContent.classList.toggle('active');
        const icon = agregarEmpleadoHeader.querySelector('.accordion-icon');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    });

    // Cargar empleados
    // Variables de paginación para empleados
    let paginaActualEmpleados = 1;
    const itemsPorPaginaEmpleados = 10;
    let todosLosEmpleados = [];
    let bodegasEmpleados = []; // para mostrar el nombre de la bodega de venta de cada empleado

    /** true si la BD ya admite empleados en bodega (migración 2026_10_02_08); false si no o si falla la consulta. */
    async function admiteBodegaEnEmpleados() {
        try {
            return window.servicioUbicaciones ? await window.servicioUbicaciones.admiteBodegaEnEmpleados() : false;
        } catch (error) {
            console.warn('No se pudo comprobar si los empleados admiten bodega:', error);
            return false;
        }
    }

    async function loadEmpleados() {
        const empleadosList = document.getElementById('empleadosList');
        empleadosList.innerHTML = '<p style="text-align: center; color: #64748b;">Cargando empleados...</p>';
        
        try {
            const [{ data: empleados, error }, { data: bodegas }] = await Promise.all([
                window.supabaseClient
                    .from('empleados')
                    .select('*, tiendas(nombre)')
                    .eq('empresa_id', user.empresa_id)
                    .order('nombre'),
                window.supabaseClient.from('bodegas').select('id, nombre').eq('empresa_id', user.empresa_id)
            ]);

            if (error) throw error;

            bodegasEmpleados = bodegas || [];
            todosLosEmpleados = empleados || [];
            paginaActualEmpleados = 1;
            renderizarPaginaEmpleados();
        } catch (error) {
            console.error('Error al cargar empleados:', error);
            empleadosList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar los empleados</p>';
        }
    }

    function renderizarPaginaEmpleados() {
        const empleadosList = document.getElementById('empleadosList');
        
        if (!todosLosEmpleados || todosLosEmpleados.length === 0) {
                empleadosList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay empleados registrados. Agrega un nuevo empleado.</p>';
            document.getElementById('empleadosPagination').innerHTML = '';
                return;
            }

        // Calcular paginación
        const totalPaginas = Math.ceil(todosLosEmpleados.length / itemsPorPaginaEmpleados);
        const inicio = (paginaActualEmpleados - 1) * itemsPorPaginaEmpleados;
        const fin = inicio + itemsPorPaginaEmpleados;
        const empleadosPagina = todosLosEmpleados.slice(inicio, fin);

        // Renderizar empleados de la página actual
            empleadosList.innerHTML = '';
        empleadosPagina.forEach(empleado => {
                const empleadoCard = createEmpleadoCard(empleado);
                empleadosList.appendChild(empleadoCard);
            });

        renderizarPaginacionEmpleados(totalPaginas, todosLosEmpleados.length);
    }

    function renderizarPaginacionEmpleados(totalPaginas, totalEmpleados) {
        const paginationContainer = document.getElementById('empleadosPagination');
        if (!paginationContainer) return;
        
        if (totalPaginas <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginacionHTML = '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">';
        
        // Botón Anterior
        if (paginaActualEmpleados > 1) {
            paginacionHTML += `
                <button onclick="cambiarPaginaEmpleados(${paginaActualEmpleados - 1})" 
                        style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
            `;
        }

        // Pestañas de páginas (mostrar máximo 7 pestañas)
        const maxPestañas = 7;
        let inicioPestañas = Math.max(1, paginaActualEmpleados - Math.floor(maxPestañas / 2));
        let finPestañas = Math.min(totalPaginas, inicioPestañas + maxPestañas - 1);
        
        if (finPestañas - inicioPestañas < maxPestañas - 1) {
            inicioPestañas = Math.max(1, finPestañas - maxPestañas + 1);
        }

        // Primera página si no está visible
        if (inicioPestañas > 1) {
            paginacionHTML += `
                <button onclick="cambiarPaginaEmpleados(1)" 
                        style="padding: 8px 12px; background: ${paginaActualEmpleados === 1 ? '#3b82f6' : 'white'}; color: ${paginaActualEmpleados === 1 ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
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
                <button onclick="cambiarPaginaEmpleados(${i})" 
                        style="padding: 8px 12px; background: ${paginaActualEmpleados === i ? '#3b82f6' : 'white'}; color: ${paginaActualEmpleados === i ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
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
                <button onclick="cambiarPaginaEmpleados(${totalPaginas})" 
                        style="padding: 8px 12px; background: ${paginaActualEmpleados === totalPaginas ? '#3b82f6' : 'white'}; color: ${paginaActualEmpleados === totalPaginas ? 'white' : '#3b82f6'}; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    ${totalPaginas}
                </button>
            `;
        }

        // Botón Siguiente
        if (paginaActualEmpleados < totalPaginas) {
            paginacionHTML += `
                <button onclick="cambiarPaginaEmpleados(${paginaActualEmpleados + 1})" 
                        style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Siguiente <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginacionHTML += '</div>';
        paginationContainer.innerHTML = paginacionHTML;
    }

    window.cambiarPaginaEmpleados = function(nuevaPagina) {
        paginaActualEmpleados = nuevaPagina;
        renderizarPaginaEmpleados();
    };
    
    // Cargar ubicaciones de venta (tiendas y, si la BD lo admite, bodegas) para el select de empleados.
    // Valores: "tienda-3" / "bodega-1" ('' = sin ubicación)
    async function loadTiendasForSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">Sin ubicación asignada</option>';
        
        try {
            const admiteBodega = await admiteBodegaEnEmpleados();
            const [{ data: tiendas, error }, bodegasRes] = await Promise.all([
                window.supabaseClient
                    .from('tiendas')
                    .select('id, nombre')
                    .eq('empresa_id', user.empresa_id)
                    .order('nombre'),
                admiteBodega
                    ? window.supabaseClient.from('bodegas').select('id, nombre').eq('empresa_id', user.empresa_id).order('nombre')
                    : Promise.resolve({ data: [] })
            ]);

            if (error) throw error;
            if (bodegasRes.error) throw bodegasRes.error;

            const agregarGrupo = (etiqueta, tipo, lista) => {
                if (!lista || lista.length === 0) return;
                const grupo = document.createElement('optgroup');
                grupo.label = etiqueta;
                lista.forEach(u => {
                    const option = document.createElement('option');
                    option.value = `${tipo}-${u.id}`;
                    option.textContent = u.nombre;
                    grupo.appendChild(option);
                });
                select.appendChild(grupo);
            };
            agregarGrupo('Tiendas', 'tienda', tiendas);
            agregarGrupo('Bodegas', 'bodega', bodegasRes.data);
            
            if (currentValue) {
                select.value = currentValue;
            }
        } catch (error) {
            console.error('Error al cargar ubicaciones:', error);
        }
    }

    window.cargarUbicacionesVentaEmpleado = loadTiendasForSelect;

    // Crear tarjeta de empleado
    function createEmpleadoCard(empleado) {
        const card = document.createElement('div');
        card.className = 'bodega-card';
        const ubicacionVenta = ReglasUbicacionEmpleado.describir(empleado, [], bodegasEmpleados);
        card.innerHTML = `
            <div class="bodega-info">
                <h3>${capitalizarPrimeraLetra(empleado.nombre)}</h3>
                <p><i class="fas fa-phone"></i> ${empleado.telefono}</p>
                <p><i class="fas fa-id-card"></i> Documento: ${empleado.documento || 'N/A'}</p>
                <p><i class="fas fa-barcode"></i> Código: ${empleado.codigo}</p>
                <p><i class="fas ${empleado.bodega_id ? 'fa-warehouse' : 'fa-store'}"></i> Vende en: ${ubicacionVenta}</p>
            </div>
            <div class="bodega-actions">
                <button class="menu-toggle" data-empleado-id="${empleado.id}">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="dropdown-menu" id="menu-emp-${empleado.id}" style="display: none;">
                    <button class="dropdown-item" data-action="edit" data-empleado-id="${empleado.id}">
                        <i class="fas fa-edit"></i> Actualizar
                    </button>
                    <button class="dropdown-item danger" data-action="delete" data-empleado-id="${empleado.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
        return card;
    }

    // Manejar clicks en el menú de empleados
    document.addEventListener('click', function(e) {
        if (e.target.closest('.menu-toggle[data-empleado-id]')) {
            const menuToggle = e.target.closest('.menu-toggle');
            const empleadoId = menuToggle.getAttribute('data-empleado-id');
            const menu = document.getElementById(`menu-emp-${empleadoId}`);
            
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m.id !== `menu-emp-${empleadoId}`) {
                    m.style.display = 'none';
                }
            });
            
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
        
        if (e.target.closest('.dropdown-item[data-empleado-id]')) {
            const item = e.target.closest('.dropdown-item');
            const action = item.getAttribute('data-action');
            const empleadoId = item.getAttribute('data-empleado-id');
            
            // Validar que empleadoId existe
            if (!empleadoId) {
                console.warn('No se encontró empleadoId en el elemento');
                return;
            }
            
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                m.style.display = 'none';
            });
            
            if (action === 'edit') {
                openEditEmpleadoModal(empleadoId);
            } else if (action === 'delete') {
                deleteEmpleado(empleadoId);
            }
        }
    });

    // Formulario para agregar empleado
    const nuevoEmpleadoForm = document.getElementById('nuevoEmpleadoForm');
    if (nuevoEmpleadoForm) {
        window.preventFormDoubleSubmit(nuevoEmpleadoForm, async function(e) { // Protegido contra doble envío
            e.preventDefault();
            
            const nombre = capitalizarPrimeraLetra(document.getElementById('empleadoNombre').value.trim());
            const telefono = document.getElementById('empleadoTelefono').value.trim();
            const documento = document.getElementById('empleadoDocumento').value.trim();
            const codigo = document.getElementById('empleadoCodigo').value.trim();
            const claveUbicacion = document.getElementById('empleadoTienda').value;
            
            if (!nombre || !telefono || !documento || !codigo) {
                showEmpleadoMessage('Por favor, completa todos los campos obligatorios', 'error');
                return;
            }

            const ubicacion = ReglasUbicacionEmpleado.camposParaGuardar(claveUbicacion, await admiteBodegaEnEmpleados());
            if (ubicacion.error) {
                showEmpleadoMessage(ubicacion.error, 'error');
                return;
            }

            try {
                // El código del empleado identifica al vendedor en las ventas: debe ser único
                const { data: codigoExistente, error: errorCodigo } = await window.supabaseClient
                    .from('empleados')
                    .select('id, nombre')
                    .eq('codigo', codigo)
                    .eq('empresa_id', user.empresa_id)
                    .limit(1);
                if (errorCodigo) throw errorCodigo;
                if (codigoExistente && codigoExistente.length > 0) {
                    showEmpleadoMessage(`El código "${codigo}" ya está asignado a ${codigoExistente[0].nombre}. Usa un código diferente.`, 'error');
                    return;
                }

                const empleadoData = {
                    nombre: nombre,
                    telefono: telefono,
                    documento: documento,
                    codigo: codigo,
                    empresa_id: user.empresa_id,
                    ...ubicacion.campos // tienda_id o bodega_id (ubicación de venta)
                };

                const { error } = await window.supabaseClient
                    .from('empleados')
                    .insert(empleadoData);

                if (error) throw error;

                showEmpleadoMessage('Empleado agregado correctamente', 'success');
                nuevoEmpleadoForm.reset();
                loadEmpleados();
            } catch (error) {
                console.error('Error al agregar empleado:', error);
                showEmpleadoMessage('Error al agregar el empleado: ' + error.message, 'error');
            }
        });
        
        // Cargar tiendas cuando se abre el formulario
        const agregarEmpleadoHeader = document.getElementById('agregarEmpleadoHeader');
        if (agregarEmpleadoHeader) {
            agregarEmpleadoHeader.addEventListener('click', function() {
                setTimeout(() => loadTiendasForSelect('empleadoTienda'), 100);
            });
        }
    }

    function showEmpleadoMessage(message, type) {
        const errorMsg = document.getElementById('empleadoErrorMessage');
        const successMsg = document.getElementById('empleadoSuccessMessage');
        
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

    // Abrir modal para editar empleado
    async function openEditEmpleadoModal(empleadoId) {
        // Validar que empleadoId existe y es válido
        if (!empleadoId || empleadoId === 'null' || empleadoId === 'undefined') {
            console.error('Error: empleadoId inválido:', empleadoId);
            alert('Error: No se pudo identificar el empleado a editar');
            return;
        }
        
        try {
            const empleadoIdNum = parseInt(empleadoId, 10);
            if (isNaN(empleadoIdNum)) {
                throw new Error('ID de empleado inválido');
            }
            
            const { data: empleado, error } = await window.supabaseClient
                .from('empleados')
                .select('*')
                .eq('id', empleadoIdNum)
                .single();

            if (error) throw error;

            document.getElementById('editEmpleadoNombre').value = empleado.nombre;
            document.getElementById('editEmpleadoTelefono').value = empleado.telefono;
            document.getElementById('editEmpleadoDocumento').value = empleado.documento || '';
            document.getElementById('editEmpleadoCodigo').value = empleado.codigo;
            currentEmpleadoId = empleadoId;
            
            // Cargar ubicaciones y seleccionar la actual (tienda o bodega)
            await loadTiendasForSelect('editEmpleadoTienda');
            const selectUbicacion = document.getElementById('editEmpleadoTienda');
            if (selectUbicacion) {
                selectUbicacion.value = ReglasUbicacionEmpleado.claveDeEmpleado(empleado);
            }
            
            const modal = document.getElementById('editEmpleadoModal');
            modal.style.display = 'flex';
        } catch (error) {
            console.error('Error al cargar empleado:', error);
            alert('Error al cargar los datos del empleado');
        }
    }

    // Formulario para editar empleado
    const editEmpleadoForm = document.getElementById('editEmpleadoForm');
    if (editEmpleadoForm) {
        window.preventFormDoubleSubmit(editEmpleadoForm, async function(e) { // Protegido contra doble envío
            e.preventDefault();
            
            const nombre = capitalizarPrimeraLetra(document.getElementById('editEmpleadoNombre').value.trim());
            const telefono = document.getElementById('editEmpleadoTelefono').value.trim();
            const documento = document.getElementById('editEmpleadoDocumento').value.trim();
            const codigo = document.getElementById('editEmpleadoCodigo').value.trim();
            const claveUbicacion = document.getElementById('editEmpleadoTienda').value;
            
            if (!nombre || !telefono || !documento || !codigo) {
                showEditEmpleadoMessage('Por favor, completa todos los campos obligatorios', 'error');
                return;
            }

            const ubicacion = ReglasUbicacionEmpleado.camposParaGuardar(claveUbicacion, await admiteBodegaEnEmpleados());
            if (ubicacion.error) {
                showEditEmpleadoMessage(ubicacion.error, 'error');
                return;
            }

            try {
                // Validar que el código no esté asignado a otro empleado
                const { data: codigoExistente, error: errorCodigo } = await window.supabaseClient
                    .from('empleados')
                    .select('id, nombre')
                    .eq('codigo', codigo)
                    .eq('empresa_id', user.empresa_id)
                    .neq('id', currentEmpleadoId)
                    .limit(1);
                if (errorCodigo) throw errorCodigo;
                if (codigoExistente && codigoExistente.length > 0) {
                    showEditEmpleadoMessage(`El código "${codigo}" ya está asignado a ${codigoExistente[0].nombre}. Usa un código diferente.`, 'error');
                    return;
                }

                const updateData = {
                    nombre: nombre,
                    telefono: telefono,
                    documento: documento,
                    codigo: codigo,
                    ...ubicacion.campos // tienda_id / bodega_id (la otra queda en null)
                };

                const { error } = await window.supabaseClient
                    .from('empleados')
                    .update(updateData)
                    .eq('id', currentEmpleadoId);

                if (error) throw error;

                showEditEmpleadoMessage('Empleado actualizado correctamente', 'success');
                setTimeout(() => {
                    closeEditEmpleadoModal();
                    loadEmpleados();
                }, 1500);
            } catch (error) {
                console.error('Error al actualizar empleado:', error);
                showEditEmpleadoMessage('Error al actualizar el empleado: ' + error.message, 'error');
            }
        });
    }

    function showEditEmpleadoMessage(message, type) {
        const errorMsg = document.getElementById('editEmpleadoErrorMessage');
        const successMsg = document.getElementById('editEmpleadoSuccessMessage');
        
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

    function closeEditEmpleadoModal() {
        const modal = document.getElementById('editEmpleadoModal');
        modal.style.display = 'none';
        editEmpleadoForm.reset();
        document.getElementById('editEmpleadoErrorMessage').style.display = 'none';
        document.getElementById('editEmpleadoSuccessMessage').style.display = 'none';
        currentEmpleadoId = null;
    }

    document.getElementById('closeEditEmpleadoModal').addEventListener('click', closeEditEmpleadoModal);
    document.getElementById('cancelEditEmpleadoBtn').addEventListener('click', closeEditEmpleadoModal);
    document.getElementById('editEmpleadoModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditEmpleadoModal();
        }
    });

    // Eliminar empleado
    async function deleteEmpleado(empleadoId) {
        // Validar que empleadoId existe y es válido
        if (!empleadoId || empleadoId === 'null' || empleadoId === 'undefined') {
            console.error('Error: empleadoId inválido:', empleadoId);
            alert('Error: No se pudo identificar el empleado a eliminar');
            return;
        }
        
        if (!confirm('¿Estás seguro de que deseas eliminar este empleado? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const empleadoIdNum = parseInt(empleadoId, 10);
            if (isNaN(empleadoIdNum)) {
                throw new Error('ID de empleado inválido');
            }
            
            const { error } = await window.supabaseClient
                .from('empleados')
                .delete()
                .eq('id', empleadoIdNum);

            if (error) throw error;

            alert('Empleado eliminado correctamente');
            loadEmpleados();
        } catch (error) {
            console.error('Error al eliminar empleado:', error);
            alert('Error al eliminar el empleado: ' + error.message);
        }
    }

    // Cargar resumen del dashboard al inicio
    if (typeof loadDashboardSummary === 'function') {
        loadDashboardSummary();
    }
    
    // Actualizar badge de planes pendientes
    if (typeof actualizarBadgePlanesPendientes === 'function') {
        actualizarBadgePlanesPendientes();
    }

    // Hacer las cards del dashboard clicables
    const cardTiendas = document.getElementById('cardTiendas');
    const cardBodegas = document.getElementById('cardBodegas');
    const cardUsuarios = document.getElementById('cardUsuarios');
    const cardGanancias = document.getElementById('cardGanancias');

    if (cardGanancias) {
        cardGanancias.addEventListener('click', function() {
            // Simular click en el botón de ventas del sidebar
            const ventasBtn = document.querySelector('.sidebar-btn[data-page="ventas"]');
            if (ventasBtn) {
                ventasBtn.click();
            }
        });
    }

    if (cardTiendas) {
        cardTiendas.addEventListener('click', function() {
            // Simular click en el botón de tiendas del sidebar
            const tiendasBtn = document.querySelector('.sidebar-btn[data-page="tiendas"]');
            if (tiendasBtn) {
                tiendasBtn.click();
            }
        });
    }

    if (cardBodegas) {
        cardBodegas.addEventListener('click', function() {
            // Simular click en el botón de bodegas del sidebar
            const bodegasBtn = document.querySelector('.sidebar-btn[data-page="bodegas"]');
            if (bodegasBtn) {
                bodegasBtn.click();
            }
        });
    }

    if (cardUsuarios) {
        cardUsuarios.addEventListener('click', function() {
            // Simular click en el botón de usuarios del sidebar
            const usuariosBtn = document.querySelector('.sidebar-btn[data-page="usuarios"]');
            if (usuariosBtn) {
                usuariosBtn.click();
            }
        });
    }

    console.log('✅ Dashboard cargado correctamente');
});

