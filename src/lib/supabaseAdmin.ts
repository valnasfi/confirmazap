import { createClient } from "@supabase/supabase-js";

// Somente servidor: chame dentro de handlers de server functions.
export function getSupabaseAdmin() {
  // A URL é pública: se não houver variável de servidor, usa a do build (.env).
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  // A chave secreta NUNCA vai para o repositório: cadastre em Settings > Secrets do Lovable.
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url) throw new Error("SUPABASE_URL não configurada");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada (cadastre em Settings > Secrets)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
