/**
 * Pago en efectivo (UML: PagoEfectivo). Implementa IMetodoPago.
 */
class PagoEfectivo {
  procesar(monto) {
    return typeof monto === 'number' && monto >= 0;
  }
}

window.PagoEfectivo = PagoEfectivo;
