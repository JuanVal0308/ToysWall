// Configuración de Supabase
// IMPORTANTE: Las credenciales deben configurarse en las variables de entorno
// o en un archivo .env (no incluido en el repositorio por seguridad)

// Verificar que Supabase esté cargado
if (typeof supabase === 'undefined') {
    console.error('❌ Error: Supabase no está cargado. Verifica que el script de Supabase se cargue antes de config.js');
} else {
    // Cargar credenciales desde variables de entorno o configuración
    // En producción, estas deben venir de variables de entorno del servidor
    const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://uytbiygaxxephyxsugak.supabase.co';
    const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dGJpeWdheHhlcGh5eHN1Z2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTAyNTQsImV4cCI6MjA3NDkyNjI1NH0.n1I90voKeNxv_5LuHpbSyql2eNAC04ipqqGMXH6r2bo';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('❌ Error: Faltan credenciales de Supabase. Configura las variables de entorno.');
    }

    // Inicializar cliente de Supabase
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Exportar para uso en otros archivos
    window.supabaseClient = supabaseClient;

    console.log('✅ Supabase configurado correctamente');
}

