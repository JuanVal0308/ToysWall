const test = require('node:test');
const assert = require('node:assert');
const F = require('../../js/dominio/servicios/FormatoMoneda');

test('formatear: pesos colombianos con punto de miles', () => {
    assert.strictEqual(F.formatear(28000), '$28.000');
    assert.strictEqual(F.formatear(23900), '$23.900');
    assert.strictEqual(F.formatear(5000), '$5.000');
    assert.strictEqual(F.formatear(999), '$999');
    assert.strictEqual(F.formatear(0), '$0');
    assert.strictEqual(F.formatear(1250000), '$1.250.000');
    assert.strictEqual(F.formatear(99999999), '$99.999.999');
    assert.strictEqual(F.formatear('28000.00'), '$28.000');
    assert.strictEqual(F.formatear(null), '');
    assert.strictEqual(F.formatear(''), '');
});

test('parsear: vuelve a número', () => {
    assert.strictEqual(F.parsear('$28.000'), 28000);
    assert.strictEqual(F.parsear('$1.250.000'), 1250000);
    assert.strictEqual(F.parsear('1250000'), 1250000);
    assert.strictEqual(F.parsear('28000.00'), 28000);
    assert.strictEqual(F.parsear('28.000,50'), 28001);
    assert.strictEqual(F.parsear(' $ 23.900 '), 23900);
    assert.strictEqual(F.parsear(28000), 28000);
    assert.strictEqual(F.parsear(''), null);
    assert.strictEqual(F.parsear('$'), null);
    assert.strictEqual(F.parsear(null), null);
});

test('ida y vuelta para valores grandes', () => {
    for (const n of [1, 1000, 28000, 1000000, 1250000, 12345678, 99999999]) {
        assert.strictEqual(F.parsear(F.formatear(n)), n);
    }
});

test('asignar/leer con un input simulado', () => {
    const input = { value: '', dataset: {} };
    F.asignar(input, '1250000.00');
    assert.strictEqual(input.value, '$1.250.000');
    assert.strictEqual(F.leer(input), 1250000);
    F.asignar(input, null);
    assert.strictEqual(input.value, '');
    assert.strictEqual(F.leer(input), null);
    const reseteado = { value: '', dataset: { numericValue: '5000' } };
    assert.strictEqual(F.leer(reseteado), null);
    const sinDataset = { value: '$23.900', dataset: {} };
    assert.strictEqual(F.leer(sinDataset), 23900);
});
