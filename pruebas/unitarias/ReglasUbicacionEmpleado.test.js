const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../js/dominio/servicios/ReglasUbicacionEmpleado.js');
const RI = require('../../js/dominio/servicios/ReglasInventario.js');

test('deEmpleado / claveDeEmpleado: bodega, tienda o ninguna', () => {
    assert.deepEqual(R.deEmpleado({ bodega_id: 1, tienda_id: null }), { tipo: 'bodega', id: 1 });
    assert.deepEqual(R.deEmpleado({ tienda_id: '6' }), { tipo: 'tienda', id: 6 });
    assert.equal(R.deEmpleado({ tienda_id: null }), null);
    assert.equal(R.claveDeEmpleado({ bodega_id: 1 }), 'bodega-1');
    assert.equal(R.claveDeEmpleado({}), '');
});

test('camposParaGuardar: limpia la otra columna y respeta si la BD admite bodega', () => {
    assert.deepEqual(R.camposParaGuardar('bodega-1', true), { campos: { tienda_id: null, bodega_id: 1 }, error: null });
    assert.deepEqual(R.camposParaGuardar('tienda-7', true), { campos: { tienda_id: 7, bodega_id: null }, error: null });
    assert.deepEqual(R.camposParaGuardar('', true), { campos: { tienda_id: null, bodega_id: null }, error: null });
    // Sin la migración 08 no se envía bodega_id (la columna no existe)
    assert.deepEqual(R.camposParaGuardar('tienda-7', false), { campos: { tienda_id: 7 }, error: null });
    assert.deepEqual(R.camposParaGuardar('', false), { campos: { tienda_id: null }, error: null });
    assert.match(R.camposParaGuardar('bodega-1', false).error, /migración 2026_10_02_08/);
});

test('describir: nombre de la tienda o bodega', () => {
    const tiendas = [{ id: 7, nombre: 'San victoriano' }];
    const bodegas = [{ id: 1, nombre: 'Santa Isabel' }];
    assert.equal(R.describir({ bodega_id: 1 }, tiendas, bodegas), 'Bodega Santa Isabel');
    assert.equal(R.describir({ tienda_id: 7 }, tiendas, bodegas), 'Tienda San victoriano');
    assert.equal(R.describir({ tienda_id: 9, tiendas: { nombre: 'Vieja' } }, tiendas, bodegas), 'Tienda Vieja');
    assert.equal(R.describir({}, tiendas, bodegas), 'Sin ubicación asignada');
});

test('seleccionarUbicacionVenta: empleado de bodega vende solo desde su bodega', () => {
    const filas = [
        { id: 10, tienda_id: 1, bodega_id: null, cantidad: 50 },
        { id: 11, tienda_id: null, bodega_id: 1, cantidad: 4 }
    ];
    const bodega = { tipo: 'bodega', id: 1 };
    assert.equal(RI.seleccionarUbicacionVenta(filas, { cantidad: 3, ubicacionEmpleado: bodega }).fila.id, 11);
    assert.match(RI.seleccionarUbicacionVenta(filas, { cantidad: 3, ubicacionEmpleado: bodega, reservado: { 11: 2 } }).error,
        /suficiente cantidad en la bodega del empleado\. Disponible: 2/);
    assert.match(RI.seleccionarUbicacionVenta([filas[0]], { cantidad: 1, ubicacionEmpleado: bodega }).error,
        /no está disponible en la bodega del empleado/);
});

test('seleccionarUbicacionVenta: tienda del empleado y venta libre siguen igual', () => {
    const filas = [
        { id: 10, tienda_id: 1, bodega_id: null, cantidad: 2 },
        { id: 12, tienda_id: 6, bodega_id: null, cantidad: 9 },
        { id: 11, tienda_id: null, bodega_id: 1, cantidad: 40 }
    ];
    assert.equal(RI.seleccionarUbicacionVenta(filas, { cantidad: 5, ubicacionEmpleado: { tipo: 'tienda', id: 6 } }).fila.id, 12);
    assert.equal(RI.seleccionarUbicacionVenta(filas, { cantidad: 1, tiendaEmpleadoId: 1 }).fila.id, 10); // forma anterior
    assert.match(RI.seleccionarUbicacionVenta(filas, { cantidad: 3, tiendaEmpleadoId: 1 }).error, /tienda del empleado/);
    assert.equal(RI.seleccionarUbicacionVenta(filas, { cantidad: 20 }).fila.id, 11); // admin: tiendas y luego bodegas
});
