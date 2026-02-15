/**
 * Bodega (UML: Warehouse).
 * Atributos: id, nombre, direccion.
 */
class Bodega {
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
    return new Bodega(row.id, row.nombre, row.direccion || '');
  }
}

window.Bodega = Bodega;
