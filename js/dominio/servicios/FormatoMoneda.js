/**
 * Formato de pesos colombianos: "$28.000", "$1.250.000" (punto de miles, sin decimales).
 *
 * `formatear` y `parsear` son puras. `configurarInput`, `asignar` y `leer` solo manejan el input
 * que se les pasa: muestran el valor formateado y guardan el número en `dataset.numericValue`
 * (lo que ya leen los formularios existentes).
 */
const FormatoMoneda = {
    /** 28000 -> "$28.000"; null/''/NaN -> ''. Redondea a pesos enteros. */
    formatear(valor) {
        if (valor === null || valor === undefined || valor === '') return '';
        const n = typeof valor === 'number' ? valor : this.parsear(valor);
        if (n === null || !Number.isFinite(n)) return '';
        const entero = Math.round(Math.abs(n));
        const conPuntos = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (n < 0 && entero !== 0 ? '-$' : '$') + conPuntos;
    },

    /**
     * Texto -> número entero de pesos, o null si no hay dígitos.
     * Acepta "$28.000", "28000", "1.250.000", "28.000,50" y el formato de la BD "28000.00"
     * (el sufijo decimal de 1 o 2 cifras se descarta).
     */
    parsear(texto) {
        if (texto === null || texto === undefined) return null;
        if (typeof texto === 'number') return Number.isFinite(texto) ? Math.round(texto) : null;
        let t = String(texto).trim().replace(/[\s$]/g, '');
        if (t === '') return null;
        const decimal = /[.,](\d{1,2})$/.exec(t);
        let redondeo = 0;
        if (decimal) {
            redondeo = Number(decimal[1].padEnd(2, '0')) >= 50 ? 1 : 0;
            t = t.slice(0, decimal.index);
        }
        const digitos = t.replace(/\D/g, '');
        if (digitos === '') return decimal ? redondeo : null;
        return parseInt(digitos, 10) + redondeo;
    },

    /** Muestra un valor en el input y guarda el número. */
    asignar(input, valor) {
        if (!input) return;
        const n = this.parsear(valor);
        input.value = n === null ? '' : this.formatear(n);
        input.dataset.numericValue = n === null ? '' : String(n);
    },

    /** Número guardado en el input (o null si está vacío). */
    leer(input) {
        if (!input) return null;
        // Un campo vacío es vacío aunque quede un número viejo en data-* (p. ej. tras form.reset())
        if (String(input.value ?? '').trim() === '') return null;
        const guardado = input.dataset.numericValue;
        if (guardado !== undefined && guardado !== '' && /^\d+$/.test(guardado)) return parseInt(guardado, 10);
        return this.parsear(input.value);
    },

    /** Formatea el input mientras se escribe. Se puede llamar varias veces sin duplicar eventos. */
    configurarInput(input) {
        if (!input || input.dataset.formatoMoneda === '1') return;
        input.dataset.formatoMoneda = '1';
        if (input.type === 'number') input.type = 'text';
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('autocomplete', 'off');
        const alEscribir = () => {
            // Mientras se escribe solo valen dígitos (no hay centavos)
            const digitos = String(input.value || '').replace(/\D/g, '');
            if (digitos === '') {
                input.value = '';
                input.dataset.numericValue = '';
                return;
            }
            const n = parseInt(digitos, 10);
            input.dataset.numericValue = String(n);
            input.value = this.formatear(n);
        };
        input.addEventListener('input', alEscribir);
        input.addEventListener('blur', () => {
            if (String(input.value || '').trim() !== '') alEscribir();
        });
    }
};

if (typeof window !== 'undefined') window.FormatoMoneda = FormatoMoneda;
if (typeof module !== 'undefined') module.exports = FormatoMoneda;
