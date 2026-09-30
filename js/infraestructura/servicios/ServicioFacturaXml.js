/**
 * Subida del XML de facturas a Supabase Storage — capa de INFRAESTRUCTURA.
 *
 * Bucket "facturas" (migración 2026_09_30_05): privado, solo XML, máx. 1 MB.
 * Con Supabase Auth (APP_CONFIG.USAR_SUPABASE_AUTH = true) el enlace del correo es una URL
 * firmada con vigencia limitada y la ruta se guarda en facturas.xml_path. En el modo anterior
 * se intenta la URL pública (como antes), pero el error real se informa en vez de ignorarse.
 */
class ServicioFacturaXml {
    /**
     * @param {Object} clienteSupabase
     * @param {{usarBucketPrivado: boolean}} opciones
     */
    constructor(clienteSupabase, { usarBucketPrivado = false } = {}) {
        this.cliente = clienteSupabase;
        this.usarBucketPrivado = usarBucketPrivado;
    }

    static get BUCKET() {
        return 'facturas';
    }

    /** Vigencia del enlace firmado del correo (30 días). */
    static get VIGENCIA_ENLACE_SEGUNDOS() {
        return 60 * 60 * 24 * 30;
    }

    /** Ruta dentro del bucket: <codigo_factura>_<timestamp>.xml (sin prefijo de carpeta repetido). */
    static rutaArchivo(codigoFactura, marcaTiempo = Date.now()) {
        const codigo = String(codigoFactura || 'factura').replace(/[^A-Za-z0-9_-]/g, '_');
        return `${codigo}_${marcaTiempo}.xml`;
    }

    /**
     * Sube el XML. Nunca lanza: devuelve el resultado para poder informar el estado real.
     * @returns {Promise<{ok: boolean, ruta: string|null, url: string|null, motivo: string|null}>}
     */
    async subir(codigoFactura, contenidoXml) {
        const ruta = ServicioFacturaXml.rutaArchivo(codigoFactura);
        try {
            // El tipo del Blob es el que valida el bucket (allowed_mime_types): sin parámetros charset
            const archivo = new Blob([contenidoXml], { type: 'application/xml' });
            const { error } = await this.cliente.storage
                .from(ServicioFacturaXml.BUCKET)
                .upload(ruta, archivo, { contentType: 'application/xml', upsert: false });
            if (error) {
                return { ok: false, ruta: null, url: null, motivo: ServicioFacturaXml.describir(error) };
            }

            const url = await this.obtenerEnlace(ruta);
            return { ok: true, ruta, url, motivo: url ? null : 'el XML se subió pero no se pudo generar el enlace de descarga' };
        } catch (error) {
            return { ok: false, ruta: null, url: null, motivo: ServicioFacturaXml.describir(error) };
        }
    }

    async obtenerEnlace(ruta) {
        const almacen = this.cliente.storage.from(ServicioFacturaXml.BUCKET);
        if (this.usarBucketPrivado) {
            const { data, error } = await almacen.createSignedUrl(ruta, ServicioFacturaXml.VIGENCIA_ENLACE_SEGUNDOS);
            if (error) {
                console.error('No se pudo firmar el enlace del XML:', error);
                return null;
            }
            return data?.signedUrl || null;
        }
        const { data } = almacen.getPublicUrl(ruta);
        return data?.publicUrl || null;
    }

    static describir(error) {
        return typeof window !== 'undefined' && typeof window.describirErrorStorage === 'function'
            ? window.describirErrorStorage(error, ServicioFacturaXml.BUCKET)
            : (error?.message || String(error));
    }
}

if (typeof window !== 'undefined') {
    window.ServicioFacturaXml = ServicioFacturaXml;
    if (window.supabaseClient) {
        window.servicioFacturaXml = new ServicioFacturaXml(window.supabaseClient, {
            usarBucketPrivado: window.APP_CONFIG?.USAR_SUPABASE_AUTH === true
        });
    }
}
