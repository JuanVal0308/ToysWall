const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../js/dominio/servicios/ReglasEliminarTienda.js');

test('nombreConfirmado: exige el nombre sin distinguir mayúsculas ni espacios a los lados', () => {
    assert.equal(R.nombreConfirmado('  san VICTORIANO ', 'San victoriano'), true);
    assert.equal(R.nombreConfirmado('San victorian', 'San victoriano'), false);
    assert.equal(R.nombreConfirmado('', ''), false);
    assert.equal(R.nombreConfirmado(null, 'Campin'), false);
});

test('elegirBodegaDestino: única bodega automática, varias requieren elección, ninguna es error', () => {
    const una = [{ id: 1, nombre: 'Santa Isabel' }];
    const varias = [{ id: 1, nombre: 'Santa Isabel' }, { id: 4, nombre: 'Norte' }];
    assert.deepEqual(R.elegirBodegaDestino(una, null), { bodega: una[0], automatica: true, error: null });
    assert.match(R.elegirBodegaDestino(varias, '').error, /Selecciona la bodega/);
    assert.equal(R.elegirBodegaDestino(varias, '4').bodega.nombre, 'Norte');
    assert.match(R.elegirBodegaDestino(varias, 99).error, /Selecciona/);
    assert.match(R.elegirBodegaDestino([], null).error, /No hay ninguna bodega/);
});

test('resumirTraslado: suma a códigos existentes (sin distinguir mayúsculas) y mueve los demás', () => {
    const tienda = [
        { codigo: 'A1', cantidad: 5 },
        { codigo: 'b2', cantidad: 7 },
        { codigo: 'B2 ', cantidad: 1 },   // duplicado en la tienda: se suma al movido
        { codigo: 'C3', cantidad: 0 }
    ];
    const bodega = [{ codigo: 'a1' }, { codigo: 'Z9' }];
    assert.deepEqual(R.resumirTraslado(tienda, bodega), { registros: 4, unidades: 13, fusionados: 2, movidos: 2 });
    assert.deepEqual(R.resumirTraslado([], bodega), { registros: 0, unidades: 0, fusionados: 0, movidos: 0 });
});

test('mensajeResultado: resume inventario, empleados y planes', () => {
    const m = R.mensajeResultado({ tienda_nombre: 'PRUEBA', bodega_nombre: 'Santa Isabel', unidades: 12,
        registros_movidos: 2, registros_fusionados: 1, empleados_reasignados: 1, planes_cancelados: 1 });
    assert.match(m, /Tienda "PRUEBA" eliminada/);
    assert.match(m, /12 unidad\(es\) pasaron a la bodega Santa Isabel \(1 producto\(s\) sumados a los que ya había y 2 movido\(s\)\)/);
    assert.match(m, /1 empleado\(s\) ahora venden desde la bodega Santa Isabel/);
    assert.match(m, /1 plan\(es\)/);
    assert.match(R.mensajeResultado({ tienda_nombre: 'X', bodega_nombre: 'B', unidades: 0, registros_movidos: 0,
        registros_fusionados: 0, empleados_reasignados: 0, planes_cancelados: 0 }), /No tenía inventario/);
});
