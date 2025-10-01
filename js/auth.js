// Sistema de autenticación
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // Verificar si ya está autenticado
    checkAuth();

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            // Verificar credenciales contra la tabla usuarios
            const { data, error } = await supabaseClient
                .from('usuarios')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error || !data) {
                showError('Credenciales incorrectas');
                return;
            }

            // Guardar sesión
            localStorage.setItem('authenticated', 'true');
            localStorage.setItem('username', username);
            localStorage.setItem('userId', data.id);

            // Redirigir al dashboard
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error('Error en login:', error);
            showError('Error al iniciar sesión');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    function checkAuth() {
        const isAuthenticated = localStorage.getItem('authenticated');
        if (isAuthenticated === 'true') {
            window.location.href = 'dashboard.html';
        }
    }
});

