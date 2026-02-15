/**
 * Empleado (UML: Employee). Hereda de Usuario.
 * Atributos adicionales: codigoEmpleado, tiendaAsignada (Tienda).
 */
class Empleado extends Usuario {
  /**
   * @param {number|string} codigo - ID usuario
   * @param {string} nombre
   * @param {string} correo
   * @param {string} password
   * @param {number|string} [documento]
   * @param {string} codigoEmpleado
   * @param {Tienda|null} tiendaAsignada
   */
  constructor(codigo, nombre, correo, password, documento, codigoEmpleado, tiendaAsignada = null) {
    super(codigo, nombre, correo, password, documento);
    this.codigoEmpleado = codigoEmpleado;
    this.tiendaAsignada = tiendaAsignada;
    this.isAdmin = false;
    this.isEmpleado = true;
  }

  /**
   * @param {Object} row - fila usuarios
   * @param {Object} [empleadoRow] - fila empleados (codigo, tienda_id, ...)
   * @param {Object} [tiendaRow] - fila tiendas para tiendaAsignada
   */
  static fromRow(row, empleadoRow = null, tiendaRow = null) {
    const u = super.fromRow(row);
    const codigoEmp = empleadoRow ? empleadoRow.codigo : (row.codigo_empleado || '');
    let tienda = null;
    if (tiendaRow) tienda = window.Tienda ? new window.Tienda(tiendaRow.id, tiendaRow.nombre, tiendaRow.direccion) : null;
    const e = new Empleado(u.codigo, u.nombre, u.correo, u._password, u.documento, codigoEmp, tienda);
    e.empresa_id = u.empresa_id;
    e.empresa_nombre = u.empresa_nombre;
    e.tipo_usuario_id = u.tipo_usuario_id;
    return e;
  }
}

window.Empleado = Empleado;
