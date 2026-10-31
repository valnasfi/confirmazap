import { createClient } from "@supabase/supabase-js";

const url = import.meta.env['VITE_SUPABASE_URL'] || "https://placeholder.supabase.co";
const anon = import.meta.env['VITE_SUPABASE_ANON_KEY'] || "placeholder";

export const supabaseConfigured = Boolean(
  import.meta.env['VITE_SUPABASE_URL'] && import.meta.env['VITE_SUPABASE_ANON_KEY'],
);

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: typeof window !== "undefined",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type Business = {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  asaas_api_key?: string | null;
  settings?: Record<string, unknown>;
  status?: "active" | "suspended";
  suspended_reason?: string | null;
};
export type Service = {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  deposit_value: number;
  active: boolean;
};
