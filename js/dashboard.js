// Dashboard functionality

document.addEventListener('DOMContentLoaded', async function() {
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
    
    // Ocultar botones del sidebar para empleados
    if (isEmpleado) {
        const sidebarButtons = document.querySelectorAll('.sidebar-btn');
        sidebarButtons.forEach(btn => {
            const page = btn.getAttribute('data-page');
            if (page !== 'venta' && page !== 'facturar') {
                btn.style.display = 'none';
            }
        });
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
            const { data, error } = await window.supabaseClient
                .from('usuarios')
                .select('*')
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

        const currentPassword = document.getElementById('currentPassword').value;
        const newNombre = document.getElementById('editNombre').value.trim();
        const newEmail = document.getElementById('editEmail').value.trim();
        const newPassword = document.getElementById('editPassword').value;

        // Validar contraseña actual (siempre requerida)
        if (!currentPassword) {
            showProfileMessage('Debes ingresar tu contraseña actual para realizar cambios', 'error');
            return;
        }

        // Verificar que la contraseña actual sea correcta
        const passwordAlmacenada = currentUserData.password || currentUserData.contraseña;
        if (passwordAlmacenada !== currentPassword) {
            showProfileMessage('La contraseña actual es incorrecta', 'error');
            return;
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

        // Verificar que el nuevo nombre de usuario no esté en uso por otro usuario en la misma empresa
        if (nombreCambio) {
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
        const saveBtn = document.getElementById('saveProfileBtn');
        const saveBtnText = document.getElementById('saveBtnText');
        const saveLoadingSpinner = document.getElementById('saveLoadingSpinner');
        
        saveBtn.disabled = true;
        saveBtnText.textContent = 'Guardando...';
        saveLoadingSpinner.style.display = 'inline-block';

        try {
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
                .select('*')
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
            } else if (error.message && error.message.includes('permission denied') || error.message.includes('RLS')) {
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
    logoutBtn.addEventListener('click', function() {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
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
    const analisisView = document.getElementById('analisisView');
    const ajustesView = document.getElementById('ajustesView');
    
    let currentBodegaId = null;
    let currentEmpleadoId = null;
    let currentTiendaId = null;
    let currentUsuarioId = null;
    let ventaItems = []; // Array para almacenar items de la venta actual

    function showView(viewName) {
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
        analisisView.style.display = 'none';
        ajustesView.style.display = 'none';
        
        // Verificar permisos para empleados
        if (isEmpleado && viewName !== 'venta' && viewName !== 'facturar') {
            alert('No tienes permisos para acceder a esta sección');
            return;
        }
        
        // Mostrar la vista seleccionada
        switch(viewName) {
            case 'venta':
                ventaView.style.display = 'block';
                // initRegistrarVenta ya se inicializa al cargar la página
                if (typeof updateVentaItemsList === 'function') {
                    updateVentaItemsList();
                }
                break;
            case 'facturar':
                // Esta vista se abre desde el botón facturar
                break;
            case 'juguetes':
                if (isAdmin) {
                    juguetesView.style.display = 'block';
                    loadUbicacionesForSelect();
                }
                break;
            case 'inventario':
                if (isAdmin) {
                    inventarioView.style.display = 'block';
                    loadInventario();
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
                    if (typeof loadTiendas === 'function') {
                        loadTiendas();
                    }
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
            case 'abastecer':
                if (isAdmin) {
                    abastecerView.style.display = 'block';
                    if (typeof initAbastecer === 'function') {
                        initAbastecer();
                    }
                }
                break;
            case 'analisis':
                if (isAdmin) {
                    analisisView.style.display = 'block';
                    if (typeof loadAnalisis === 'function') {
                        loadAnalisis();
                    }
                }
                break;
            case 'ajustes':
                if (isAdmin) {
                    ajustesView.style.display = 'block';
                    if (typeof initAjustes === 'function') {
                        initAjustes();
                    }
                }
                break;
            default:
                defaultView.style.display = 'block';
                if (isAdmin) {
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

            if (!bodegas || bodegas.length === 0) {
                bodegasList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay bodegas registradas. Agrega una nueva bodega.</p>';
                return;
            }

            bodegasList.innerHTML = '';
            bodegas.forEach(bodega => {
                const bodegaCard = createBodegaCard(bodega);
                bodegasList.appendChild(bodegaCard);
            });
        } catch (error) {
            console.error('Error al cargar bodegas:', error);
            bodegasList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar las bodegas. Por favor, recarga la página.</p>';
        }
    }

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
    nuevaBodegaForm.addEventListener('submit', async function(e) {
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
            loadBodegas();
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
        
        setTimeout(() => {
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
        }, 5000);
    }

    // Abrir modal para editar bodega
    async function openEditBodegaModal(bodegaId) {
        try {
            const { data: bodega, error } = await window.supabaseClient
                .from('bodegas')
                .select('*')
                .eq('id', bodegaId)
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
    editBodegaForm.addEventListener('submit', async function(e) {
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
        if (!confirm('¿Estás seguro de que deseas eliminar esta bodega? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('bodegas')
                .delete()
                .eq('id', bodegaId);

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
        agregarJuguetesForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nombre = capitalizarPrimeraLetra(document.getElementById('jugueteNombre')?.value.trim());
            const codigo = document.getElementById('jugueteCodigo')?.value.trim();
            const cantidad = parseInt(document.getElementById('jugueteCantidad')?.value || 0);

            if (!nombre || !codigo || isNaN(cantidad) || cantidad < 0) {
                showJugueteMessage('Por favor, completa todos los campos correctamente', 'error');
                return;
            }

            try {
                // Primero verificar si existe un juguete con el mismo código pero diferente nombre
                const { data: jugueteConMismoCodigo } = await window.supabaseClient
                    .from('juguetes')
                    .select('nombre')
                    .eq('codigo', codigo)
                    .eq('empresa_id', user.empresa_id)
                    .neq('nombre', nombre)
                    .limit(1);
                
                if (jugueteConMismoCodigo && jugueteConMismoCodigo.length > 0) {
                    showJugueteMessage(`Error: El código "${codigo}" ya está asignado a otro juguete con nombre diferente. El código debe ser único por tipo de juguete.`, 'error');
                    return;
                }
                
                // Verificar si ya existe un juguete con el mismo código Y nombre en la misma bodega
                const { data: jugueteExistenteData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', codigo)
                    .eq('nombre', nombre)
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

    // Formulario para agregar juguete
    const agregarJugueteForm = document.getElementById('agregarJugueteForm');
    if (agregarJugueteForm) {
        agregarJugueteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nombre = capitalizarPrimeraLetra(document.getElementById('jugueteNombreInput').value.trim());
            const codigo = document.getElementById('jugueteCodigoInput').value.trim();
            const cantidad = parseInt(document.getElementById('jugueteCantidadInput').value);
            const ubicacionTipo = document.getElementById('jugueteUbicacionTipo').value;
            const ubicacionId = document.getElementById('jugueteUbicacionSelect').value;
            const fotoUrl = document.getElementById('jugueteFotoInput').value.trim();

            if (!nombre || !codigo || isNaN(cantidad) || cantidad < 0 || !ubicacionTipo || !ubicacionId) {
                showJugueteFormMessage('Por favor, completa todos los campos obligatorios', 'error');
                return;
            }

            try {
                const campoUbicacion = ubicacionTipo === 'bodega' ? 'bodega_id' : 'tienda_id';
                
                // Primero verificar si existe un juguete con el mismo código pero diferente nombre
                const { data: jugueteConMismoCodigo } = await window.supabaseClient
                    .from('juguetes')
                    .select('nombre')
                    .eq('codigo', codigo)
                    .eq('empresa_id', user.empresa_id)
                    .neq('nombre', nombre)
                    .limit(1);
                
                if (jugueteConMismoCodigo && jugueteConMismoCodigo.length > 0) {
                    showJugueteFormMessage(`Error: El código "${codigo}" ya está asignado a otro juguete con nombre diferente. El código debe ser único por tipo de juguete.`, 'error');
                    return;
                }
                
                // Verificar si ya existe un juguete con el mismo código Y nombre en la misma ubicación
                const { data: jugueteExistenteData } = await window.supabaseClient
                    .from('juguetes')
                    .select('*')
                    .eq('codigo', codigo)
                    .eq('nombre', nombre)
                    .eq('empresa_id', user.empresa_id)
                    .eq(campoUbicacion, ubicacionId)
                    .limit(1);

                if (jugueteExistenteData && jugueteExistenteData.length > 0) {
                    // Si existe, sumar la cantidad al registro existente
                    const jugueteExistente = jugueteExistenteData[0];
                    const nuevaCantidad = jugueteExistente.cantidad + cantidad;
                    
                    const updateData = { cantidad: nuevaCantidad };
                    
                    // Actualizar foto_url si se proporciona una nueva
                    if (fotoUrl) {
                        updateData.foto_url = fotoUrl;
                    }
                    
                    const { error: updateError } = await window.supabaseClient
                        .from('juguetes')
                        .update(updateData)
                        .eq('id', jugueteExistente.id);

                    if (updateError) throw updateError;
                    
                    showJugueteFormMessage(`Juguete actualizado: se agregaron ${cantidad} unidades (Total: ${nuevaCantidad})`, 'success');
                } else {
                    // Si no existe, crear un nuevo registro
                    const jugueteData = {
                        nombre: nombre,
                        codigo: codigo,
                        cantidad: cantidad,
                        empresa_id: user.empresa_id
                    };

                    if (fotoUrl) {
                        jugueteData.foto_url = fotoUrl;
                    }

                    if (ubicacionTipo === 'bodega') {
                        jugueteData.bodega_id = ubicacionId;
                    } else if (ubicacionTipo === 'tienda') {
                        jugueteData.tienda_id = ubicacionId;
                    }

                    const { error: jugueteError } = await window.supabaseClient
                        .from('juguetes')
                        .insert(jugueteData);

                    if (jugueteError) throw jugueteError;
                    
                    showJugueteFormMessage('Juguete agregado correctamente', 'success');
                }

                agregarJugueteForm.reset();
                document.getElementById('jugueteUbicacionContainer').style.display = 'none';
            } catch (error) {
                console.error('Error al agregar juguete:', error);
                showJugueteFormMessage('Error al agregar el juguete: ' + error.message, 'error');
            }
        });
    }

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
        
        setTimeout(() => {
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
        }, 5000);
    }

    // ============================================
    // FUNCIONALIDAD DE INVENTARIO
    // ============================================
    
    // Variable global para almacenar todos los juguetes y la página actual
    let todosLosJuguetes = [];
    let paginaActualInventario = 1;
    const productosPorPagina = 10;

    // Función para capitalizar la primera letra
    function capitalizarPrimeraLetra(texto) {
        if (!texto || typeof texto !== 'string') return texto;
        return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
    }

    async function loadInventario() {
        const tbody = document.getElementById('inventarioTableBody');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">Cargando inventario...</td></tr>';
        
        try {
            const { data: juguetes, error } = await window.supabaseClient
                .from('juguetes')
                .select(`
                    *,
                    bodegas(nombre, direccion),
                    tiendas(nombre, direccion)
                `)
                .eq('empresa_id', user.empresa_id)
                .order('nombre');

            if (error) throw error;

            if (!juguetes || juguetes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">No hay juguetes en el inventario</td></tr>';
                document.getElementById('inventarioPagination').innerHTML = '';
                return;
            }

            // Filtrar juguetes únicos por código (evitar duplicados)
            const juguetesUnicos = new Map();
            juguetes.forEach(juguete => {
                const key = juguete.codigo;
                if (!juguetesUnicos.has(key) || juguetesUnicos.get(key).cantidad < juguete.cantidad) {
                    juguetesUnicos.set(key, juguete);
                }
            });

            todosLosJuguetes = Array.from(juguetesUnicos.values());
            
            // Calcular totales
            const totalJuguetes = todosLosJuguetes.reduce((sum, j) => sum + j.cantidad, 0);
            
            // Actualizar resumen
            document.getElementById('totalJuguetesInventario').textContent = totalJuguetes;

            // Resetear a página 1 cuando se carga el inventario
            paginaActualInventario = 1;
            
            // Renderizar la primera página
            renderizarPaginaInventario();

            // Configurar búsqueda
            configurarBusquedaInventario();
        } catch (error) {
            console.error('Error al cargar inventario:', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">Error al cargar el inventario</td></tr>';
            document.getElementById('inventarioPagination').innerHTML = '';
        }
    }

    function renderizarPaginaInventario(juguetesFiltrados = null) {
        const tbody = document.getElementById('inventarioTableBody');
        const productos = juguetesFiltrados || todosLosJuguetes;
        
        if (!productos || productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">No hay juguetes para mostrar</td></tr>';
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
            const ubicacionNombre = juguete.bodega_id 
                ? (juguete.bodegas?.nombre || 'N/A')
                : juguete.tienda_id 
                ? (juguete.tiendas?.nombre || 'N/A')
                : 'Sin ubicación';
            const ubicacion = juguete.bodega_id 
                ? `Bodega: ${capitalizarPrimeraLetra(ubicacionNombre)}`
                : juguete.tienda_id 
                ? `Tienda: ${capitalizarPrimeraLetra(ubicacionNombre)}`
                : 'Sin ubicación';
            const tipo = juguete.bodega_id ? 'Bodega' : juguete.tienda_id ? 'Tienda' : 'N/A';
            const foto = juguete.foto_url 
                ? `<img src="${juguete.foto_url}" alt="${nombreCapitalizado}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">`
                : '<span style="color: #64748b;">Sin foto</span>';
            
            row.innerHTML = `
                <td>${nombreCapitalizado}</td>
                <td>${juguete.codigo}</td>
                <td>${foto}</td>
                <td>${juguete.cantidad}</td>
                <td>${ubicacion}</td>
                <td>${tipo}</td>
                <td>
                    <div style="position: relative;">
                        <button onclick="abrirMenuEditarJuguete(${juguete.id}, event)" 
                                style="background: none; border: none; cursor: pointer; padding: 5px; color: #64748b; font-size: 18px;">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </td>
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
        
        // Remover listeners anteriores si existen
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm === '') {
                // Si no hay búsqueda, mostrar todos los juguetes
                paginaActualInventario = 1;
                renderizarPaginaInventario();
                return;
            }

            // Filtrar juguetes (búsqueda mejorada: nombre, código, cantidad, ubicación)
            const juguetesFiltrados = todosLosJuguetes.filter(juguete => {
                const nombre = juguete.nombre?.toLowerCase() || '';
                const codigo = juguete.codigo?.toLowerCase() || '';
                const cantidad = juguete.cantidad?.toString() || '';
                const ubicacionNombre = juguete.bodega_id 
                    ? (juguete.bodegas?.nombre?.toLowerCase() || '')
                    : juguete.tienda_id 
                    ? (juguete.tiendas?.nombre?.toLowerCase() || '')
                    : '';
                const ubicacionTipo = juguete.bodega_id ? 'bodega' : juguete.tienda_id ? 'tienda' : '';
                
                return nombre.includes(searchTerm) || 
                       codigo.includes(searchTerm) || 
                       cantidad.includes(searchTerm) ||
                       ubicacionNombre.includes(searchTerm) ||
                       ubicacionTipo.includes(searchTerm);
            });

            // Resetear a página 1 cuando se filtra
            paginaActualInventario = 1;
            renderizarPaginaInventario(juguetesFiltrados);
        });
    }

    // Función global para abrir menú de editar juguete
    window.abrirMenuEditarJuguete = async function(jugueteId, event) {
        event.stopPropagation();
        
        try {
            // Buscar el juguete en todosLosJuguetes
            const juguete = todosLosJuguetes.find(j => j.id === jugueteId);
            
            if (!juguete) {
                // Si no está en la lista, buscarlo en la base de datos
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
                    alert('Error al cargar el juguete');
                    return;
                }
                
                // Llenar el formulario
                document.getElementById('editarJugueteId').value = data.id;
                document.getElementById('editarJugueteNombre').value = data.nombre;
                document.getElementById('editarJugueteCodigo').value = data.codigo;
                document.getElementById('editarJugueteCantidad').value = data.cantidad;
            } else {
                // Llenar el formulario con datos del juguete
                document.getElementById('editarJugueteId').value = juguete.id;
                document.getElementById('editarJugueteNombre').value = juguete.nombre;
                document.getElementById('editarJugueteCodigo').value = juguete.codigo;
                document.getElementById('editarJugueteCantidad').value = juguete.cantidad;
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

    // Configurar formulario de edición
    document.addEventListener('DOMContentLoaded', function() {
        const editarJugueteForm = document.getElementById('editarJugueteForm');
        if (editarJugueteForm) {
            editarJugueteForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const jugueteId = document.getElementById('editarJugueteId').value;
                const nombre = capitalizarPrimeraLetra(document.getElementById('editarJugueteNombre').value.trim());
                const codigo = document.getElementById('editarJugueteCodigo').value.trim();
                const cantidad = parseInt(document.getElementById('editarJugueteCantidad').value);
                
                const errorMsg = document.getElementById('editarJugueteErrorMessage');
                const successMsg = document.getElementById('editarJugueteSuccessMessage');
                
                errorMsg.style.display = 'none';
                successMsg.style.display = 'none';
                
                if (!nombre || !codigo || cantidad < 0) {
                    errorMsg.textContent = 'Por favor, completa todos los campos correctamente';
                    errorMsg.style.display = 'block';
                    return;
                }
                
                try {
                    const user = JSON.parse(sessionStorage.getItem('user'));
                    
                    // Verificar si el código ya existe en otro juguete
                    const { data: jugueteExistente, error: checkError } = await window.supabaseClient
                        .from('juguetes')
                        .select('id, nombre')
                        .eq('codigo', codigo)
                        .eq('empresa_id', user.empresa_id)
                        .neq('id', jugueteId)
                        .limit(1);
                    
                    if (checkError) throw checkError;
                    
                    if (jugueteExistente && jugueteExistente.length > 0) {
                        errorMsg.textContent = `El código "${codigo}" ya está asignado a otro juguete (${jugueteExistente[0].nombre})`;
                        errorMsg.style.display = 'block';
                        return;
                    }
                    
                    // Actualizar juguete
                    const { error: updateError } = await window.supabaseClient
                        .from('juguetes')
                        .update({
                            nombre: nombre,
                            codigo: codigo,
                            cantidad: cantidad
                        })
                        .eq('id', jugueteId);
                    
                    if (updateError) throw updateError;
                    
                    successMsg.textContent = 'Juguete actualizado correctamente';
                    successMsg.style.display = 'block';
                    
                    // Recargar inventario después de 1 segundo
                    setTimeout(async () => {
                        await loadInventario();
                        cerrarModalEditarJuguete();
                    }, 1000);
                } catch (error) {
                    console.error('Error al actualizar juguete:', error);
                    errorMsg.textContent = 'Error al actualizar el juguete: ' + error.message;
                    errorMsg.style.display = 'block';
                }
            });
        }
    });

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
    async function loadEmpleados() {
        const empleadosList = document.getElementById('empleadosList');
        empleadosList.innerHTML = '<p style="text-align: center; color: #64748b;">Cargando empleados...</p>';
        
        try {
            const { data: empleados, error } = await window.supabaseClient
                .from('empleados')
                .select('*, tiendas(nombre)')
                .eq('empresa_id', user.empresa_id)
                .order('nombre');

            if (error) throw error;

            if (!empleados || empleados.length === 0) {
                empleadosList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay empleados registrados. Agrega un nuevo empleado.</p>';
                return;
            }

            empleadosList.innerHTML = '';
            empleados.forEach(empleado => {
                const empleadoCard = createEmpleadoCard(empleado);
                empleadosList.appendChild(empleadoCard);
            });
        } catch (error) {
            console.error('Error al cargar empleados:', error);
            empleadosList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar los empleados</p>';
        }
    }
    
    // Cargar tiendas para el select de empleados
    async function loadTiendasForSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">Sin tienda asignada</option>';
        
        try {
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
                    select.appendChild(option);
                });
            }
            
            if (currentValue) {
                select.value = currentValue;
            }
        } catch (error) {
            console.error('Error al cargar tiendas:', error);
        }
    }

    // Crear tarjeta de empleado
    function createEmpleadoCard(empleado) {
        const card = document.createElement('div');
        card.className = 'bodega-card';
        const tiendaNombre = empleado.tiendas ? empleado.tiendas.nombre : 'Sin tienda asignada';
        card.innerHTML = `
            <div class="bodega-info">
                <h3>${capitalizarPrimeraLetra(empleado.nombre)}</h3>
                <p><i class="fas fa-phone"></i> ${empleado.telefono}</p>
                <p><i class="fas fa-id-card"></i> Documento: ${empleado.documento || 'N/A'}</p>
                <p><i class="fas fa-barcode"></i> Código: ${empleado.codigo}</p>
                <p><i class="fas fa-store"></i> Tienda: ${tiendaNombre}</p>
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
        nuevoEmpleadoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nombre = capitalizarPrimeraLetra(document.getElementById('empleadoNombre').value.trim());
            const telefono = document.getElementById('empleadoTelefono').value.trim();
            const documento = document.getElementById('empleadoDocumento').value.trim();
            const codigo = document.getElementById('empleadoCodigo').value.trim();
            const tiendaId = document.getElementById('empleadoTienda').value;
            
            if (!nombre || !telefono || !documento || !codigo) {
                showEmpleadoMessage('Por favor, completa todos los campos obligatorios', 'error');
                return;
            }

            try {
                const empleadoData = {
                    nombre: nombre,
                    telefono: telefono,
                    documento: documento,
                    codigo: codigo,
                    empresa_id: user.empresa_id
                };
                
                if (tiendaId) {
                    empleadoData.tienda_id = tiendaId;
                }

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
        
        setTimeout(() => {
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
        }, 5000);
    }

    // Abrir modal para editar empleado
    async function openEditEmpleadoModal(empleadoId) {
        try {
            const { data: empleado, error } = await window.supabaseClient
                .from('empleados')
                .select('*')
                .eq('id', empleadoId)
                .single();

            if (error) throw error;

            document.getElementById('editEmpleadoNombre').value = empleado.nombre;
            document.getElementById('editEmpleadoTelefono').value = empleado.telefono;
            document.getElementById('editEmpleadoDocumento').value = empleado.documento || '';
            document.getElementById('editEmpleadoCodigo').value = empleado.codigo;
            currentEmpleadoId = empleadoId;
            
            // Cargar tiendas y seleccionar la actual
            await loadTiendasForSelect('editEmpleadoTienda');
            if (empleado.tienda_id) {
                const select = document.getElementById('editEmpleadoTienda');
                if (select) {
                    select.value = empleado.tienda_id;
                }
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
        editEmpleadoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nombre = capitalizarPrimeraLetra(document.getElementById('editEmpleadoNombre').value.trim());
            const telefono = document.getElementById('editEmpleadoTelefono').value.trim();
            const documento = document.getElementById('editEmpleadoDocumento').value.trim();
            const codigo = document.getElementById('editEmpleadoCodigo').value.trim();
            const tiendaId = document.getElementById('editEmpleadoTienda').value;
            
            if (!nombre || !telefono || !documento || !codigo) {
                showEditEmpleadoMessage('Por favor, completa todos los campos obligatorios', 'error');
                return;
            }

            try {
                const updateData = {
                    nombre: nombre,
                    telefono: telefono,
                    documento: documento,
                    codigo: codigo
                };
                
                if (tiendaId) {
                    updateData.tienda_id = tiendaId;
                } else {
                    updateData.tienda_id = null;
                }

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
        if (!confirm('¿Estás seguro de que deseas eliminar este empleado? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('empleados')
                .delete()
                .eq('id', empleadoId);

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

    console.log('✅ Dashboard cargado correctamente');
});

