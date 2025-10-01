// Venta Web - Página pública de venta
document.addEventListener('DOMContentLoaded', function() {
    // Event listeners
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('categoriaFilter').addEventListener('change', applyFilters);
    document.getElementById('precioFilter').addEventListener('change', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Cargar juguetes disponibles
    loadJuguetesDisponibles();
    loadCategorias();

    async function loadJuguetesDisponibles() {
        try {
            const { data, error } = await supabaseClient
                .from('juguetes')
                .select('*')
                .eq('estado', 'disponible')
                .gt('cantidad', 0)
                .order('nombre', { ascending: true });

            if (error) {
                console.error('Error al cargar juguetes:', error);
                showMessage('Error al cargar juguetes', 'error');
                return;
            }

            displayJuguetes(data);
            updateStats(data);
            window.allJuguetes = data; // Guardar para filtros

        } catch (error) {
            console.error('Error:', error);
            showMessage('Error al cargar juguetes', 'error');
        }
    }

    async function loadCategorias() {
        try {
            const { data, error } = await supabaseClient
                .from('juguetes')
                .select('categoria')
                .eq('estado', 'disponible')
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
            container.innerHTML = '<p class="no-items">No hay juguetes disponibles en este momento</p>';
            return;
        }

        container.innerHTML = juguetes.map(juguete => `
            <div class="producto-card">
                <div class="producto-image">
                    <div class="producto-placeholder">🧸</div>
                </div>
                
                <div class="producto-info">
                    <h3>${juguete.nombre}</h3>
                    <p class="categoria">${juguete.categoria}</p>
                    <p class="precio">$${juguete.precio.toFixed(2)}</p>
                    <p class="stock">Stock: ${juguete.cantidad} unidades</p>
                </div>
                
                <div class="producto-actions">
                    <button class="btn btn-primary btn-compra" onclick="simularCompra(${juguete.id}, '${juguete.nombre}', ${juguete.precio})">
                        Comprar Ahora
                    </button>
                </div>
            </div>
        `).join('');
    }

    function updateStats(juguetes) {
        const totalJuguetes = juguetes.length;
        const categorias = [...new Set(juguetes.map(j => j.categoria))].length;
        
        document.getElementById('totalJuguetes').textContent = totalJuguetes;
        document.getElementById('totalCategorias').textContent = categorias;
    }

    function applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoriaFilter = document.getElementById('categoriaFilter').value;
        const precioFilter = document.getElementById('precioFilter').value;
        
        let filteredJuguetes = window.allJuguetes || [];
        
        // Filtro por búsqueda
        if (searchTerm) {
            filteredJuguetes = filteredJuguetes.filter(juguete => 
                juguete.nombre.toLowerCase().includes(searchTerm) ||
                juguete.categoria.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filtro por categoría
        if (categoriaFilter) {
            filteredJuguetes = filteredJuguetes.filter(juguete => 
                juguete.categoria === categoriaFilter
            );
        }
        
        // Filtro por precio
        if (precioFilter) {
            filteredJuguetes = filteredJuguetes.filter(juguete => {
                const precio = juguete.precio;
                switch (precioFilter) {
                    case '0-50':
                        return precio >= 0 && precio <= 50;
                    case '50-100':
                        return precio > 50 && precio <= 100;
                    case '100-200':
                        return precio > 100 && precio <= 200;
                    case '200+':
                        return precio > 200;
                    default:
                        return true;
                }
            });
        }
        
        displayJuguetes(filteredJuguetes);
        updateStats(filteredJuguetes);
    }

    function clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('categoriaFilter').value = '';
        document.getElementById('precioFilter').value = '';
        displayJuguetes(window.allJuguetes || []);
        updateStats(window.allJuguetes || []);
    }

    // Función global para simular compra
    window.simularCompra = function(id, nombre, precio) {
        const cantidad = prompt(`¿Cuántas unidades de "${nombre}" deseas comprar?`, '1');
        
        if (cantidad === null || cantidad === '') return;
        
        const cantidadNum = parseInt(cantidad);
        if (isNaN(cantidadNum) || cantidadNum <= 0) {
            showMessage('Por favor ingresa una cantidad válida', 'error');
            return;
        }

        const total = precio * cantidadNum;
        const confirmar = confirm(`Resumen de compra:\n\nProducto: ${nombre}\nCantidad: ${cantidadNum}\nPrecio unitario: $${precio.toFixed(2)}\nTotal: $${total.toFixed(2)}\n\n¿Confirmar compra?`);
        
        if (confirmar) {
            showMessage(`¡Compra realizada! Total: $${total.toFixed(2)}`, 'success');
            // Aquí podrías implementar la lógica real de compra
        }
    };

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

