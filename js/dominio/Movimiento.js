/**
 * Movimiento (UML: Movement).
 * Atributos: id, fecha, usuario (Usuario), origen, destino.
 * Métodos: ejecutar().
 */
class Movimiento {
  /**
   * @param {number} id
   * @param {Date|string} fecha
   * @param {Usuario} usuario
   * @param {string} origen
   * @param {string} destino
   */
  constructor(id, fecha, usuario, origen, destino) {
    this.id = id;
    this.fecha = fecha instanceof Date ? fecha : new Date(fecha);
    this.usuario = usuario;
    this.origen = origen;
    this.destino = destino;
  }

  ejecutar() {
    // Contrato del dominio; la persistencia se hace en servicio/API.
  }

  static fromRow(row, usuarioInstance = null) {
    return new Movimiento(
      row.id,
      row.created_at,
      usuarioInstance || null,
      row.tipo_origen + '-' + row.origen_id,
      row.tipo_destino + '-' + row.destino_id
    );
  }
}

window.Movimiento = Movimiento;
