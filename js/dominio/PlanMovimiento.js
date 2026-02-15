/**
 * Plan de movimiento (UML: PlanMovimiento).
 * Atributos: id, origen, destino, estado, items (Juguete[]).
 * Métodos: aprobar().
 */
class PlanMovimiento {
  /**
   * @param {number} id
   * @param {string} origen
   * @param {string} destino
   * @param {string} [estado]
   * @param {Juguete[]|Object[]} [items]
   */
  constructor(id, origen, destino, estado = 'pendiente', items = []) {
    this.id = id;
    this.origen = origen;
    this.destino = destino;
    this.estado = estado;
    this.items = Array.isArray(items) ? items : [];
  }

  aprobar() {
    this.estado = 'ejecutado';
  }

  static fromRow(row) {
    const items = row.items && Array.isArray(row.items) ? row.items : (row.items ? JSON.parse(row.items) : []);
    return new PlanMovimiento(
      row.id,
      row.origen_nombre || row.origen || '',
      row.destino_nombre || row.destino || '',
      row.estado || 'pendiente',
      items
    );
  }
}

window.PlanMovimiento = PlanMovimiento;
