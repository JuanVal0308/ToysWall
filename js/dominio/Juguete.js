/**
 * Juguete (UML: Toy).
 * Atributos: codigo, nombre, stock, precioBase, precioMayorista.
 * Métodos: aumentarStock(cant), disminuirStock(cant).
 */
class Juguete {
  /**
   * @param {string} codigo
   * @param {string} nombre
   * @param {number} stock
   * @param {number} precioBase
   * @param {number} [precioMayorista]
   */
  constructor(codigo, nombre, stock, precioBase, precioMayorista = null) {
    this.codigo = codigo;
    this.nombre = nombre;
    this.stock = stock;
    this.precioBase = precioBase;
    this.precioMayorista = precioMayorista;
  }

  aumentarStock(cant) {
    this.stock += cant;
  }

  disminuirStock(cant) {
    if (this.stock < cant) throw new Error('Stock insuficiente');
    this.stock -= cant;
  }

  static fromRow(row) {
    const stock = row.cantidad ?? row.stock ?? 0;
    const base = row.precio_min ?? row.precioBase ?? 0;
    const mayor = row.precio_por_mayor ?? row.precioMayorista ?? null;
    return new Juguete(row.codigo, row.nombre, stock, base, mayor);
  }
}

window.Juguete = Juguete;
