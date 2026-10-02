const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../js/dominio/servicios/ReglasInventarioUbicacion.js');

const productos = [
    { codigo: 'A', nombre: 'Carro', cantidadTotal: 15, ubicaciones: [
        { tipo: 'tienda', id: 7, cantidad: 5, registro: true },
        { tipo: 'bodega', id: 1, cantidad: 10, registro: true },
        { tipo: 'tienda', id: 1, cantidad: 0, registro: false } ] },
    { codigo: 'B', nombre: 'Muñeca', cantidadTotal: 0, ubicaciones: [
        { tipo: 'tienda', id: 7, cantidad: 0, registro: true },
        { tipo: 'bodega', id: 1, cantidad: 0, registro: false } ] },
    { codigo: 'C', nombre: 'Pelota', cantidadTotal: 3, ubicaciones: [
        { tipo: 'tienda', id: 1, cantidad: 3, registro: true } ] }
];
const tiendas = [{ id: 1, nombre: 'San andresito' }, { id: 7, nombre: 'San victoriano' }];
const bodegas = [{ id: 1, nombre: 'Santa Isabel' }];

test('general: todos los productos con su total', () => {
    const r = R.filtrar(productos, 'general');
    assert.deepEqual(r.map(p => [p.codigo, p.cantidadMostrada]), [['A', 15], ['B', 0], ['C', 3]]);
    assert.equal(R.total(r), 18);
});

test('tienda: solo productos con fila en esa tienda y su cantidad allí', () => {
    const r = R.filtrar(productos, 'tienda-7');
    assert.deepEqual(r.map(p => [p.codigo, p.cantidadMostrada]), [['A', 5], ['B', 0]]);
    assert.equal(R.total(r), 5);
});

test('las ubicaciones de relleno (sin fila) no cuentan; tienda 1 y bodega 1 no se confunden', () => {
    assert.deepEqual(R.filtrar(productos, 'tienda-1').map(p => p.codigo), ['C']);
    assert.deepEqual(R.filtrar(productos, 'bodega-1').map(p => [p.codigo, p.cantidadMostrada]), [['A', 10]]);
});

test('no modifica los productos originales', () => {
    R.filtrar(productos, 'tienda-7');
    assert.equal(productos[0].cantidadMostrada, undefined);
});

test('claves y descripción', () => {
    assert.equal(R.clave('bodega', 1), 'bodega-1');
    assert.deepEqual(R.parsearClave('tienda-7'), { tipo: 'tienda', id: 7 });
    assert.equal(R.parsearClave('general'), null);
    assert.equal(R.parsearClave('tienda-x'), null);
    assert.equal(R.describir('tienda-7', tiendas, bodegas), 'Tienda San victoriano');
    assert.equal(R.describir('bodega-1', tiendas, bodegas), 'Bodega Santa Isabel');
    assert.equal(R.describir('general', tiendas, bodegas), null);
});
