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
    empresaNombreEl.textContent = user.empresa_nombre || 'Empresa';
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

    // Cargar logo de la empresa
    async function loadEmpresaLogo() {
        try {
            const { data, error } = await window.supabaseClient
                .from('empresas')
                .select('logo_url')
                .eq('id', user.empresa_id)
                .single();

            if (error) throw error;

            if (data && data.logo_url) {
                let logoUrl = data.logo_url;
                
                // Convertir URL de álbum de Imgur a URL directa si es necesario
                if (logoUrl.includes('imgur.com/a/')) {
                    console.warn('URL de álbum de Imgur detectada. Necesitas la URL directa de la imagen.');
                } else if (logoUrl.includes('imgur.com/') && !logoUrl.includes('i.imgur.com')) {
                    const imgurId = logoUrl.split('imgur.com/')[1].split('/').pop().split('?')[0];
                    logoUrl = `https://i.imgur.com/${imgurId}.png`;
                }
                
                empresaLogoEl.src = logoUrl;
                empresaLogoEl.onerror = function() {
                    console.error('Error al cargar la imagen del logo desde:', logoUrl);
                    logoContainer.style.display = 'none';
                };
                empresaLogoEl.onload = function() {
                    logoContainer.style.display = 'flex';
                };
            } else {
                logoContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error al cargar logo:', error);
            logoContainer.style.display = 'none';
        }
    }

    await loadEmpresaLogo();

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
    const categoriasView = document.getElementById('categoriasView');
    const bodegasView = document.getElementById('bodegasView');
    const tiendasView = document.getElementById('tiendasView');
    const empleadosView = document.getElementById('empleadosView');
    const usuariosView = document.getElementById('usuariosView');
    const abastecerView = document.getElementById('abastecerView');
    const analisisView = document.getElementById('analisisView');
    
    let currentBodegaId = null;
    let currentCategoriaId = null;
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
        categoriasView.style.display = 'none';
        bodegasView.style.display = 'none';
        tiendasView.style.display = 'none';
        empleadosView.style.display = 'none';
        usuariosView.style.display = 'none';
        abastecerView.style.display = 'none';
        analisisView.style.display = 'none';
        
        // Verificar permisos para empleados
        if (isEmpleado && viewName !== 'venta' && viewName !== 'facturar') {
            alert('No tienes permisos para acceder a esta sección');
            return;
        }
        
        // Mostrar la vista seleccionada
        switch(viewName) {
            case 'venta':
                ventaView.style.display = 'block';
                initRegistrarVenta();
                break;
            case 'facturar':
                // Esta vista se abre desde el botón facturar
                break;
            case 'juguetes':
                if (isAdmin) {
                    juguetesView.style.display = 'block';
                    loadCategoriasForJuguetes();
                    loadUbicacionesForSelect();
                }
                break;
            case 'inventario':
                if (isAdmin) {
                    inventarioView.style.display = 'block';
                    loadInventario();
                }
                break;
            case 'categorias':
                if (isAdmin) {
                    categoriasView.style.display = 'block';
                    loadCategorias();
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
            const menu = document.getElementById(`menu-${bodegaId}`);
            
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

    // Abrir modal para agregar juguetes
    function openAgregarJuguetesModal(bodegaId) {
        currentBodegaId = bodegaId;
        const modal = document.getElementById('agregarJuguetesModal');
        modal.style.display = 'flex';
        document.getElementById('agregarJuguetesForm').reset();
        document.getElementById('jugueteErrorMessage').style.display = 'none';
        document.getElementById('jugueteSuccessMessage').style.display = 'none';
    }

    // Formulario para agregar juguetes
    const agregarJuguetesForm = document.getElementById('agregarJuguetesForm');
    agregarJuguetesForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const nombre = document.getElementById('jugueteNombre').value.trim();
        const codigo = document.getElementById('jugueteCodigo').value.trim();
        const categoria = document.getElementById('jugueteCategoria').value.trim();
        const cantidad = parseInt(document.getElementById('jugueteCantidad').value);

        if (!nombre || !codigo || !categoria || isNaN(cantidad) || cantidad < 0) {
            showJugueteMessage('Por favor, completa todos los campos correctamente', 'error');
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('juguetes')
                .insert({
                    nombre: nombre,
                    codigo: codigo,
                    categoria: categoria,
                    cantidad: cantidad,
                    bodega_id: currentBodegaId
                });

            if (error) throw error;

            showJugueteMessage('Juguete agregado correctamente', 'success');
            setTimeout(() => {
                closeAgregarJuguetesModal();
            }, 1500);
        } catch (error) {
            console.error('Error al agregar juguete:', error);
            showJugueteMessage('Error al agregar el juguete: ' + error.message, 'error');
        }
    });

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

    // Cerrar modal de agregar juguetes
    function closeAgregarJuguetesModal() {
        const modal = document.getElementById('agregarJuguetesModal');
        modal.style.display = 'none';
        agregarJuguetesForm.reset();
        document.getElementById('jugueteErrorMessage').style.display = 'none';
        document.getElementById('jugueteSuccessMessage').style.display = 'none';
        currentBodegaId = null;
    }

    document.getElementById('closeAgregarJuguetesModal').addEventListener('click', closeAgregarJuguetesModal);
    document.getElementById('cancelAgregarJuguetesBtn').addEventListener('click', closeAgregarJuguetesModal);
    document.getElementById('agregarJuguetesModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAgregarJuguetesModal();
        }
    });

    // ============================================
    // FUNCIONALIDAD DE JUGUETES
    // ============================================
    
    // Cargar categorías para el select
    async function loadCategoriasForSelect() {
        const select = document.getElementById('jugueteCategoriaSelect');
        select.innerHTML = '<option value="">Selecciona una categoría</option>';
        
        try {
            const { data: categorias, error } = await window.supabaseClient
                .from('categorias')
                .select('*')
                .eq('empresa_id', user.empresa_id)
                .order('nombre');

            if (error) throw error;

            if (categorias && categorias.length > 0) {
                categorias.forEach(categoria => {
                    const option = document.createElement('option');
                    option.value = categoria.id;
                    option.textContent = categoria.nombre;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error al cargar categorías:', error);
        }
    }

    // Cargar ubicaciones (bodegas y tiendas) para el select
    async function loadUbicacionesForSelect() {
        const tipoSelect = document.getElementById('jugueteUbicacionTipo');
        const ubicacionSelect = document.getElementById('jugueteUbicacionSelect');
        const container = document.getElementById('jugueteUbicacionContainer');

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
                    if (bodegas) {
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
                    if (tiendas) {
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
    }

    // Formulario para agregar juguete
    const agregarJugueteForm = document.getElementById('agregarJugueteForm');
    if (agregarJugueteForm) {
        agregarJugueteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nombre = document.getElementById('jugueteNombreInput').value.trim();
            const codigo = document.getElementById('jugueteCodigoInput').value.trim();
            const cantidad = parseInt(document.getElementById('jugueteCantidadInput').value);
            const ubicacionTipo = document.getElementById('jugueteUbicacionTipo').value;
            const ubicacionId = document.getElementById('jugueteUbicacionSelect').value;
            
            // Obtener categorías seleccionadas
            const categoriasSeleccionadas = Array.from(document.querySelectorAll('#categoriasCheckboxes input[type="checkbox"]:checked'))
                .map(cb => parseInt(cb.value));

            if (!nombre || !codigo || categoriasSeleccionadas.length === 0 || isNaN(cantidad) || cantidad < 0 || !ubicacionTipo || !ubicacionId) {
                showJugueteFormMessage('Por favor, completa todos los campos y selecciona al menos una categoría', 'error');
                return;
            }

            try {
                const jugueteData = {
                    nombre: nombre,
                    codigo: codigo,
                    cantidad: cantidad,
                    empresa_id: user.empresa_id
                };

                if (ubicacionTipo === 'bodega') {
                    jugueteData.bodega_id = ubicacionId;
                } else if (ubicacionTipo === 'tienda') {
                    jugueteData.tienda_id = ubicacionId;
                }

                // Insertar juguete
                const { data: juguete, error: jugueteError } = await window.supabaseClient
                    .from('juguetes')
                    .insert(jugueteData)
                    .select()
                    .single();

                if (jugueteError) throw jugueteError;

                // Agregar categorías
                for (const categoriaId of categoriasSeleccionadas) {
                    await window.supabaseClient
                        .from('juguetes_categorias')
                        .insert({
                            juguete_id: juguete.id,
                            categoria_id: categoriaId
                        });
                }

                showJugueteFormMessage('Juguete agregado correctamente', 'success');
                agregarJugueteForm.reset();
                document.getElementById('jugueteUbicacionContainer').style.display = 'none';
                // Recargar categorías
                if (typeof loadCategoriasForJuguetes === 'function') {
                    loadCategoriasForJuguetes();
                }
            } catch (error) {
                console.error('Error al agregar juguete:', error);
                showJugueteFormMessage('Error al agregar el juguete: ' + error.message, 'error');
            }
        });
    }

    function showJugueteFormMessage(message, type) {
        const errorMsg = document.getElementById('agregarJugueteErrorMessage');
        const successMsg = document.getElementById('agregarJugueteSuccessMessage');
        
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
    
    async function loadInventario() {
        const tbody = document.getElementById('inventarioTableBody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">Cargando inventario...</td></tr>';
        
        try {
            const { data: juguetes, error } = await window.supabaseClient
                .from('juguetes')
                .select(`
                    *,
                    categorias(nombre),
                    bodegas(nombre, direccion),
                    tiendas(nombre, ubicacion)
                `)
                .eq('empresa_id', user.empresa_id)
                .order('nombre');

            if (error) throw error;

            if (!juguetes || juguetes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">No hay juguetes en el inventario</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            juguetes.forEach(juguete => {
                const row = document.createElement('tr');
                const ubicacion = juguete.bodega_id 
                    ? `Bodega: ${juguete.bodegas?.nombre || 'N/A'}`
                    : juguete.tienda_id 
                    ? `Tienda: ${juguete.tiendas?.nombre || 'N/A'}`
                    : 'Sin ubicación';
                const tipo = juguete.bodega_id ? 'Bodega' : juguete.tienda_id ? 'Tienda' : 'N/A';
                
                row.innerHTML = `
                    <td>${juguete.nombre}</td>
                    <td>${juguete.codigo}</td>
                    <td>${juguete.categorias?.nombre || 'N/A'}</td>
                    <td>${juguete.cantidad}</td>
                    <td>${ubicacion}</td>
                    <td>${tipo}</td>
                `;
                tbody.appendChild(row);
            });

            // Agregar funcionalidad de búsqueda
            const searchInput = document.getElementById('inventarioSearch');
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        } catch (error) {
            console.error('Error al cargar inventario:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">Error al cargar el inventario</td></tr>';
        }
    }

    // ============================================
    // FUNCIONALIDAD DE CATEGORÍAS
    // ============================================
    
    // Toggle del acordeón "Agregar Categoría"
    const agregarCategoriaHeader = document.getElementById('agregarCategoriaHeader');
    const agregarCategoriaContent = document.getElementById('agregarCategoriaContent');
    
    agregarCategoriaHeader.addEventListener('click', function() {
        agregarCategoriaContent.classList.toggle('active');
        const icon = agregarCategoriaHeader.querySelector('.accordion-icon');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    });

    // Cargar categorías
    async function loadCategorias() {
        const categoriasList = document.getElementById('categoriasList');
        categoriasList.innerHTML = '<p style="text-align: center; color: #64748b;">Cargando categorías...</p>';
        
        try {
            const { data: categorias, error } = await window.supabaseClient
                .from('categorias')
                .select('*')
                .eq('empresa_id', user.empresa_id)
                .order('nombre');

            if (error) throw error;

            if (!categorias || categorias.length === 0) {
                categoriasList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay categorías registradas. Agrega una nueva categoría.</p>';
                return;
            }

            categoriasList.innerHTML = '';
            categorias.forEach(categoria => {
                const categoriaCard = createCategoriaCard(categoria);
                categoriasList.appendChild(categoriaCard);
            });
        } catch (error) {
            console.error('Error al cargar categorías:', error);
            categoriasList.innerHTML = '<p style="text-align: center; color: #ef4444;">Error al cargar las categorías</p>';
        }
    }

    // Crear tarjeta de categoría
    function createCategoriaCard(categoria) {
        const card = document.createElement('div');
        card.className = 'bodega-card';
        card.innerHTML = `
            <div class="bodega-info">
                <h3>${categoria.nombre}</h3>
            </div>
            <div class="bodega-actions">
                <button class="menu-toggle" data-categoria-id="${categoria.id}">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="dropdown-menu" id="menu-cat-${categoria.id}" style="display: none;">
                    <button class="dropdown-item" data-action="edit" data-categoria-id="${categoria.id}">
                        <i class="fas fa-edit"></i> Actualizar
                    </button>
                    <button class="dropdown-item danger" data-action="delete" data-categoria-id="${categoria.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
        return card;
    }

    // Manejar clicks en el menú de categorías
    document.addEventListener('click', function(e) {
        if (e.target.closest('.menu-toggle[data-categoria-id]')) {
            const menuToggle = e.target.closest('.menu-toggle');
            const categoriaId = menuToggle.getAttribute('data-categoria-id');
            const menu = document.getElementById(`menu-cat-${categoriaId}`);
            
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m.id !== `menu-cat-${categoriaId}`) {
                    m.style.display = 'none';
                }
            });
            
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
        
        if (e.target.closest('.dropdown-item[data-categoria-id]')) {
            const item = e.target.closest('.dropdown-item');
            const action = item.getAttribute('data-action');
            const categoriaId = item.getAttribute('data-categoria-id');
            
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                m.style.display = 'none';
            });
            
            if (action === 'edit') {
                openEditCategoriaModal(categoriaId);
            } else if (action === 'delete') {
                deleteCategoria(categoriaId);
            }
        }
    });

    // Formulario para agregar categoría
    const nuevaCategoriaForm = document.getElementById('nuevaCategoriaForm');
    nuevaCategoriaForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const nombre = document.getElementById('categoriaNombre').value.trim();
        
        if (!nombre) {
            showCategoriaMessage('Por favor, ingresa un nombre', 'error');
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('categorias')
                .insert({
                    nombre: nombre,
                    empresa_id: user.empresa_id
                });

            if (error) throw error;

            showCategoriaMessage('Categoría agregada correctamente', 'success');
            nuevaCategoriaForm.reset();
            loadCategorias();
        } catch (error) {
            console.error('Error al agregar categoría:', error);
            showCategoriaMessage('Error al agregar la categoría: ' + error.message, 'error');
        }
    });

    function showCategoriaMessage(message, type) {
        const errorMsg = document.getElementById('categoriaErrorMessage');
        const successMsg = document.getElementById('categoriaSuccessMessage');
        
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

    // Abrir modal para editar categoría
    async function openEditCategoriaModal(categoriaId) {
        try {
            const { data: categoria, error } = await window.supabaseClient
                .from('categorias')
                .select('*')
                .eq('id', categoriaId)
                .single();

            if (error) throw error;

            document.getElementById('editCategoriaNombre').value = categoria.nombre;
            currentCategoriaId = categoriaId;
            
            const modal = document.getElementById('editCategoriaModal');
            modal.style.display = 'flex';
        } catch (error) {
            console.error('Error al cargar categoría:', error);
            alert('Error al cargar los datos de la categoría');
        }
    }

    // Formulario para editar categoría
    const editCategoriaForm = document.getElementById('editCategoriaForm');
    editCategoriaForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const nombre = document.getElementById('editCategoriaNombre').value.trim();
        
        if (!nombre) {
            showEditCategoriaMessage('Por favor, ingresa un nombre', 'error');
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('categorias')
                .update({ nombre: nombre })
                .eq('id', currentCategoriaId);

            if (error) throw error;

            showEditCategoriaMessage('Categoría actualizada correctamente', 'success');
            setTimeout(() => {
                closeEditCategoriaModal();
                loadCategorias();
            }, 1500);
        } catch (error) {
            console.error('Error al actualizar categoría:', error);
            showEditCategoriaMessage('Error al actualizar la categoría: ' + error.message, 'error');
        }
    });

    function showEditCategoriaMessage(message, type) {
        const errorMsg = document.getElementById('editCategoriaErrorMessage');
        const successMsg = document.getElementById('editCategoriaSuccessMessage');
        
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

    function closeEditCategoriaModal() {
        const modal = document.getElementById('editCategoriaModal');
        modal.style.display = 'none';
        editCategoriaForm.reset();
        document.getElementById('editCategoriaErrorMessage').style.display = 'none';
        document.getElementById('editCategoriaSuccessMessage').style.display = 'none';
        currentCategoriaId = null;
    }

    document.getElementById('closeEditCategoriaModal').addEventListener('click', closeEditCategoriaModal);
    document.getElementById('cancelEditCategoriaBtn').addEventListener('click', closeEditCategoriaModal);
    document.getElementById('editCategoriaModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditCategoriaModal();
        }
    });

    // Eliminar categoría
    async function deleteCategoria(categoriaId) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('categorias')
                .delete()
                .eq('id', categoriaId);

            if (error) throw error;

            alert('Categoría eliminada correctamente');
            loadCategorias();
        } catch (error) {
            console.error('Error al eliminar categoría:', error);
            alert('Error al eliminar la categoría: ' + error.message);
        }
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
                <h3>${empleado.nombre}</h3>
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
            
            const nombre = document.getElementById('empleadoNombre').value.trim();
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
            
            const nombre = document.getElementById('editEmpleadoNombre').value.trim();
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

