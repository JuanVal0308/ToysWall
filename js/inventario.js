// Inventario - Vista completa del inventario
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    if (!checkAuth()) {
        window.location.href = 'index.html';
        return;
    }

    // Event listeners
    document.getElementById('categoriaFilter').addEventListener('change', applyFilters);
    document.getElementById('estadoFilter').addEventListener('change', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Cargar inventario inicial
    loadJuguetes();
    loadCategorias();

    async function loadJuguetes() {
        try {
            const { data, error } = await supabaseClient
                .from('juguetes')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) {
                console.error('Error al cargar juguetes:', error);
                showMessage('Error al cargar inventario', 'error');
                return;
            }

            displayJuguetes(data);
            window.allJuguetes = data; // Guardar para filtros

        } catch (error) {
            console.error('Error:', error);
            showMessage('Error al cargar inventario', 'error');
        }
    }

    async function loadCategorias() {
        try {
            const { data, error } = await supabaseClient
                .from('juguetes')
                .select('categoria')
                .not('categoria', 'is', null);

            if (error) {
                console.error('Error al cargar categorías:', error);
                return;
            }

            // Obtener categorías únicas
            const categorias = [...new Set(data.map(item => item.categoria))];
            
            const select = document.getElementById('categoriaFilter');
            select.innerHTML = '<option value="">Todas las categorías</option>';
            
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria;
                option.textContent = categoria;
                select.appendChild(option);
            });

        } catch (error) {
            console.error('Error:', error);
        }
    }

    function displayJuguetes(juguetes) {
        const container = document.getElementById('juguetesList');
        
        if (juguetes.length === 0) {
            container.innerHTML = '<p class="no-items">No hay juguetes en el inventario</p>';
            return;
        }

        container.innerHTML = juguetes.map(juguete => `
            <div class="juguete-card">
                <div class="juguete-header">
                    <h3>${juguete.nombre}</h3>
                    <span class="estado ${juguete.estado}">${juguete.estado}</span>
                </div>
                
                <div class="juguete-info">
                    <p><strong>Categoría:</strong> ${juguete.categoria}</p>
                    <p><strong>Precio:</strong> $${juguete.precio.toFixed(2)}</p>
                    <p><strong>Cantidad:</strong> ${juguete.cantidad}</p>
                </div>
                
                <div class="juguete-actions">
                    <button onclick="updateCantidad(${juguete.id}, ${juguete.cantidad})" 
                            class="btn btn-small btn-primary">
                        Actualizar Cantidad
                    </button>
                    <button onclick="updateEstado(${juguete.id}, '${juguete.estado}')" 
                            class="btn btn-small ${juguete.estado === 'disponible' ? 'btn-warning' : 'btn-success'}">
                        ${juguete.estado === 'disponible' ? 'Marcar Vendido' : 'Marcar Disponible'}
                    </button>
                </div>
            </div>
        `).join('');
    }

    function applyFilters() {
        const categoriaFilter = document.getElementById('categoriaFilter').value;
        const estadoFilter = document.getElementById('estadoFilter').value;
        
        let filteredJuguetes = window.allJuguetes || [];
        
        if (categoriaFilter) {
            filteredJuguetes = filteredJuguetes.filter(juguete => 
                juguete.categoria === categoriaFilter
            );
        }
        
        if (estadoFilter) {
            filteredJuguetes = filteredJuguetes.filter(juguete => 
                juguete.estado === estadoFilter
            );
        }
        
        displayJuguetes(filteredJuguetes);
    }

    function clearFilters() {
        document.getElementById('categoriaFilter').value = '';
        document.getElementById('estadoFilter').value = '';
        displayJuguetes(window.allJuguetes || []);
    }

    // Funciones globales para los botones
    window.updateCantidad = async function(id, currentCantidad) {
        const newCantidad = prompt('Nueva cantidad:', currentCantidad);
        if (newCantidad === null || newCantidad === '') return;

        if (isNaN(newCantidad) || parseInt(newCantidad) < 0) {
            showMessage('La cantidad debe ser un número positivo', 'error');
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('juguetes')
                .update({ cantidad: parseInt(newCantidad) })
                .eq('id', id);

            if (error) {
                showMessage('Error al actualizar cantidad: ' + error.message, 'error');
                return;
            }

            showMessage('Cantidad actualizada exitosamente', 'success');
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

            showMessage(`Estado cambiado a ${newEstado}`, 'success');
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

