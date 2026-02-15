/**
 * Cliente (UML: Client).
 * Atributos: id, nombre, correo.
 */
class Cliente {
  /**
   * @param {number} id
   * @param {string} nombre
   * @param {string} [correo]
   */
  constructor(id, nombre, correo = '') {
    this.id = id;
    this.nombre = nombre;
    this.correo = correo;
  }

  static fromRow(row) {
    return new Cliente(row.id, row.nombre, row.correo || '');
  }
}

window.Cliente = Cliente;
