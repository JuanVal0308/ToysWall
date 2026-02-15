/**
 * Administrador (UML: Admin). Hereda de Usuario.
 */
class Admin extends Usuario {
  /**
   * @param {number|string} codigo
   * @param {string} nombre
   * @param {string} correo
   * @param {string} password
   * @param {number|string} [documento]
   */
  constructor(codigo, nombre, correo, password, documento = null) {
    super(codigo, nombre, correo, password, documento);
    this.isAdmin = true;
    this.isEmpleado = false;
  }

  static fromRow(row) {
    const u = super.fromRow(row);
    const a = new Admin(u.codigo, u.nombre, u.correo, u._password, u.documento);
    a.empresa_id = u.empresa_id;
    a.empresa_nombre = u.empresa_nombre;
    a.tipo_usuario_id = u.tipo_usuario_id;
    return a;
  }
}

window.Admin = Admin;
