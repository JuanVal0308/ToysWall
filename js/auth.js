// Funcionalidad de autenticación (usa ServicioLogin + IAutenticacion según arquitectura UML)

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

    // ServicioLogin con implementación IAutenticacion:
    //  - Supabase Auth (APP_CONFIG.USAR_SUPABASE_AUTH = true)
    //  - tabla usuarios (modo anterior)
    const usarSupabaseAuth = window.APP_CONFIG?.USAR_SUPABASE_AUTH === true;
    const ClaseAutenticador = usarSupabaseAuth ? window.AutenticacionSupabaseAuth : window.AutenticacionSupabase;
    const autenticador = ClaseAutenticador && window.supabaseClient
        ? new ClaseAutenticador(window.supabaseClient)
        : null;
    const servicioLogin = window.ServicioLogin && autenticador
        ? new window.ServicioLogin(autenticador)
        : null;

    // Manejar envío del formulario
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Ocultar mensajes anteriores
        hideMessages();

        // Obtener valores del formulario (login por correo y contraseña; nombre se valida en backend)
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
            if (!servicioLogin) {
                throw new Error('Servicio de login no disponible');
            }

            // Login por correo y contraseña (IAutenticacion.autenticar)
            const usuario = await servicioLogin.login(email, password);

            if (!usuario) {
                throw new Error('Contraseña o usuario incorrecto');
            }

            // Validar nombre de usuario (coincidencia con el que tiene la cuenta)
            if ((usuario.nombre || '').toLowerCase() !== nombreUsuario.toLowerCase()) {
                if (typeof autenticador.cerrarSesion === 'function') {
                    await autenticador.cerrarSesion();
                }
                throw new Error('Contraseña o usuario incorrecto');
            }

            // Autenticación exitosa
            showMessage('¡Bienvenido! Redirigiendo...', 'success');
            
            // Guardar sesión desde el modelo de dominio (Usuario.toSession)
            const session = typeof usuario.toSession === 'function' ? usuario.toSession() : {
                id: usuario.codigo,
                nombre: usuario.nombre,
                email: usuario.correo,
                empresa_id: usuario.empresa_id,
                empresa_nombre: usuario.empresa_nombre,
                tipo_usuario_id: usuario.tipo_usuario_id
            };
            sessionStorage.setItem('user', JSON.stringify(session));

            // Redirigir después de un breve delay
            setTimeout(() => {
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


