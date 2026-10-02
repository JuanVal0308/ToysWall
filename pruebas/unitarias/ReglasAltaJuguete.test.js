const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../js/dominio/servicios/ReglasAltaJuguete.js');

const filaBodega = {
    id: 10, codigo: '2', nombre: 'AUTOMÓVIL DE CARRERAS CR POWER RACING DRIVER', cantidad: 192,
    tienda_id: null, bodega_id: 1, item: '552-61', foto_url: 'https://i.imgur.com/x.jpg',
    precio_min: 45000, precio_por_mayor: 38000, numero_bultos: 4, cantidad_por_bulto: 48
};
const base = { codigo: '2', cantidad: 5, tipoUbicacion: 'tienda', ubicacionId: '7', empresaId: 1, campos: {} };

test('código existente en otra ubicación: crea la fila de la tienda con los datos compartidos', () => {
    // El formulario capitaliza el nombre ("Automóvil de carreras...") y antes eso se rechazaba
    const plan = R.planificar([filaBodega], { ...base, nombre: 'Automóvil de carreras cr power racing driver' });
    assert.equal(plan.accion, 'crear');
    assert.equal(plan.existiaEnOtraUbicacion, true);
    assert.equal(plan.cantidad, 5);
    assert.deepEqual(plan.registro, {
        nombre: filaBodega.nombre, codigo: '2', cantidad: 5, empresa_id: 1, tienda_id: 7,
        item: '552-61', foto_url: 'https://i.imgur.com/x.jpg', precio_min: 45000, precio_por_mayor: 38000,
        numero_bultos: 4, cantidad_por_bulto: 48
    });
});

test('los valores escritos en el formulario tienen prioridad; los vacíos no pisan los existentes', () => {
    const plan = R.planificar([filaBodega], {
        ...base, nombre: filaBodega.nombre, campos: { precio_min: 50000, item: '', foto_url: null, numero_bultos: NaN }
    });
    assert.equal(plan.registro.precio_min, 50000);
    assert.equal(plan.registro.item, '552-61');
    assert.equal(plan.registro.numero_bultos, 4);
});

test('código ya presente en esa ubicación: suma a esa fila', () => {
    const filaTienda = { ...filaBodega, id: 11, tienda_id: 7, bodega_id: null, cantidad: 3 };
    const plan = R.planificar([filaBodega, filaTienda], { ...base, nombre: 'automovil de carreras  cr power racing driver', campos: { precio_min: 46000 } });
    assert.equal(plan.accion, 'sumar');
    assert.equal(plan.fila.id, 11);
    assert.equal(plan.cantidad, 5);
    assert.deepEqual(plan.actualizar, { precio_min: 46000 });
});

test('misma id numérica en tienda y bodega no se confunde', () => {
    const plan = R.planificar([filaBodega], { ...base, ubicacionId: '1', nombre: filaBodega.nombre });
    assert.equal(plan.accion, 'crear');
    assert.equal(plan.registro.tienda_id, 1);
    assert.equal(plan.registro.bodega_id, undefined);
});

test('código con otro nombre: error claro', () => {
    const plan = R.planificar([filaBodega], { ...base, nombre: 'Pelota' });
    assert.equal(plan.accion, 'error');
    assert.match(plan.mensaje, /ya está registrado como "AUTOMÓVIL DE CARRERAS/);
});

test('código nuevo: crea con el nombre ingresado', () => {
    const plan = R.planificar([], { ...base, codigo: 'NUEVO1', nombre: 'Pelota', campos: { precio_min: 1000 } });
    assert.equal(plan.accion, 'crear');
    assert.equal(plan.existiaEnOtraUbicacion, false);
    assert.deepEqual(plan.registro, { nombre: 'Pelota', codigo: 'NUEVO1', cantidad: 5, empresa_id: 1, tienda_id: 7, precio_min: 1000 });
});

test('el código se compara sin distinguir mayúsculas y conserva el original', () => {
    const fila = { ...filaBodega, codigo: 'AB-12' };
    const plan = R.planificar([fila], { ...base, codigo: 'ab-12', nombre: fila.nombre });
    assert.equal(plan.registro.codigo, 'AB-12');
});
