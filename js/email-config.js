// Configuración de EmailJS para envío de facturas
// IMPORTANTE: Para desarrollo local, las credenciales se cargan desde config.local.js
// En producción, se inyectan desde variables de entorno del hosting
// 
// INSTRUCCIONES PARA CONFIGURAR:
// 1. Ve a https://www.emailjs.com/ y crea una cuenta gratuita
// 2. Crea un servicio de correo (Gmail, Outlook, etc.)
// 3. Crea una plantilla de correo con las variables: {{to_name}}, {{to_email}}, {{factura_codigo}}, {{factura_total}}, {{message_html}}
// 4. Configura las credenciales en config.local.js (desarrollo) o en tu hosting (producción)

const EMAILJS_CONFIG = {
    SERVICE_ID: window.ENV?.EMAILJS_SERVICE_ID || window.CONFIG_LOCAL?.EMAILJS_SERVICE_ID || 'service_ay0r3l6',
    TEMPLATE_ID: window.ENV?.EMAILJS_TEMPLATE_ID || window.CONFIG_LOCAL?.EMAILJS_TEMPLATE_ID || 'template_vhu8een',
    PUBLIC_KEY: window.ENV?.EMAILJS_PUBLIC_KEY || window.CONFIG_LOCAL?.EMAILJS_PUBLIC_KEY || 'hGS6b__aNncP_gKTJ',
    FROM_EMAIL: window.ENV?.FROM_EMAIL || window.CONFIG_LOCAL?.FROM_EMAIL || 'toyswalls@gmail.com',
    FROM_NAME: window.ENV?.FROM_NAME || window.CONFIG_LOCAL?.FROM_NAME || 'ToysWalls'
};

// Inicializar EmailJS cuando esté disponible
// Nota: EmailJS se inicializa cuando se carga el script
// Si emailjs ya está disponible, inicializarlo ahora
if (typeof emailjs !== 'undefined') {
    try {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        console.log('EmailJS inicializado correctamente');
    } catch (error) {
        console.warn('EmailJS ya estaba inicializado o error:', error);
    }
} else {
    // Si emailjs aún no está cargado, esperar a que se cargue
    window.addEventListener('load', function() {
        if (typeof emailjs !== 'undefined') {
            try {
                emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
                console.log('EmailJS inicializado después de cargar la página');
            } catch (error) {
                console.warn('Error al inicializar EmailJS:', error);
            }
        }
    });
}

// Exportar configuración
window.EMAILJS_CONFIG = EMAILJS_CONFIG;

