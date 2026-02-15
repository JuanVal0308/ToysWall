/**
 * Usuario (UML: User).
 * Atributos: codigo, nombre, correo, password, documento.
 * Métodos: validarPassword(pass).
 */
class Usuario {
  /**
   * @param {number|string} codigo - ID o código del usuario
   * @param {string} nombre
   * @param {string} correo
   * @param {string} password
   * @param {number|string} [documento]
   */
  constructor(codigo, nombre, correo, password, documento = null) {
    this.codigo = codigo;
    this.nombre = nombre;
    this.correo = correo;
    this._password = password;
    this.documento = documento ?? null;
  }

  /**
   * Valida si la contraseña coincide.
   * @param {string} pass
   * @returns {boolean}
   */
  validarPassword(pass) {
    return this._password === pass;
  }

  /**
   * Crea instancia desde fila de Supabase (usuarios).
   * @param {Object} row - { id, nombre, email, password, empresa_id, tipo_usuario_id, empresas: { nombre }, ... }
   * @returns {Usuario}
   */
  static fromRow(row) {
    const doc = row.documento ?? row.documento_id ?? null;
    const u = new Usuario(row.id, row.nombre, row.email, row.password || row.contraseña || '', doc);
    u.empresa_id = row.empresa_id;
    u.empresa_nombre = row.empresas?.nombre ?? row.empresa_nombre ?? null;
    u.tipo_usuario_id = row.tipo_usuario_id;
    return u;
  }

  toSession() {
    return {
      id: this.codigo,
      nombre: this.nombre,
      email: this.correo,
      empresa_id: this.empresa_id,
      empresa_nombre: this.empresa_nombre,
      tipo_usuario_id: this.tipo_usuario_id,
      isAdmin: this.isAdmin,
      isEmpleado: this.isEmpleado,
      codigoEmpleado: this.codigoEmpleado,
      tiendaAsignada: this.tiendaAsignada
    };
  }
}

window.Usuario = Usuario;
