/**
 * Implementación de IAutenticacion usando Supabase.
 * Autentica por correo y contraseña contra la tabla usuarios.
 * Retorna Usuario, Admin o Empleado según tipo_usuario_id y si existe en empleados.
 */
class AutenticacionSupabase {
  constructor(supabaseClient) {
    this.client = supabaseClient;
  }

  /**
   * @param {string} correo
   * @param {string} password
   * @returns {Promise<Usuario|null>}
   */
  async autenticar(correo, password) {
    if (!this.client) return null;

    const { data: usuarios, error } = await this.client
      .from('usuarios')
      .select('*, empresas(id, nombre)')
      .eq('email', correo);

    if (error || !usuarios || usuarios.length === 0) return null;

    const usuario = usuarios.find(u => u.email.toLowerCase() === correo.toLowerCase());
    if (!usuario) return null;

    const passAlmacenada = usuario.password || usuario.contraseña;
    if (!passAlmacenada || passAlmacenada !== password) return null;

    if (!usuario.empresas?.id) return null;

    const tipoId = usuario.tipo_usuario_id;
    const isAdmin = tipoId === 1 || tipoId === 2; // Super Admin o Admin
    const isEmpleado = tipoId === 3; // Empleado

    if (isEmpleado) {
      const { data: empleados } = await this.client
        .from('empleados')
        .select('*, tiendas(id, nombre, direccion)')
        .eq('empresa_id', usuario.empresa_id);
      const empRow = empleados && empleados.find(e => (e.nombre || '').toLowerCase() === (usuario.nombre || '').toLowerCase());
      const tiendaRow = empRow && (empRow.tiendas || (empRow.tienda_id ? { id: empRow.tienda_id, nombre: '', direccion: '' } : null));
      return window.Empleado
        ? Empleado.fromRow(usuario, empRow || null, tiendaRow || null)
        : Usuario.fromRow(usuario);
    }

    if (isAdmin && window.Admin) return Admin.fromRow(usuario);
    return Usuario.fromRow(usuario);
  }
}

window.AutenticacionSupabase = AutenticacionSupabase;
