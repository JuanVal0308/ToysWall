/**
 * Tienda (UML: Store).
 * Atributos: id, nombre, direccion.
 */
class Tienda {
  /**
   * @param {number} id
   * @param {string} nombre
   * @param {string} direccion
   */
  constructor(id, nombre, direccion) {
    this.id = id;
    this.nombre = nombre;
    this.direccion = direccion;
  }

  static fromRow(row) {
    return new Tienda(row.id, row.nombre, row.direccion || '');
  }
}

window.Tienda = Tienda;
