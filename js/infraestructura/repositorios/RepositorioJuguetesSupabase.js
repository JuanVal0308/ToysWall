/**
 * Implementación: RepositorioJuguetesSupabase
 * Implementa IRepositorioJuguetes usando Supabase como backend
 * Principio DIP: Implementa la abstracción definida en el dominio
 * Principio LSP: Sustituible por cualquier otra implementación de IRepositorioJuguetes
 */
class RepositorioJuguetesSupabase extends IRepositorioJuguetes {
    /**
     * @param {Object} clienteSupabase - Cliente de Supabase
     */
    constructor(clienteSupabase) {
        super();
        if (!clienteSupabase) {
            throw new Error('Cliente de Supabase es requerido');
        }
        this.cliente = clienteSupabase;
    }

    /**
     * @inheritdoc
     */
    async obtenerTodos(empresaId) {
        const { data, error } = await this.cliente
            .from('juguetes')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('nombre', { ascending: true });

        if (error) throw new Error(`Error al obtener juguetes: ${error.message}`);
        
        return (data || []).map(d => Juguete.desdeDatos(d));
    }

    /**
     * @inheritdoc
     */
    async obtenerPorId(id) {
        const { data, error } = await this.cliente
            .from('juguetes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No encontrado
            throw new Error(`Error al obtener juguete: ${error.message}`);
        }

        return data ? Juguete.desdeDatos(data) : null;
    }

    /**
     * @inheritdoc
     */
    async obtenerPorCodigo(codigo, empresaId) {
        const { data, error } = await this.cliente
            .from('juguetes')
            .select('*')
            .eq('codigo', codigo)
            .eq('empresa_id', empresaId);

        if (error) throw new Error(`Error al obtener juguetes por código: ${error.message}`);
        
        return (data || []).map(d => Juguete.desdeDatos(d));
    }

    /**
     * @inheritdoc
     */
    async crear(juguete) {
        if (!juguete.esValido()) {
            throw new Error('Datos del juguete inválidos');
        }

        const { data, error } = await this.cliente
            .from('juguetes')
            .insert(juguete.aDatos())
            .select()
            .single();

        if (error) throw new Error(`Error al crear juguete: ${error.message}`);
        
        return Juguete.desdeDatos(data);
    }

    /**
     * @inheritdoc
     */
    async actualizar(id, datosActualizacion, empresaId) {
        // Convertir ID a entero
        const idNumerico = parseInt(id);
        if (isNaN(idNumerico)) {
            throw new Error('ID de juguete inválido');
        }

        // PASO 1: Obtener la fila original para saber código, empresa_id y valores anteriores
        const { data: filaOriginal, error: fetchError } = await this.cliente
            .from('juguetes')
            .select('codigo, empresa_id, nombre, precio_min, precio_por_mayor, item, foto_url, cantidad_por_bulto')
            .eq('id', idNumerico)
            .single();

        if (fetchError) {
            throw new Error(`Error al obtener juguete: ${fetchError.message}`);
        }
        
        if (!filaOriginal) {
            throw new Error(`No se encontró el juguete con ID ${idNumerico}`);
        }

        const codigoOriginal = filaOriginal.codigo;
        const empresaIdReal = filaOriginal.empresa_id; // Usar el de la BD, no de sesión

        // PASO 2: Actualizar la fila editada por ID (todos los campos que vienen en datosActualizacion)
        const { data: filaActualizada, error: updateError } = await this.cliente
            .from('juguetes')
            .update(datosActualizacion)
            .eq('id', idNumerico)
            .select();

        if (updateError) {
            throw new Error(`Error al actualizar juguete: ${updateError.message}`);
        }
        
        if (!filaActualizada || filaActualizada.length === 0) {
            throw new Error(`No se pudo actualizar el juguete con ID ${idNumerico}. Verifica permisos.`);
        }

        // PASO 3: Detectar si cambiaron campos COMPARTIDOS
        const camposCompartidos = {};
        let hayCambiosCompartidos = false;

        // Nombre
        if (datosActualizacion.nombre !== undefined && datosActualizacion.nombre !== filaOriginal.nombre) {
            camposCompartidos.nombre = datosActualizacion.nombre;
            hayCambiosCompartidos = true;
        }

        // Precio mínimo
        if (datosActualizacion.precio_min !== undefined && datosActualizacion.precio_min !== filaOriginal.precio_min) {
            camposCompartidos.precio_min = datosActualizacion.precio_min;
            hayCambiosCompartidos = true;
        }

        // Precio por mayor
        if (datosActualizacion.precio_por_mayor !== undefined && datosActualizacion.precio_por_mayor !== filaOriginal.precio_por_mayor) {
            camposCompartidos.precio_por_mayor = datosActualizacion.precio_por_mayor;
            hayCambiosCompartidos = true;
        }

        // Item
        if (datosActualizacion.item !== undefined && datosActualizacion.item !== filaOriginal.item) {
            camposCompartidos.item = datosActualizacion.item;
            hayCambiosCompartidos = true;
        }

        // Foto URL
        if (datosActualizacion.foto_url !== undefined && datosActualizacion.foto_url !== filaOriginal.foto_url) {
            camposCompartidos.foto_url = datosActualizacion.foto_url;
            hayCambiosCompartidos = true;
        }

        // Cantidad por bulto
        if (datosActualizacion.cantidad_por_bulto !== undefined && datosActualizacion.cantidad_por_bulto !== filaOriginal.cantidad_por_bulto) {
            camposCompartidos.cantidad_por_bulto = datosActualizacion.cantidad_por_bulto;
            hayCambiosCompartidos = true;
        }

        // Código (si cambió, también hay que actualizarlo en hermanas)
        const codigoCambio = datosActualizacion.codigo !== undefined && datosActualizacion.codigo !== codigoOriginal;
        if (codigoCambio) {
            camposCompartidos.codigo = datosActualizacion.codigo;
            hayCambiosCompartidos = true;
        }

        // PASO 4: Si hay cambios en campos compartidos, actualizar filas hermanas
        if (hayCambiosCompartidos) {
            // Actualizar todas las OTRAS filas con el mismo código original y empresa_id
            // (excluyendo la que acabamos de editar)
            const { data: filasHermanas, error: syncError } = await this.cliente
                .from('juguetes')
                .update(camposCompartidos)
                .eq('codigo', codigoOriginal)
                .eq('empresa_id', empresaIdReal)
                .neq('id', idNumerico)  // Excluir la fila ya actualizada
                .select('id');

            if (syncError) {
                throw new Error(`Error al sincronizar campos compartidos: ${syncError.message}`);
            }

            // No es error si no hay filas hermanas (podría ser el único producto con ese código)
            if (filasHermanas && filasHermanas.length > 0) {
                console.log(`✓ Sincronizados campos compartidos en ${filasHermanas.length} ubicacion(es) adicional(es)`);
            }
        }

        return Juguete.desdeDatos(filaActualizada[0]);
    }

    /**
     * @inheritdoc
     */
    async eliminar(id) {
        const { error } = await this.cliente
            .from('juguetes')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Error al eliminar juguete: ${error.message}`);
        
        return true;
    }

    /**
     * @inheritdoc
     */
    async existeCodigo(codigo, empresaId, excluirId = null) {
        let query = this.cliente
            .from('juguetes')
            .select('id')
            .eq('codigo', codigo)
            .eq('empresa_id', empresaId);

        if (excluirId) {
            query = query.neq('id', excluirId);
        }

        const { data, error } = await query.limit(1);

        if (error) throw new Error(`Error al verificar código: ${error.message}`);
        
        return data && data.length > 0;
    }
}

// Exportar
window.RepositorioJuguetesSupabase = RepositorioJuguetesSupabase;
