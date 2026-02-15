/**
 * Pago con tarjeta (UML: PagoTarjeta). Implementa IMetodoPago.
 */
class PagoTarjeta {
  procesar(monto) {
    // En producción sería llamada a pasarela. Aquí simulamos éxito.
    return typeof monto === 'number' && monto >= 0;
  }
}

window.PagoTarjeta = PagoTarjeta;
