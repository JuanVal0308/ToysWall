const test = require('node:test');
const assert = require('node:assert');
const R = require('../../js/dominio/servicios/ReglasEdicionJuguete');

const original = { id: 10, codigo: '20', nombre: 'Carro Rojo', tienda_id: 1, bodega_id: null };
const filas = [
    original,
    { id: 11, codigo: '20', nombre: 'carro  rojo', tienda_id: 2, bodega_id: null },
    { id: 12, codigo: ' 20 ', nombre: 'Cárro Rojo', tienda_id: null, bodega_id: 1 },
    { id: 13, codigo: '20', nombre: 'Muñeca', tienda_id: null, bodega_id: 2 },
    { id: 14, codigo: '21', nombre: 'Carro Rojo', tienda_id: 3, bodega_id: null }
];

test('filasDelProducto: mismo código y nombre normalizados, más la fila editada', () => {
    assert.deepStrictEqual(R.filasDelProducto(filas, original).map(f => f.id), [10, 11, 12]);
    const raro = { id: 99, codigo: '20', nombre: 'Otro nombre' };
    assert.deepStrictEqual(R.filasDelProducto([raro, ...filas], raro).map(f => f.id), [99]);
});

test('validarCodigo: el mismo código nunca choca con el propio producto (caso de la captura)', () => {
    const r = R.validarCodigo(filas, { original, codigoNuevo: '20', nombreNuevo: 'Carro Rojo' });
    assert.strictEqual(r.valido, true);
    assert.strictEqual(R.validarCodigo(filas, { original, codigoNuevo: ' 20', nombreNuevo: 'Carro rojo' }).valido, true);
});

test('validarCodigo: rechaza un código de otro producto', () => {
    const r = R.validarCodigo([{ id: 30, codigo: 'ABC', nombre: 'Pelota' }],
        { original, codigoNuevo: 'abc', nombreNuevo: 'Carro Rojo', filasProducto: filas.slice(0, 3) });
    assert.strictEqual(r.valido, false);
    assert.match(r.mensaje, /ya está asignado a otro juguete \("Pelota"\)/);
});

test('validarCodigo: permite un código usado por filas del mismo nombre en otras ubicaciones', () => {
    const r = R.validarCodigo([{ id: 14, codigo: '21', nombre: 'carro rojo', tienda_id: 3 }],
        { original, codigoNuevo: '21', nombreNuevo: 'Carro Rojo', filasProducto: filas.slice(0, 3) });
    assert.strictEqual(r.valido, true);
});

test('validarCodigo: rechaza duplicar el producto en una misma ubicación', () => {
    const r = R.validarCodigo([{ id: 40, codigo: '21', nombre: 'Carro Rojo', tienda_id: 2 }],
        { original, codigoNuevo: '21', nombreNuevo: 'Carro Rojo', filasProducto: filas.slice(0, 3) });
    assert.strictEqual(r.valido, false);
    assert.match(r.mensaje, /misma ubicación/);
});

test('validarCodigo: código vacío', () => {
    assert.strictEqual(R.validarCodigo([], { original, codigoNuevo: '  ', nombreNuevo: 'x' }).valido, false);
});

test('separarCampos: compartidos a todas las filas; cantidad y bultos solo a la ubicación', () => {
    const r = R.separarCampos({ nombre: 'A', codigo: '1', precio_min: 28000, precio_por_mayor: 23900,
        cantidad: 90, numero_bultos: 3, cantidad_por_bulto: 60, item: null, foto_url: undefined, otro: 1 });
    assert.deepStrictEqual(r.compartidos, { nombre: 'A', codigo: '1', precio_min: 28000, precio_por_mayor: 23900, cantidad_por_bulto: 60, item: null });
    assert.deepStrictEqual(r.porUbicacion, { cantidad: 90, numero_bultos: 3 });
    assert.deepStrictEqual(R.separarCampos({ precio_min: 1 }).porUbicacion, {});
});

test('filaPreseleccionada: vista por ubicación usa su fila; general solo si hay una', () => {
    const prod = filas.slice(0, 3);
    assert.strictEqual(R.filaPreseleccionada(prod, 'tienda-2').id, 11);
    assert.strictEqual(R.filaPreseleccionada(prod, 'bodega-1').id, 12);
    assert.strictEqual(R.filaPreseleccionada(prod, 'bodega-9'), null);
    assert.strictEqual(R.filaPreseleccionada(prod, 'general'), null);
    assert.strictEqual(R.filaPreseleccionada([original], 'general').id, 10);
    const dup = [...prod, { id: 15, codigo: '20', nombre: 'Carro Rojo', tienda_id: 2 }];
    assert.strictEqual(R.filaPreseleccionada(dup, 'tienda-2'), null);
});

test('validarCantidad: valor absoluto entero >= 0', () => {
    assert.deepStrictEqual(R.validarCantidad('90'), { valido: true, valor: 90 });
    assert.deepStrictEqual(R.validarCantidad(' 0 '), { valido: true, valor: 0 });
    assert.strictEqual(R.validarCantidad('-5').valido, false);
    assert.strictEqual(R.validarCantidad('').valido, false);
    assert.strictEqual(R.validarCantidad('2.5').valido, false);
});
