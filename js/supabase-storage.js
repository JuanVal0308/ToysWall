// ============================================
// SUPABASE STORAGE - Subida de imágenes
// ============================================
// Las imágenes se suben al bucket 'juguetes' en Supabase Storage
// No requiere configuración de API externa

// Función para convertir HEIC/HEIF a JPEG
async function convertirHeicAJpeg(archivo) {
    try {
        if (typeof heic2any === 'undefined') {
            throw new Error('La librería de conversión HEIC no está cargada');
        }

        const blob = await heic2any({
            blob: archivo,
            toType: 'image/jpeg',
            quality: 0.92
        });

        const blobFinal = Array.isArray(blob) ? blob[0] : blob;
        const nombreArchivo = archivo.name.replace(/\.(heic|heif)$/i, '.jpg');
        return new File([blobFinal], nombreArchivo, { type: 'image/jpeg' });
    } catch (error) {
        throw new Error('Error al convertir HEIC: ' + error.message);
    }
}

// Función para verificar si un archivo es HEIC/HEIF
function esHeic(archivo) {
    const nombre = archivo.name.toLowerCase();
    const tipo = archivo.type.toLowerCase();
    return nombre.endsWith('.heic') || 
           nombre.endsWith('.heif') || 
           tipo === 'image/heic' || 
           tipo === 'image/heif';
}

// Función para generar nombre único
function generarNombreUnico(archivo) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = archivo.name.split('.').pop().toLowerCase().replace('heic', 'jpg').replace('heif', 'jpg');
    return `juguete_${timestamp}_${random}.${extension}`;
}

/**
 * Traduce un error de Supabase Storage a un mensaje claro para el usuario.
 * @param {Object} error - Error devuelto por supabase.storage
 * @param {string} bucket - Nombre del bucket
 * @returns {string}
 */
function describirErrorStorage(error, bucket) {
    const mensaje = (error && (error.message || error.error)) || String(error || 'error desconocido');
    const estado = String((error && (error.statusCode || error.status)) || '');
    if (/bucket not found/i.test(mensaje)) {
        return `el bucket "${bucket}" no existe en Supabase Storage (aplica migrations/2026_09_30_05_storage_facturas.sql)`;
    }
    if (/row-level security|unauthorized|not authorized|permission/i.test(mensaje) || estado === '403' || estado === '401') {
        return `sin permiso para subir al bucket "${bucket}" (inicia sesión con Supabase Auth y revisa las políticas de Storage)`;
    }
    if (/mime|content.type/i.test(mensaje) || estado === '415') {
        return `tipo de archivo no permitido en el bucket "${bucket}" (${mensaje})`;
    }
    if (/exceeded|too large|size/i.test(mensaje) || estado === '413') {
        return `el archivo supera el tamaño máximo del bucket "${bucket}"`;
    }
    if (/failed to fetch|network/i.test(mensaje)) {
        return 'error de conexión con Supabase Storage';
    }
    return mensaje + (estado ? ` (código ${estado})` : '');
}

// Función principal para subir imagen
async function subirImagen(archivo) {
    if (!window.supabaseClient) {
        throw new Error('Supabase no está inicializado');
    }

    // Convertir HEIC a JPEG si es necesario
    let archivoParaSubir = archivo;
    if (esHeic(archivo)) {
        archivoParaSubir = await convertirHeicAJpeg(archivo);
    }

    const nombreArchivo = generarNombreUnico(archivoParaSubir);
    const rutaArchivo = `fotos/${nombreArchivo}`;

    // Subir a Supabase Storage
    const { data, error } = await window.supabaseClient.storage
        .from('juguetes')
        .upload(rutaArchivo, archivoParaSubir, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        // Antes cualquier error 400 se reportaba como "bucket no existe", ocultando la causa real
        throw new Error('No se pudo subir la imagen: ' + describirErrorStorage(error, 'juguetes'));
    }

    // Obtener URL pública
    const { data: urlData } = window.supabaseClient.storage
        .from('juguetes')
        .getPublicUrl(rutaArchivo);

    return urlData.publicUrl;
}

// Exportar funciones
window.subirImagen = subirImagen;
window.describirErrorStorage = describirErrorStorage;
window.convertirHeicAJpeg = convertirHeicAJpeg;
window.esHeic = esHeic;
