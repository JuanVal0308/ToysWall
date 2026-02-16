/**
 * Juguete (UML: Toy). Hereda de Producto.
 * Constructor: Juguete(codigo, nombre, stock, precioBase, precioMayorista).
 */
class Juguete extends Producto {
  /**
   * @param {string} codigo
   * @param {string} nombre
   * @param {number} stock
   * @param {number} precioBase
   * @param {number} [precioMayorista]
   */
  constructor(codigo, nombre, stock, precioBase, precioMayorista = null) {
    super(codigo, nombre, stock, precioBase, precioMayorista);
  }

  static fromRow(row) {
    const stock = row.cantidad ?? row.stock ?? 0;
    const base = row.precio_min ?? row.precioBase ?? 0;
    const mayor = row.precio_por_mayor ?? row.precioMayorista ?? null;
    return new Juguete(row.codigo, row.nombre, stock, base, mayor);
  }
}

window.Juguete = Juguete;
