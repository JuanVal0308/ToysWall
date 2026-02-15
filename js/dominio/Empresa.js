/**
 * Empresa (UML: Company).
 * Atributos: id, nombre, logo.
 */
class Empresa {
  /**
   * @param {number} id
   * @param {string} nombre
   * @param {string} [logo]
   */
  constructor(id, nombre, logo = '') {
    this.id = id;
    this.nombre = nombre;
    this.logo = logo;
  }

  static fromRow(row) {
    return new Empresa(row.id, row.nombre, row.logo_url || row.logo || '');
  }
}

window.Empresa = Empresa;
