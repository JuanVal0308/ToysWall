const test = require('node:test');
const assert = require('node:assert/strict');
const ServicioStockRpc = require('../../js/infraestructura/servicios/ServicioStockRpc.js');

function clienteFalso() {
    const llamadas = [];
    return { llamadas, rpc: async (funcion, parametros) => { llamadas.push({ funcion, parametros }); return { data: { codigo_venta: 'V-1' }, error: null }; } };
}

test('registrarVenta envía el vendedor y el método de pago de cada item', async () => {
    const cliente = clienteFalso();
    await new ServicioStockRpc(cliente).registrarVenta({
        items: [
            { juguete_id: 11, cantidad: 2, precio_unitario: 2500, empleado_id: 7, metodo_pago: 'efectivo' },
            { juguete_id: 12, cantidad: 1, precio_unitario: 1500, empleado_id: null, metodo_pago: 'transferencia' }
        ],
        metodoPago: 'efectivo'
    });
    const { funcion, parametros } = cliente.llamadas[0];
    assert.equal(funcion, 'registrar_venta');
    assert.deepEqual(parametros.p_items, [
        { juguete_id: 11, cantidad: 2, precio_unitario: 2500, empleado_id: 7, metodo_pago: 'efectivo' },
        { juguete_id: 12, cantidad: 1, precio_unitario: 1500, empleado_id: null, metodo_pago: 'transferencia' }
    ]);
    assert.equal(parametros.p_metodo_pago, 'efectivo');
});

test('registrarVenta sin vendedor ni método por item usa null (la RPC toma el general)', async () => {
    const cliente = clienteFalso();
    await new ServicioStockRpc(cliente).registrarVenta({ items: [{ juguete_id: 1, cantidad: 1, precio_unitario: 10 }], metodoPago: 'efectivo' });
    assert.deepEqual(cliente.llamadas[0].parametros.p_items, [{ juguete_id: 1, cantidad: 1, precio_unitario: 10, empleado_id: null, metodo_pago: null }]);
});

test('registrarVenta al por mayor marca es_por_mayor y envía el juguete_id de la ubicación', async () => {
    const cliente = clienteFalso();
    await new ServicioStockRpc(cliente).registrarVenta({
        items: [
            { juguete_id: 1340, cantidad: 200, precio_unitario: 12000, empleado_id: 9, metodo_pago: 'credito' }
        ],
        metodoPago: 'credito',
        clienteId: 55,
        esPorMayor: true,
        abono: 100000
    });
    const { funcion, parametros } = cliente.llamadas[0];
    assert.equal(funcion, 'registrar_venta');
    assert.equal(parametros.p_es_por_mayor, true);
    assert.equal(parametros.p_cliente_id, 55);
    assert.equal(parametros.p_abono, 100000);
    // La ubicación sale del registro juguete_id (fila de tienda/bodega), no de params aparte
    assert.deepEqual(parametros.p_items, [
        { juguete_id: 1340, cantidad: 200, precio_unitario: 12000, empleado_id: 9, metodo_pago: 'credito' }
    ]);
});
