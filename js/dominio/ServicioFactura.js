/**
 * Servicio de facturación (UML: ServicioFactura).
 * Métodos: generarFactura(venta), enviarFactura(factura, correo).
 */
class ServicioFactura {
  /**
   * Genera una factura a partir de una venta.
   * @param {Venta} venta
   * @returns {Factura}
   */
  generarFactura(venta) {
    if (!venta || !window.Factura) throw new Error('Venta y Factura requeridos');
    const total = typeof venta.calcularTotal === 'function' ? venta.calcularTotal() : 0;
    const codigo = `FAC-${venta.codigo}-${Date.now()}`;
    return new window.Factura(codigo, venta.fecha, total, venta.items || []);
  }

  /**
   * Envía la factura por correo (contrato; implementación puede ser API o descarga).
   * @param {Factura} factura
   * @param {string} correo
   */
  enviarFactura(factura, correo) {
    if (!factura || !correo) return;
    // Placeholder: en el proyecto real podría llamar a Supabase Edge Function o servicio de email.
    console.log('ServicioFactura.enviarFactura', factura.codigo, correo);
  }
}

window.ServicioFactura = ServicioFactura;
