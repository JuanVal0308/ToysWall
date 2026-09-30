// Pruebas de las reglas puras de importación. Ejecutar: node --test pruebas/unitarias
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../js/dominio/servicios/ReglasImportacionInventario.js');

const contexto = {
    tiendas: [{ id: 1, nombre: 'San Andresito' }, { id: 6, nombre: 'Campín' }],
    bodegas: [{ id: 1, nombre: 'Santa Isabel' }],
    juguetes: [
        { id: 10, codigo: '81', nombre: 'Lanzador', cantidad: 5, tienda_id: 1, bodega_id: null },
        { id: 11, codigo: '81', nombre: 'Lanzador', cantidad: 50, tienda_id: null, bodega_id: 1 }
    ]
};

test('normaliza encabezados con tildes, mayúsculas y sinónimos', () => {
    assert.equal(R.normalizarEncabezado('Código'), 'codigo');
    assert.equal(R.normalizarEncabezado(' Precio Mínimo '), 'precio_min');
    assert.equal(R.normalizarEncabezado('Tipo'), 'tipo_ubicacion');
    assert.equal(R.normalizarEncabezado('Cantidad *'), 'cantidad');
    assert.equal(R.normalizarEncabezado('Columna rara'), null);
});

test('parsea precios en formato colombiano', () => {
    assert.equal(R.parsearPrecio('$ 25.000'), 25000);
    assert.equal(R.parsearPrecio('25.000,50'), 25000.5);
    assert.equal(R.parsearPrecio(28000), 28000);
    assert.equal(R.parsearPrecio('abc'), null);
    assert.equal(R.parsearPrecio(-1), null);
});

test('lee la matriz, ignora filas vacías e informa columnas faltantes', () => {
    const { filas, faltantes, desconocidas } = R.leerMatriz([
        ['Código', 'Nombre', 'Cantidad', 'Otra'],
        ['81', 'Lanzador', 3, 'x'],
        ['', '', '', ''],
        [82, 'Balas', 1, '']
    ]);
    assert.deepEqual(faltantes, ['tipo_ubicacion', 'ubicacion']);
    assert.deepEqual(desconocidas, ['Otra']);
    assert.equal(filas.length, 2);
    assert.equal(filas[1].numeroFila, 4);
    assert.equal(R.normalizarCodigo(filas[1].valores.codigo), '82');
});

test('valida filas y reporta cada error con su número de fila', () => {
    const filas = [
        { numeroFila: 2, valores: { codigo: '81', nombre: 'lanzador', cantidad: 3, tipo_ubicacion: 'Tienda', ubicacion: 'san andresito' } },
        { numeroFila: 3, valores: { codigo: '81', nombre: 'Otro nombre', cantidad: 1, tipo_ubicacion: 'bodega', ubicacion: 'Santa Isabel' } },
        { numeroFila: 4, valores: { codigo: '90', nombre: 'Nuevo', cantidad: 1.5, tipo_ubicacion: 'tienda', ubicacion: 'Campin' } },
        { numeroFila: 5, valores: { codigo: '91', nombre: 'Nuevo 2', cantidad: 2, tipo_ubicacion: 'local', ubicacion: 'x' } },
        { numeroFila: 6, valores: { codigo: '92', nombre: 'Nuevo 3', cantidad: 2, tipo_ubicacion: 'tienda', ubicacion: 'No existe' } },
        { numeroFila: 7, valores: { codigo: '81', nombre: 'Lanzador', cantidad: 4, tipo_ubicacion: 'tienda', ubicacion: 'San Andresito' } },
        { numeroFila: 8, valores: { codigo: '93', nombre: 'Nuevo 4', cantidad: 0, tipo_ubicacion: 'tienda', ubicacion: 'Campín', precio_min: 'mucho' } }
    ];
    const { validas, errores } = R.validar(filas, contexto);
    assert.deepEqual(validas.map(v => v.numeroFila), [2]);
    const porFila = Object.fromEntries(errores.map(e => [e.numeroFila, e.mensajes.join(' | ')]));
    assert.match(porFila[3], /ya existe en el inventario con otro nombre/);
    assert.match(porFila[4], /Cantidad inválida/);
    assert.match(porFila[5], /Tipo de ubicación inválido/);
    assert.match(porFila[6], /no existe/);
    assert.match(porFila[7], /Duplicado.*fila 2/);
    assert.match(porFila[8], /Precio mínimo inválido/);
});

test('planifica actualizar por código + ubicación y crear en ubicaciones nuevas', () => {
    const { validas } = R.validar([
        { numeroFila: 2, valores: { codigo: '81', nombre: 'Lanzador', cantidad: 3, tipo_ubicacion: 'tienda', ubicacion: 'San Andresito' } },
        { numeroFila: 3, valores: { codigo: '81', nombre: 'Lanzador', cantidad: 7, tipo_ubicacion: 'tienda', ubicacion: 'Campín' } }
    ], contexto);
    const reemplazar = R.planificar(validas, contexto.juguetes, 'reemplazar');
    assert.deepEqual(reemplazar.map(p => [p.accion, p.jugueteId, p.cantidadNueva]), [['actualizar', 10, 3], ['crear', undefined, 7]]);
    const sumar = R.planificar(validas, contexto.juguetes, 'sumar');
    assert.equal(sumar[0].cantidadNueva, 8);
    assert.throws(() => R.planificar(validas, contexto.juguetes, 'otro'));
});
