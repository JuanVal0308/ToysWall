/**
 * Interfaz método de pago (UML: IMetodoPago).
 * Contrato: procesar(monto) retorna boolean.
 */
window.IMetodoPago = Object.freeze({
  procesar: (monto) => { throw new Error('Implementar procesar(monto)'); }
});
