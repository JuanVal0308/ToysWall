// Funcionalidad de autenticación

document.addEventListener('DOMContentLoaded', async function() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Función para mostrar/ocultar contraseña
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Cambiar icono
        if (type === 'password') {
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        } else {
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        }
    });

    // Función para mostrar mensajes
    function showMessage(message, type) {
        // Ocultar ambos mensajes primero
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        if (type === 'error') {
            errorMessage.textContent = message;
            errorMessage.style.display = 'flex';
            successMessage.style.display = 'none';
        } else if (type === 'success') {
            successMessage.textContent = message;
            successMessage.style.display = 'flex';
            errorMessage.style.display = 'none';
        }
    }

    // Función para ocultar mensajes
    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    // Manejar envío del formulario
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Ocultar mensajes anteriores
        hideMessages();

        // Obtener valores del formulario
        const nombreUsuario = document.getElementById('nombreUsuario').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validación básica
        if (!nombreUsuario || !email || !password) {
            showMessage('Por favor, completa todos los campos', 'error');
            return;
        }

        // Deshabilitar botón y mostrar loading
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        btnText.textContent = 'Iniciando sesión...';

        try {
            // Buscar usuario por email y nombre (todos pertenecen a ToysWalls)
            const { data: usuarios, error: searchError } = await window.supabaseClient
                .from('usuarios')
                .select('*, empresas(id, nombre)')
                .eq('email', email)
                .ilike('nombre', nombreUsuario);

            if (searchError) {
                throw new Error('Error al buscar usuario: ' + searchError.message);
            }

            if (!usuarios || usuarios.length === 0) {
                throw new Error('Contraseña o usuario incorrecto');
            }

            // Buscar coincidencia exacta del nombre (case-insensitive) y email
            const usuario = usuarios.find(u => 
                u.email.toLowerCase() === email.toLowerCase() && 
                u.nombre.toLowerCase() === nombreUsuario.toLowerCase()
            );
            
            if (!usuario) {
                throw new Error('Contraseña o usuario incorrecto');
            }

            // Verificar que la empresa existe (debería ser ToysWalls)
            if (!usuario.empresas || !usuario.empresas.id) {
                throw new Error('Contraseña o usuario incorrecto');
            }

            // Paso 4: Verificar la contraseña
            // La contraseña debe estar almacenada en la tabla usuarios en un campo llamado 'password' o 'contraseña'
            if (!usuario.password && !usuario.contraseña) {
                throw new Error('Contraseña o usuario incorrecto');
            }

            // Comparar la contraseña ingresada con la almacenada
            const passwordAlmacenada = usuario.password || usuario.contraseña;
            
            if (passwordAlmacenada !== password) {
                throw new Error('Contraseña o usuario incorrecto');
            }

            // Autenticación exitosa
            showMessage('¡Bienvenido! Redirigiendo...', 'success');
            
            // Guardar información del usuario en sessionStorage
            sessionStorage.setItem('user', JSON.stringify({
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                empresa_id: usuario.empresa_id,
                empresa_nombre: usuario.empresas.nombre,
                tipo_usuario_id: usuario.tipo_usuario_id
            }));

            // Redirigir después de un breve delay
            setTimeout(() => {
                // Todos los usuarios (admin y empleados) van al dashboard
                // Los permisos se manejan dentro del dashboard
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            console.error('Error de autenticación:', error);
            showMessage(error.message || 'Error al iniciar sesión. Verifica tus credenciales.', 'error');
        } finally {
            // Rehabilitar botón
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            btnText.textContent = 'Iniciar Sesión';
        }
    });

    // Limpiar mensajes al escribir o cambiar selección
    const inputs = loginForm.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (errorMessage.style.display === 'flex' || successMessage.style.display === 'flex') {
                hideMessages();
            }
        });
        input.addEventListener('change', function() {
            if (errorMessage.style.display === 'flex' || successMessage.style.display === 'flex') {
                hideMessages();
            }
        });
    });

    console.log('✅ Módulo de autenticación cargado');
});

// Función para abrir WhatsApp
function openWhatsApp() {
    const phoneNumber = '573046781348'; // Número sin el + y sin espacios
    const message = encodeURIComponent('Hola, me gustaría registrarme para inventario');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
}


