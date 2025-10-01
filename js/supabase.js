// Configuración de Supabase
const SUPABASE_URL = 'https://uytbiygaxxephyxsugak.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dGJpeWdheHhlcGh5eHN1Z2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNTAyNTQsImV4cCI6MjA3NDkyNjI1NH0.n1I90voKeNxv_5LuHpbSyql2eNAC04ipqqGMXH6r2bo';

// Inicializar cliente de Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exportar para uso en otros archivos
window.supabaseClient = supabaseClient;

