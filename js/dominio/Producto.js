/**
 * Producto (clase base) — UML.
 * Cualquier ítem vendible (Juguete u otros) hereda de Producto.
 * Atributos: codigo, nombre, stock, precioBase, precioMayorista.
 * Métodos: aumentarStock(cant), disminuirStock(cant).
 */
class Producto {
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

  /**
   * Crea instancia desde fila de BD (formato genérico).
   * @param {Object} row
   * @returns {Producto}
   */
  static fromRow(row) {
    const stock = row.cantidad ?? row.stock ?? 0;
    const base = row.precio_min ?? row.precioBase ?? 0;
    const mayor = row.precio_por_mayor ?? row.precioMayorista ?? null;
    return new Producto(row.codigo, row.nombre, stock, base, mayor);
  }
}

window.Producto = Producto;
