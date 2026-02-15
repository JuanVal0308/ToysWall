/**
 * Item de venta (UML: ItemVenta).
 * Atributos: juguete (Juguete), cantidad, precioUnitario.
 * Métodos: subtotal().
 */
class ItemVenta {
  /**
   * @param {Juguete} juguete
   * @param {number} cantidad
   * @param {number} precioUnitario
   */
  constructor(juguete, cantidad, precioUnitario) {
    this.juguete = juguete;
    this.cantidad = cantidad;
    this.precioUnitario = precioUnitario;
  }

  subtotal() {
    return this.cantidad * this.precioUnitario;
  }

  static fromRow(row, jugueteInstance = null) {
    const j = jugueteInstance || (row.juguete_codigo && window.Juguete
      ? new window.Juguete(row.juguete_codigo, row.juguete_nombre || '', 0, row.precio_venta || row.precioUnitario)
      : null);
    return new ItemVenta(j, row.cantidad || 1, row.precio_venta ?? row.precioUnitario ?? 0);
  }
}

window.ItemVenta = ItemVenta;
