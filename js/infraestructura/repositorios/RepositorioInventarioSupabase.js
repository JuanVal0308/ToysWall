/**
 * Implementación: RepositorioInventarioSupabase
 * Implementa IRepositorioInventario usando Supabase como backend
 * Principio DIP: Implementa la abstracción definida en el dominio
 * Principio LSP: Sustituible por cualquier otra implementación de IRepositorioInventario
 */
class RepositorioInventarioSupabase extends IRepositorioInventario {
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
    async obtenerInventario(empresaId, ubicacionId = null) {
        let query = this.cliente
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

        if (error) throw new Error(`Error al obtener inventario: ${error.message}`);
        
        return (data || []).map(d => InventarioUbicacion.desdeDatos(d));
    }

    /**
     * @inheritdoc
     */
    async obtenerInventarioConsolidado(empresaId) {
        // Obtener todos los juguetes con sus ubicaciones
        const { data: juguetes, error: juguetesError } = await this.cliente
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

        if (juguetesError) throw new Error(`Error al obtener juguetes: ${juguetesError.message}`);

        // Obtener ventas por juguete
        const { data: ventas, error: ventasError } = await this.cliente
            .from('ventas')
            .select('juguete_codigo, cantidad')
            .eq('empresa_id', empresaId);

        if (ventasError) throw new Error(`Error al obtener ventas: ${ventasError.message}`);

        // Consolidar inventario por código
        const inventarioMap = {};
        const CANTIDAD_POR_BULTO_DEFAULT = 12;

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
                    cantidad_vendida: 0,
                    ubicaciones: new Map()
                };
            }

            const cantidadJuguete = juguete.cantidad || 0;
            inventarioMap[codigo].cantidad_total += cantidadJuguete;

            // Determinar ubicación
            let ubicacionKey = null;
            let ubicacionNombre = null;
            let tipoUbicacion = null;

            if (juguete.bodega_id && juguete.bodegas) {
                ubicacionKey = `bodega-${juguete.bodega_id}`;
                ubicacionNombre = juguete.bodegas.nombre;
                tipoUbicacion = 'Bodega';
            } else if (juguete.tienda_id && juguete.tiendas) {
                ubicacionKey = `tienda-${juguete.tienda_id}`;
                ubicacionNombre = juguete.tiendas.nombre;
                tipoUbicacion = 'Tienda';
            }

            if (ubicacionKey) {
                const cantidadPorBulto = juguete.cantidad_por_bulto || CANTIDAD_POR_BULTO_DEFAULT;
                
                if (inventarioMap[codigo].ubicaciones.has(ubicacionKey)) {
                    const ub = inventarioMap[codigo].ubicaciones.get(ubicacionKey);
                    ub.cantidad += cantidadJuguete;
                    ub.bultos = Math.floor(ub.cantidad / cantidadPorBulto);
                    ub.unidades_sueltas = ub.cantidad % cantidadPorBulto;
                } else {
                    inventarioMap[codigo].ubicaciones.set(ubicacionKey, {
                        tipo: tipoUbicacion,
                        nombre: ubicacionNombre,
                        cantidad: cantidadJuguete,
                        bultos: Math.floor(cantidadJuguete / cantidadPorBulto),
                        unidades_sueltas: cantidadJuguete % cantidadPorBulto
                    });
                }
            }
        });

        // Convertir Maps a arrays
        Object.keys(inventarioMap).forEach(codigo => {
            inventarioMap[codigo].ubicaciones = Array.from(inventarioMap[codigo].ubicaciones.values());
        });

        // Calcular cantidad vendida
        if (ventas) {
            ventas.forEach(venta => {
                const juguete = juguetes.find(j => j.codigo === venta.juguete_codigo);
                if (juguete && inventarioMap[juguete.codigo]) {
                    inventarioMap[juguete.codigo].cantidad_vendida += venta.cantidad || 0;
                }
            });
        }

        // Calcular disponibilidad
        const inventarioArray = Object.values(inventarioMap);
        inventarioArray.forEach(juguete => {
            juguete.cantidad_disponible = juguete.cantidad_total - juguete.cantidad_vendida;
            
            const cantidadPorBulto = CANTIDAD_POR_BULTO_DEFAULT;
            juguete.bultos_disponibles = Math.floor(juguete.cantidad_disponible / cantidadPorBulto);
            juguete.unidades_sueltas_disponibles = juguete.cantidad_disponible % cantidadPorBulto;
            juguete.bultos_totales = Math.floor(juguete.cantidad_total / cantidadPorBulto);
        });

        return inventarioArray;
    }

    /**
     * @inheritdoc
     */
    async obtenerCantidadTotal(jugueteCodigo, empresaId) {
        const { data, error } = await this.cliente
            .from('inventario_por_ubicacion')
            .select('cantidad')
            .eq('juguete_codigo', jugueteCodigo)
            .eq('empresa_id', empresaId);

        if (error) throw new Error(`Error al obtener cantidad total: ${error.message}`);
        
        return (data || []).reduce((sum, item) => sum + (item.cantidad || 0), 0);
    }

    /**
     * @inheritdoc
     */
    async actualizarCantidad(jugueteCodigo, ubicacionId, cantidad, empresaId) {
        const { data, error } = await this.cliente
            .from('inventario_por_ubicacion')
            .upsert({
                juguete_codigo: jugueteCodigo,
                ubicacion_id: parseInt(ubicacionId),
                cantidad: parseInt(cantidad),
                empresa_id: parseInt(empresaId),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw new Error(`Error al actualizar cantidad: ${error.message}`);
        
        return InventarioUbicacion.desdeDatos(data);
    }

    /**
     * @inheritdoc
     */
    async agregar(inventario) {
        if (!inventario.esValido()) {
            throw new Error('Datos de inventario inválidos');
        }

        const { data, error } = await this.cliente
            .from('inventario_por_ubicacion')
            .insert(inventario.aDatos())
            .select()
            .single();

        if (error) throw new Error(`Error al agregar inventario: ${error.message}`);
        
        return InventarioUbicacion.desdeDatos(data);
    }

    /**
     * @inheritdoc
     */
    async transferir(jugueteCodigo, ubicacionOrigenId, ubicacionDestinoId, cantidad, empresaId) {
        try {
            // Verificar stock en origen
            const { data: inventarioOrigen, error: origenError } = await this.cliente
                .from('inventario_por_ubicacion')
                .select('cantidad')
                .eq('juguete_codigo', jugueteCodigo)
                .eq('ubicacion_id', ubicacionOrigenId)
                .eq('empresa_id', empresaId)
                .single();

            if (origenError) throw new Error(`Error al obtener inventario origen: ${origenError.message}`);
            
            if (!inventarioOrigen || inventarioOrigen.cantidad < cantidad) {
                throw new Error('Stock insuficiente en ubicación de origen');
            }

            // Reducir en origen
            const { error: reducirError } = await this.cliente
                .from('inventario_por_ubicacion')
                .update({ cantidad: inventarioOrigen.cantidad - cantidad })
                .eq('juguete_codigo', jugueteCodigo)
                .eq('ubicacion_id', ubicacionOrigenId)
                .eq('empresa_id', empresaId);

            if (reducirError) throw new Error(`Error al reducir inventario origen: ${reducirError.message}`);

            // Aumentar en destino
            const { data: inventarioDestino, error: destinoError } = await this.cliente
                .from('inventario_por_ubicacion')
                .select('cantidad')
                .eq('juguete_codigo', jugueteCodigo)
                .eq('ubicacion_id', ubicacionDestinoId)
                .eq('empresa_id', empresaId)
                .single();

            if (destinoError && destinoError.code !== 'PGRST116') {
                throw new Error(`Error al obtener inventario destino: ${destinoError.message}`);
            }

            if (inventarioDestino) {
                // Actualizar existente
                const { error: updateError } = await this.cliente
                    .from('inventario_por_ubicacion')
                    .update({ cantidad: inventarioDestino.cantidad + cantidad })
                    .eq('juguete_codigo', jugueteCodigo)
                    .eq('ubicacion_id', ubicacionDestinoId)
                    .eq('empresa_id', empresaId);

                if (updateError) throw new Error(`Error al actualizar inventario destino: ${updateError.message}`);
            } else {
                // Crear nuevo
                const { error: insertError } = await this.cliente
                    .from('inventario_por_ubicacion')
                    .insert({
                        juguete_codigo: jugueteCodigo,
                        ubicacion_id: ubicacionDestinoId,
                        cantidad: cantidad,
                        empresa_id: empresaId
                    });

                if (insertError) throw new Error(`Error al crear inventario destino: ${insertError.message}`);
            }

            return true;
        } catch (error) {
            console.error('Error en transferencia de inventario:', error);
            throw error;
        }
    }
}

// Exportar
window.RepositorioInventarioSupabase = RepositorioInventarioSupabase;
