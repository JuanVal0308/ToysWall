/**
 * Factura (UML: Invoice).
 * Atributos: codigo, fecha, total, items (ItemVenta[]).
 */
class Factura {
  /**
   * @param {string} codigo
   * @param {Date|string} fecha
   * @param {number} total
   * @param {ItemVenta[]} [items]
   */
  constructor(codigo, fecha, total, items = []) {
    this.codigo = codigo;
    this.fecha = fecha instanceof Date ? fecha : new Date(fecha);
    this.total = total;
    this.items = Array.isArray(items) ? items : [];
  }

  static fromRow(row, itemsRows = []) {
    const items = itemsRows.map(r => ItemVenta.fromRow(r));
    return new Factura(
      row.codigo_factura,
      row.created_at,
      parseFloat(row.total),
      items
    );
  }
}

window.Factura = Factura;
