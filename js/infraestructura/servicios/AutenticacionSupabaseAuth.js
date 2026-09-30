/**
 * Implementación de IAutenticacion con Supabase Auth (email + contraseña).
 * Las contraseñas se verifican en Supabase Auth (hash bcrypt); la tabla usuarios solo aporta
 * el perfil (nombre, tipo, empresa) y se vincula por usuarios.auth_id.
 * Se usa cuando APP_CONFIG.USAR_SUPABASE_AUTH = true.
 */
class AutenticacionSupabaseAuth {
  /**
   * @param {Object} supabaseClient - Cliente de supabase-js v2
   */
  constructor(supabaseClient) {
    this.client = supabaseClient;
  }

  static get COLUMNAS_USUARIO() {
    return 'id, nombre, email, empresa_id, tipo_usuario_id, activo, auth_id, empresas(id, nombre)';
  }

  /**
   * @param {string} correo
   * @param {string} password
   * @returns {Promise<Usuario|null>} null si las credenciales no son válidas o el usuario está inactivo
   */
  async autenticar(correo, password) {
    if (!this.client) return null;
    const email = (correo || '').trim().toLowerCase();

    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      const esCredencial = error.status === 400 || error.code === 'invalid_credentials';
      if (esCredencial) return null;
      throw new Error('No se pudo conectar con el servicio de autenticación. Intenta nuevamente.');
    }

    const usuario = await this.obtenerUsuarioDeSesion(data.user);
    if (!usuario) {
      await this.cerrarSesion();
      return null;
    }
    return usuario;
  }

  /**
   * Devuelve el usuario de dominio de la sesión actual de Supabase Auth, o null.
   * @param {Object} [authUser] - Usuario de Auth; si se omite se consulta la sesión actual
   * @returns {Promise<Usuario|null>}
   */
  async obtenerUsuarioDeSesion(authUser = null) {
    let usuarioAuth = authUser;
    if (!usuarioAuth) {
      const { data } = await this.client.auth.getSession();
      usuarioAuth = data?.session?.user || null;
    }
    if (!usuarioAuth) return null;

    const { data: fila, error } = await this.client
      .from('usuarios')
      .select(AutenticacionSupabaseAuth.COLUMNAS_USUARIO)
      .eq('auth_id', usuarioAuth.id)
      .maybeSingle();

    if (error || !fila || fila.activo === false) return null;
    return AutenticacionSupabase.construirUsuario(this.client, fila);
  }

  async cerrarSesion() {
    try {
      await this.client.auth.signOut();
    } catch (e) {
      console.warn('No se pudo cerrar la sesión en Supabase Auth:', e);
    }
  }
}

window.AutenticacionSupabaseAuth = AutenticacionSupabaseAuth;
