// Ejemplo de configuración local para desarrollo
// INSTRUCCIONES:
// 1. Copia este archivo como config.local.js
// 2. Reemplaza los valores con tus credenciales
// 3. config.local.js está en .gitignore y NO se subirá a Git
//
// Este archivo es solo un ejemplo y está incluido en el repositorio.

window.CONFIG_LOCAL = {
    // Supabase
    SUPABASE_URL: 'https://tu-proyecto.supabase.co',
    SUPABASE_ANON_KEY: 'tu-anon-key-aqui',

    // true = login con Supabase Auth y operaciones de stock por RPC (requiere migraciones 2026_09_30_*)
    USAR_SUPABASE_AUTH: false,
    
    // EmailJS (opcional - para envío de facturas)
    EMAILJS_SERVICE_ID: 'tu-service-id',
    EMAILJS_TEMPLATE_ID: 'tu-template-id',
    EMAILJS_PUBLIC_KEY: 'tu-public-key',
    
    // Email
    FROM_EMAIL: 'toyswalls@gmail.com',
    FROM_NAME: 'ToysWalls'
};
