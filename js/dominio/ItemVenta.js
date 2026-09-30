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
    // Si se proporciona una instancia de producto, usarla
    if (productoInstance) {
      return new ItemVenta(productoInstance, row.cantidad || 1, row.precio_venta ?? row.precioUnitario ?? 0);
    }
    
    // Si hay datos de juguete en el row, crear un objeto producto compatible
    if (row.juguete_codigo && window.Juguete) {
      // Crear usando la nueva entidad Juguete de Clean Architecture si tiene desdeDatos
      if (window.Juguete.desdeDatos) {
        const jugueteData = {
          id: row.juguete_id || null,
          codigo: row.juguete_codigo,
          nombre: row.juguete_nombre || '',
          item: row.juguete_item || null,
          precio_min: row.precio_venta || row.precioUnitario || 0,
          precio_por_mayor: null,
          foto_url: row.juguete_foto_url || null,
          empresa_id: row.empresa_id || null
        };
        const p = window.Juguete.desdeDatos(jugueteData);
        return new ItemVenta(p, row.cantidad || 1, row.precio_venta ?? row.precioUnitario ?? 0);
      }
      // Fallback: crear objeto simple compatible con Producto
      const p = {
        codigo: row.juguete_codigo,
        nombre: row.juguete_nombre || '',
        stock: 0,
        precioBase: row.precio_venta || row.precioUnitario || 0,
        precioMayorista: null
      };
      return new ItemVenta(p, row.cantidad || 1, row.precio_venta ?? row.precioUnitario ?? 0);
    }
    
    // Si no hay datos de juguete, crear ItemVenta con producto null
    return new ItemVenta(null, row.cantidad || 1, row.precio_venta ?? row.precioUnitario ?? 0);
  }
}

window.ItemVenta = ItemVenta;
