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
        if (error.message.includes('bucket') || error.statusCode === 400 || error.message.includes('not found')) {
            throw new Error('Bucket no existe. Crea el bucket "juguetes" en Supabase Storage (público).');
        }
        throw error;
    }

    // Obtener URL pública
    const { data: urlData } = window.supabaseClient.storage
        .from('juguetes')
        .getPublicUrl(rutaArchivo);

    return urlData.publicUrl;
}

// Exportar funciones
window.subirImagen = subirImagen;
window.convertirHeicAJpeg = convertirHeicAJpeg;
window.esHeic = esHeic;









