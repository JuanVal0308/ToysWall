/**
 * Servicio de Inventario
 * Maneja todas las operaciones relacionadas con el inventario de juguetes
 */

class InventarioService {
    constructor(supabaseClient) {
        this.client = supabaseClient;
    }

    /**
     * Obtener todos los juguetes con su inventario consolidado
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Array>} Lista de juguetes con inventario total y por ubicación
     */
    async obtenerInventarioConsolidado(empresaId) {
        try {
            // Obtener juguetes únicos (por código)
            const { data: juguetes, error: juguetesError } = await this.client
                .from('juguetes')
                .select(`
                    id,
                    nombre,
                    codigo,
                    item,
                    cantidad,
                    foto_url,
                    precio_min,
                    precio_por_mayor,
                    numero_bultos,
                    cantidad_por_bulto,
                    bodega_id,
                    tienda_id,
                    bodegas(nombre),
                    tiendas(nombre)
                `)
                .eq('empresa_id', empresaId);

            if (juguetesError) throw juguetesError;

            // Agrupar por código y consolidar inventario
            const inventarioMap = {};
            
            juguetes.forEach(juguete => {
                const codigo = juguete.codigo;
                
                if (!inventarioMap[codigo]) {
                    inventarioMap[codigo] = {
                        id: juguete.id,
                        codigo: juguete.codigo,
                        nombre: juguete.nombre,
                        item: juguete.item,
                        foto_url: juguete.foto_url,
                        precio_min: juguete.precio_min,
                        precio_por_mayor: juguete.precio_por_mayor,
                        cantidad_total: 0,
                        ubicaciones: []
                    };
                }
                
                // Sumar cantidad
                inventarioMap[codigo].cantidad_total += juguete.cantidad || 0;
                
                // Agregar ubicación si existe
                if (juguete.bodega_id || juguete.tienda_id) {
                    inventarioMap[codigo].ubicaciones.push({
                        tipo: juguete.bodega_id ? 'Bodega' : 'Tienda',
                        nombre: juguete.bodega_id ? juguete.bodegas?.nombre : juguete.tiendas?.nombre,
                        cantidad: juguete.cantidad || 0,
                        numero_bultos: juguete.numero_bultos,
                        cantidad_por_bulto: juguete.cantidad_por_bulto
                    });
                }
            });

            return Object.values(inventarioMap);
        } catch (error) {
            console.error('Error al obtener inventario consolidado:', error);
            throw error;
        }
    }

    /**
     * Obtener inventario por ubicación
     * @param {number} empresaId - ID de la empresa
     * @param {number|null} ubicacionId - ID de la ubicación (null para todas)
     * @returns {Promise<Array>} Lista de inventario por ubicación
     */
    async obtenerInventarioPorUbicacion(empresaId, ubicacionId = null) {
        try {
            let query = this.client
                .from('inventario_por_ubicacion')
                .select(`
                    *,
                    ubicaciones(id, nombre, tipo, direccion)
                `)
                .eq('empresa_id', empresaId);

            if (ubicacionId) {
                query = query.eq('ubicacion_id', ubicacionId);
            }

            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener inventario por ubicación:', error);
            throw error;
        }
    }

    /**
     * Actualizar juguete (cantidad, precios, foto, etc.)
     * @param {number} jugueteId - ID del juguete
     * @param {Object} datosActualizacion - Datos a actualizar
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Object>} Juguete actualizado
     */
    async actualizarJuguete(jugueteId, datosActualizacion, empresaId) {
        try {
            // Validar que jugueteId sea un entero
            const id = parseInt(jugueteId);
            if (isNaN(id)) {
                throw new Error('ID de juguete inválido');
            }

            // Obtener el juguete original
            const { data: jugueteOriginal, error: fetchError } = await this.client
                .from('juguetes')
                .select('codigo, nombre')
                .eq('id', id)
                .eq('empresa_id', empresaId)
                .single();

            if (fetchError) throw fetchError;
            if (!jugueteOriginal) throw new Error('Juguete no encontrado');

            const codigoCambio = jugueteOriginal.codigo !== datosActualizacion.codigo;
            const nombreCambio = jugueteOriginal.nombre !== datosActualizacion.nombre;

            // Si cambió código o nombre, actualizar todos los registros con ese código
            if (codigoCambio || nombreCambio) {
                // Actualizar código y nombre en todos los registros
                const { error: updateAllError } = await this.client
                    .from('juguetes')
                    .update({
                        nombre: datosActualizacion.nombre,
                        codigo: datosActualizacion.codigo
                    })
                    .eq('codigo', jugueteOriginal.codigo)
                    .eq('nombre', jugueteOriginal.nombre)
                    .eq('empresa_id', empresaId);

                if (updateAllError) throw updateAllError;

                // Actualizar el registro específico con cantidad, precios y otros campos
                const { error: updateError } = await this.client
                    .from('juguetes')
                    .update(datosActualizacion)
                    .eq('id', id)
                    .eq('empresa_id', empresaId);

                if (updateError) throw updateError;
            } else {
                // Actualizar solo este registro
                const { error: updateError } = await this.client
                    .from('juguetes')
                    .update(datosActualizacion)
                    .eq('id', id)
                    .eq('empresa_id', empresaId);

                if (updateError) throw updateError;
            }

            // Sincronizar precios en todos los registros del mismo código
            const { error: syncPreciosError } = await this.client
                .from('juguetes')
                .update({
                    precio_min: datosActualizacion.precio_min,
                    precio_por_mayor: datosActualizacion.precio_por_mayor
                })
                .eq('codigo', datosActualizacion.codigo)
                .eq('empresa_id', empresaId);

            if (syncPreciosError) throw syncPreciosError;

            return { success: true };
        } catch (error) {
            console.error('Error al actualizar juguete:', error);
            throw error;
        }
    }

    /**
     * Actualizar cantidad en una ubicación específica
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} ubicacionId - ID de la ubicación
     * @param {number} cantidad - Nueva cantidad
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<Object>} Resultado de la actualización
     */
    async actualizarCantidadEnUbicacion(jugueteCodigo, ubicacionId, cantidad, empresaId) {
        try {
            const { data, error } = await this.client
                .from('inventario_por_ubicacion')
                .upsert({
                    juguete_codigo: jugueteCodigo,
                    ubicacion_id: parseInt(ubicacionId),
                    cantidad: parseInt(cantidad),
                    empresa_id: parseInt(empresaId),
                    updated_at: new Date().toISOString()
                })
                .eq('juguete_codigo', jugueteCodigo)
                .eq('ubicacion_id', ubicacionId)
                .eq('empresa_id', empresaId);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al actualizar cantidad en ubicación:', error);
            throw error;
        }
    }

    /**
     * Obtener cantidad total de un producto (sumando todas las ubicaciones)
     * @param {string} jugueteCodigo - Código del juguete
     * @param {number} empresaId - ID de la empresa
     * @returns {Promise<number>} Cantidad total
     */
    async obtenerCantidadTotal(jugueteCodigo, empresaId) {
        try {
            const { data, error } = await this.client
                .from('inventario_por_ubicacion')
                .select('cantidad')
                .eq('juguete_codigo', jugueteCodigo)
                .eq('empresa_id', empresaId);

            if (error) throw error;
            
            const total = (data || []).reduce((sum, item) => sum + (item.cantidad || 0), 0);
            return total;
        } catch (error) {
            console.error('Error al obtener cantidad total:', error);
            throw error;
        }
    }
}

// Exportar servicio
window.InventarioService = InventarioService;
