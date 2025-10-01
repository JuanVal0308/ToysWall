// Dashboard - Gestión de usuarios y juguetes
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    if (!checkAuth()) {
        window.location.href = 'index.html';
        return;
    }

    // Mostrar nombre de usuario
    const username = localStorage.getItem('username');
    document.getElementById('username').textContent = username;

    // Event listeners
    document.getElementById('registerForm').addEventListener('submit', handleUserRegistration);
    document.getElementById('jugueteForm').addEventListener('submit', handleJugueteSubmit);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Cargar inventario inicial
    loadJuguetes();

    async function handleUserRegistration(e) {
        e.preventDefault();
        
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;

        try {
            const { data, error } = await supabaseClient
                .from('usuarios')
                .insert([
                    { username: username, password: password }
                ]);

            if (error) {
                showMessage('Error al registrar usuario: ' + error.message, 'error');
                return;
            }

            showMessage('Usuario registrado exitosamente', 'success');
            document.getElementById('registerForm').reset();

        } catch (error) {
            console.error('Error:', error);
            showMessage('Error al registrar usuario', 'error');
        }
    }

    async function handleJugueteSubmit(e) {
        e.preventDefault();
        
        const juguete = {
            nombre: document.getElementById('nombre').value,
            categoria: document.getElementById('categoria').value,
            precio: parseFloat(document.getElementById('precio').value),
            cantidad: parseInt(document.getElementById('cantidad').value),
            estado: document.getElementById('estado').value
        };

        try {
            const { data, error } = await supabaseClient
                .from('juguetes')
                .insert([juguete]);

            if (error) {
                showMessage('Error al agregar juguete: ' + error.message, 'error');
                return;
            }

            showMessage('Juguete agregado exitosamente', 'success');
            document.getElementById('jugueteForm').reset();
            loadJuguetes();

        } catch (error) {
            console.error('Error:', error);
            showMessage('Error al agregar juguete', 'error');
        }
    }

    async function loadJuguetes() {
        try {
            const { data, error } = await supabaseClient
                .from('juguetes')
                .select('*')
                .order('id', { ascending: false });

            if (error) {
                console.error('Error al cargar juguetes:', error);
                return;
            }

            displayJuguetes(data);

        } catch (error) {
            console.error('Error:', error);
        }
    }

    function displayJuguetes(juguetes) {
        const container = document.getElementById('juguetesList');
        
        if (juguetes.length === 0) {
            container.innerHTML = '<p>No hay juguetes en el inventario</p>';
            return;
        }

        container.innerHTML = juguetes.map(juguete => `
            <div class="juguete-card">
                <h4>${juguete.nombre}</h4>
                <p><strong>Categoría:</strong> ${juguete.categoria}</p>
                <p><strong>Precio:</strong> $${juguete.precio}</p>
                <p><strong>Cantidad:</strong> ${juguete.cantidad}</p>
                <p><strong>Estado:</strong> 
                    <span class="estado ${juguete.estado}">${juguete.estado}</span>
                </p>
                <div class="juguete-actions">
                    <button onclick="updateCantidad(${juguete.id}, ${juguete.cantidad})" class="btn btn-small">Actualizar Cantidad</button>
                    <button onclick="updateEstado(${juguete.id}, '${juguete.estado}')" class="btn btn-small">Cambiar Estado</button>
                </div>
            </div>
        `).join('');
    }

    // Funciones globales para los botones
    window.updateCantidad = async function(id, currentCantidad) {
        const newCantidad = prompt('Nueva cantidad:', currentCantidad);
        if (newCantidad === null || newCantidad === '') return;

        try {
            const { error } = await supabaseClient
                .from('juguetes')
                .update({ cantidad: parseInt(newCantidad) })
                .eq('id', id);

            if (error) {
                showMessage('Error al actualizar cantidad: ' + error.message, 'error');
                return;
            }

            showMessage('Cantidad actualizada', 'success');
            loadJuguetes();

        } catch (error) {
            console.error('Error:', error);
            showMessage('Error al actualizar cantidad', 'error');
        }
    };

    window.updateEstado = async function(id, currentEstado) {
        const newEstado = currentEstado === 'disponible' ? 'vendido' : 'disponible';
        
        try {
            const { error } = await supabaseClient
                .from('juguetes')
                .update({ estado: newEstado })
                .eq('id', id);

            if (error) {
                showMessage('Error al actualizar estado: ' + error.message, 'error');
                return;
            }

            showMessage('Estado actualizado', 'success');
            loadJuguetes();

        } catch (error) {
            console.error('Error:', error);
            showMessage('Error al actualizar estado', 'error');
        }
    };

    function checkAuth() {
        const isAuthenticated = localStorage.getItem('authenticated');
        return isAuthenticated === 'true';
    }

    function logout() {
        localStorage.removeItem('authenticated');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        window.location.href = 'index.html';
    }

    function showMessage(message, type) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});

