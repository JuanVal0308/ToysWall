/**
 * Sistema (UML: System).
 * Atributos: nombre, empresa (Empresa).
 * Relación: Sistema tiene muchas Tiendas y muchas Bodegas.
 */
class Sistema {
  /**
   * @param {string} nombre
   * @param {Empresa} empresa
   */
  constructor(nombre, empresa) {
    this.nombre = nombre;
    this.empresa = empresa;
  }

  static fromRow(row, empresaRow) {
    const emp = empresaRow ? (window.Empresa ? Empresa.fromRow(empresaRow) : { id: row.empresa_id, nombre: row.empresas?.nombre, logo: row.empresas?.logo_url }) : null;
    return new Sistema(row.nombre || 'Sistema', emp);
  }
}

window.Sistema = Sistema;
