// Configuración de Imgur para subida de imágenes
// INSTRUCCIONES:
// 1. Ve a https://api.imgur.com/oauth2/addclient
// 2. Registra una nueva aplicación (tipo: "Anonymous usage without user authorization")
// 3. Copia el Client ID que se genera
// 4. Pégalo abajo

const IMGUR_CONFIG = {
    // ⚠️ IMPORTANTE: Reemplaza 'YOUR_IMGUR_CLIENT_ID' con tu Client ID real de Imgur
    // Para obtenerlo: https://api.imgur.com/oauth2/addclient
    // Tipo de aplicación: "Anonymous usage without user authorization"
    CLIENT_ID: 'YOUR_IMGUR_CLIENT_ID' // 👈 Pega aquí tu Client ID de Imgur
};

// Función para convertir HEIC/HEIF a JPEG
async function convertirHeicAJpeg(archivo) {
    try {
        // Verificar si heic2any está disponible
        if (typeof heic2any === 'undefined') {
            throw new Error('La librería de conversión HEIC no está cargada');
        }

        // Convertir HEIC a JPEG
        const blob = await heic2any({
            blob: archivo,
            toType: 'image/jpeg',
            quality: 0.92 // Calidad alta
        });

        // heic2any puede retornar un array o un blob único
        const blobFinal = Array.isArray(blob) ? blob[0] : blob;
        
        // Convertir blob a File
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

// Función para subir imagen a Imgur
async function subirImagenAImgur(archivo) {
    if (!IMGUR_CONFIG.CLIENT_ID || IMGUR_CONFIG.CLIENT_ID === 'YOUR_IMGUR_CLIENT_ID') {
        throw new Error('Imgur no está configurado. Por favor, configura tu Client ID en js/imgur-config.js');
    }

    // Convertir HEIC a JPEG si es necesario
    let archivoParaSubir = archivo;
    if (esHeic(archivo)) {
        try {
            archivoParaSubir = await convertirHeicAJpeg(archivo);
        } catch (error) {
            throw new Error('Error al convertir HEIC: ' + error.message);
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const base64 = e.target.result;
            
            try {
                const response = await fetch('https://api.imgur.com/3/image', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Client-ID ${IMGUR_CONFIG.CLIENT_ID}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image: base64.split(',')[1], // Remover el prefijo data:image/...
                        type: 'base64'
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    resolve(data.data.link); // Retorna la URL de la imagen
                } else {
                    reject(new Error(data.data?.error || 'Error al subir la imagen a Imgur'));
                }
            } catch (error) {
                reject(new Error('Error al conectar con Imgur: ' + error.message));
            }
        };
        
        reader.onerror = function(error) {
            reject(new Error('Error al leer el archivo: ' + error.message));
        };
        
        reader.readAsDataURL(archivoParaSubir);
    });
}

// Exportar funciones
window.IMGUR_CONFIG = IMGUR_CONFIG;
window.subirImagenAImgur = subirImagenAImgur;
window.convertirHeicAJpeg = convertirHeicAJpeg;
window.esHeic = esHeic;

