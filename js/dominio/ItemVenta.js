/**
 * Item de venta (UML: ItemVenta).
 * Atributos: producto (Producto — Juguete u otro), cantidad, precioUnitario.
 * Métodos: subtotal().
 */
class ItemVenta {
  /**
   * @param {Producto} producto - Juguete u otro tipo que herede de Producto
   * @param {number} cantidad
   * @param {number} precioUnitario
   */
  constructor(producto, cantidad, precioUnitario) {
    this.producto = producto;
    this.cantidad = cantidad;
    this.precioUnitario = precioUnitario;
    /** @deprecated Usar producto. Se mantiene por compatibilidad. */
    this.juguete = producto;
  }

  subtotal() {
    return this.cantidad * this.precioUnitario;
  }

  static fromRow(row, productoInstance = null) {
    const p = productoInstance || (row.juguete_codigo && window.Juguete
      ? new window.Juguete(row.juguete_codigo, row.juguete_nombre || '', 0, row.precio_venta || row.precioUnitario)
      : null);
    return new ItemVenta(p, row.cantidad || 1, row.precio_venta ?? row.precioUnitario ?? 0);
  }
}

window.ItemVenta = ItemVenta;
