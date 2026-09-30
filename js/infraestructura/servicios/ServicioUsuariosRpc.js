/**
 * Gestión de usuarios con Supabase Auth — capa de INFRAESTRUCTURA.
 * Las altas, cambios y bajas se hacen con RPC (migración 2026_09_30_01) que mantienen
 * sincronizadas la tabla usuarios y las cuentas de Supabase Auth; el navegador nunca
 * lee ni guarda contraseñas. Solo administradores (lo valida la base de datos).
 */
class ServicioUsuariosRpc {
    constructor(clienteSupabase) {
        this.cliente = clienteSupabase;
    }

    static get LONGITUD_MINIMA_PASSWORD() {
        return 6;
    }

    async llamar(funcion, parametros) {
        const { data, error } = await this.cliente.rpc(funcion, parametros);
        if (error) {
            const err = new Error(error.message || `Error al ejecutar ${funcion}`);
            err.code = error.code;
            throw err;
        }
        return data;
    }

    crear({ nombre, email, password, tipoUsuarioId }) {
        return this.llamar('admin_crear_usuario', {
            p_nombre: nombre,
            p_email: email,
            p_password: password,
            p_tipo_usuario_id: tipoUsuarioId
        });
    }

    actualizar(id, { nombre, email, tipoUsuarioId, password = null, activo = null }) {
        return this.llamar('admin_actualizar_usuario', {
            p_id: id,
            p_nombre: nombre,
            p_email: email,
            p_tipo_usuario_id: tipoUsuarioId,
            p_password: password || null,
            p_activo: activo
        });
    }

    eliminar(id) {
        return this.llamar('admin_eliminar_usuario', { p_id: id });
    }
}

if (typeof window !== 'undefined') {
    window.ServicioUsuariosRpc = ServicioUsuariosRpc;
    if (window.supabaseClient) window.servicioUsuariosRpc = new ServicioUsuariosRpc(window.supabaseClient);
}
