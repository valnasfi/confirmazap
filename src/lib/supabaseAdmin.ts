import { createClient } from "@supabase/supabase-js";

// Somente servidor: chame dentro de handlers de server functions.
export function getSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
