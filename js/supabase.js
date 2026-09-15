// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================
// 1. Reemplaza los valores de abajo con los de tu proyecto Supabase.
// 2. Ve a: Supabase Dashboard > Project Settings > API
//    - Project URL       -> SUPABASE_URL
//    - anon / public key -> SUPABASE_ANON_KEY
//
// IMPORTANTE: Nunca coloques la "service_role key" aquí.
// ============================================================

const SUPABASE_URL = "https://vkfjmfuhggakkgdjzuox.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZmptZnVoZ2dha2tnZGp6dW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTg0MjksImV4cCI6MjEwNTA3NDQyOX0.2t6PhZiH_v4Nsl_Q8-oxXuE5h_dqCmZR89aQ7qwv0i4";

// El SDK de Supabase se carga vía CDN en cada HTML (ver <script> en index.html / login.html)
// window.supabase es el objeto global inyectado por el CDN.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
