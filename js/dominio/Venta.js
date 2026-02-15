/**
 * Venta (UML: Sale).
 * Atributos: codigo, fecha, codigoEmpleado, items (ItemVenta[]).
 * Métodos: calcularTotal().
 */
class Venta {
  /**
   * @param {string} codigo
   * @param {Date|string} fecha
   * @param {string} codigoEmpleado
   * @param {ItemVenta[]} [items]
   */
  constructor(codigo, fecha, codigoEmpleado, items = []) {
    this.codigo = codigo;
    this.fecha = fecha instanceof Date ? fecha : new Date(fecha);
    this.codigoEmpleado = codigoEmpleado;
    this.items = Array.isArray(items) ? items : [];
  }

  calcularTotal() {
    return this.items.reduce((sum, item) => sum + item.subtotal(), 0);
  }

  /**
   * Agrupa filas de ventas por codigo_venta en una Venta con varios ItemVenta.
   * @param {Object[]} rows - Filas de tabla ventas (una por línea)
   * @returns {Venta[]}
   */
  static fromVentasRows(rows) {
    const byCode = {};
    for (const row of rows) {
      const cod = row.codigo_venta;
      if (!byCode[cod]) {
        byCode[cod] = {
          codigo: cod,
          fecha: row.created_at,
          codigoEmpleado: row.codigo_empleado || '',
          items: []
        };
      }
      byCode[cod].items.push((window.ItemVenta || ItemVenta).fromRow(row));
    }
    return Object.values(byCode).map(v => new Venta(v.codigo, v.fecha, v.codigoEmpleado, v.items));
  }
}

window.Venta = Venta;
