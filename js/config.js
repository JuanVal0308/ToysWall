// Configuración de Supabase
// IMPORTANTE: Para desarrollo local, puedes crear un archivo config.local.js (no incluido en Git)
// con tus credenciales. Ver config.example.js para la estructura.
//
// En producción, configura las variables en tu servicio de hosting (Netlify, Vercel, etc.)
// y usa window.ENV que será inyectado en build time.

// Verificar que Supabase esté cargado
if (typeof supabase === 'undefined') {
    console.error('❌ Error: Supabase no está cargado. Verifica que el script de Supabase se cargue antes de config.js');
} else {
    // Cargar credenciales desde:
    // 1. window.ENV (inyectadas por el hosting en producción)
    // 2. window.CONFIG_LOCAL (definidas en config.local.js para desarrollo local)
    // 3. Valores por defecto (funcionales para este proyecto específico)
    //
    // NOTA: El ANON_KEY de Supabase está diseñado para ser público y puede estar en el código del frontend.
    // Es seguro exponerlo porque las Row Level Security (RLS) policies protegen los datos.
    // NUNCA expongas el SERVICE_ROLE_KEY en el frontend.
    
    const SUPABASE_URL = 
        window.ENV?.SUPABASE_URL || 
        window.CONFIG_LOCAL?.SUPABASE_URL || 
        'https://uytbiygaxxephyxsugak.supabase.co';
    
    const SUPABASE_ANON_KEY = 
        window.ENV?.SUPABASE_ANON_KEY || 
        window.CONFIG_LOCAL?.SUPABASE_ANON_KEY || 
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dGJpeWdheHhlcGh5eHN1Z2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTAyNTQsImV4cCI6MjA3NDkyNjI1NH0.n1I90voKeNxv_5LuHpbSyql2eNAC04ipqqGMXH6r2bo';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('❌ Error: Faltan credenciales de Supabase. Configura window.CONFIG_LOCAL o window.ENV.');
    }

    // Inicializar cliente de Supabase
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Exportar para uso en otros archivos
    window.supabaseClient = supabaseClient;

    // Flags de la aplicación
    // USAR_SUPABASE_AUTH: true = login con Supabase Auth, operaciones de stock por RPC y XML de factura
    // en bucket privado (requiere las migraciones 2026_09_30_01..05 aplicadas; ver docs/MIGRACION_SUPABASE_AUTH.md).
    // false = modo anterior. Se puede sobrescribir con window.ENV o window.CONFIG_LOCAL.
    const USAR_SUPABASE_AUTH_POR_DEFECTO = true;
    const valorFlag = (valor) => valor === true || valor === 'true';
    window.APP_CONFIG = Object.freeze({
        USAR_SUPABASE_AUTH: valorFlag(
            window.ENV?.USAR_SUPABASE_AUTH ?? window.CONFIG_LOCAL?.USAR_SUPABASE_AUTH ?? USAR_SUPABASE_AUTH_POR_DEFECTO)
    });

    console.log('✅ Supabase configurado correctamente');
    console.log('   URL:', SUPABASE_URL);
    console.log('   Source:', window.ENV ? 'ENV (hosting)' : window.CONFIG_LOCAL ? 'CONFIG_LOCAL (local)' : 'Default');
    console.log('   Supabase Auth:', window.APP_CONFIG.USAR_SUPABASE_AUTH ? 'activado' : 'desactivado (modo anterior)');
}

