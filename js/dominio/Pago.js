/**
 * Pago (UML: Payment).
 * Atributos: monto, metodo (IMetodoPago), itemsPagados (ItemVenta[]).
 * Métodos: procesar(): boolean.
 */
class Pago {
  /**
   * @param {number} monto
   * @param {Object} metodo - Objeto con procesar(monto): boolean (IMetodoPago)
   * @param {ItemVenta[]} [itemsPagados]
   */
  constructor(monto, metodo, itemsPagados = []) {
    this.monto = monto;
    this.metodo = metodo;
    this.itemsPagados = Array.isArray(itemsPagados) ? itemsPagados : [];
  }

  procesar() {
    return this.metodo && typeof this.metodo.procesar === 'function'
      ? this.metodo.procesar(this.monto)
      : false;
  }

  static getMetodoPorTipo(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t === 'tarjeta' || t === 'card') return new (window.PagoTarjeta || class { procesar(m) { return m >= 0; } })();
    return new (window.PagoEfectivo || class { procesar(m) { return m >= 0; } })();
  }
}

window.Pago = Pago;
