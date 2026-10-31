import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";

// uazapi: o token de ADMIN (UAZAPI_ADMIN_TOKEN) só cria instâncias e nunca sai do servidor.
// Cada negócio usa o token da PRÓPRIA instância, guardado em whatsapp_connections (tabela fechada ao navegador).
const baseUrl = () => (process.env["UAZAPI_BASE_URL"] || "https://zapvnf.uazapi.com").replace(/\/$/, "");

type Call = { method?: "GET" | "POST"; token?: string; admin?: boolean; body?: unknown };

async function uazapi(path: string, o: Call = {}) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (o.admin) {
    const admin = process.env["UAZAPI_ADMIN_TOKEN"];
    if (!admin) throw new Error("UAZAPI_ADMIN_TOKEN não configurado (cadastre em Settings > Secrets)");
    headers["admintoken"] = admin;
  } else if (o.token) headers["token"] = o.token;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${baseUrl()}${path}`, {
    method: o.method ?? (o.body !== undefined ? "POST" : "GET"),
    headers,
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

// Confirma quem está logado e qual é o negócio dele.
async function ownerBusiness(accessToken: string) {
  const admin = getSupabaseAdmin();
  const { data: u } = await admin.auth.getUser(accessToken);
  if (!u.user) throw new Error("Não autenticado");
  const { data: b } = await admin.from("businesses").select("id,name").eq("owner_id", u.user.id).limit(1).maybeSingle();
  if (!b) throw new Error("Negócio não encontrado");
  return { admin, business: b as { id: string; name: string } };
}

const input = z.object({ accessToken: z.string() });

type View = { state: "disconnected" | "connecting" | "connected"; qrcode: string | null; paircode: string | null; phone: string | null; profileName: string | null };

// Traduz a resposta do uazapi (instance.status + status.connected/loggedIn/jid) para algo simples.
function view(j: any): View {
  const inst = j?.instance ?? {};
  const st = j?.status && typeof j.status === "object" ? j.status : j ?? {};
  const connected = Boolean(st.connected && st.loggedIn) || inst.status === "connected";
  const state = connected ? "connected" : inst.status === "connecting" ? "connecting" : "disconnected";
  const jid = st.jid ?? j?.jid;
  const phone = jid && typeof jid === "object" ? (jid.user ?? null) : typeof jid === "string" ? jid.split(/[:@]/)[0] : null;
  const qr = inst.qrcode ? String(inst.qrcode) : null;
  return {
    state,
    qrcode: !connected && qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null,
    paircode: !connected && inst.paircode ? String(inst.paircode) : null,
    phone: connected ? phone : null,
    profileName: connected && inst.profileName ? String(inst.profileName) : null,
  };
}

async function save(admin: ReturnType<typeof getSupabaseAdmin>, businessId: string, v: View) {
  await admin.from("whatsapp_connections").update({ status: v.state, phone: v.phone, profile_name: v.profileName, updated_at: new Date().toISOString() }).eq("business_id", businessId);
}

const tableHint = (msg?: string) =>
  /relation|does not exist|schema cache/i.test(msg ?? "") ? "A tabela do WhatsApp ainda não existe no Supabase. Rode o SQL do WhatsApp e tente de novo." : (msg ?? "Erro desconhecido");

// Cria a instância do negócio (se ainda não existe) e pede o QR Code.
export const whatsappConnect = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({ data }): Promise<View> => {
    const { admin, business } = await ownerBusiness(data.accessToken);
    const { data: row, error } = await admin.from("whatsapp_connections").select("*").eq("business_id", business.id).maybeSingle();
    if (error) throw new Error(tableHint(error.message));

    let token: string = row?.instance_token;
    if (!token) {
      const name = `cz-${business.id.replace(/-/g, "").slice(0, 12)}`;
      const c = await uazapi("/instance/create", { admin: true, body: { name } });
      token = c.json?.token ?? c.json?.instance?.token;
      if (!c.ok || !token) throw new Error(`Não foi possível criar a conexão do WhatsApp (${c.status}). ${c.json?.error ?? c.json?.message ?? ""}`.trim());
      const { error: insErr } = await admin.from("whatsapp_connections").insert({ business_id: business.id, instance_name: name, instance_token: token, status: "disconnected" });
      if (insErr) throw new Error(tableHint(insErr.message));
    }

    const r = await uazapi("/instance/connect", { token, body: {} });
    if (r.status === 409) {
      // Já há um pareamento em andamento: só consulta o estado atual.
      const s = await uazapi("/instance/status", { token });
      const v = view(s.json);
      await save(admin, business.id, v);
      return v;
    }
    if (!r.ok) throw new Error(`O WhatsApp não respondeu (${r.status}). ${r.json?.error ?? r.json?.message ?? ""}`.trim());
    const v = view(r.json);
    await save(admin, business.id, v);
    return v;
  });

// Consulta o estado (a tela chama a cada poucos segundos enquanto espera a leitura do QR).
export const whatsappStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({ data }): Promise<View & { exists: boolean }> => {
    const { admin, business } = await ownerBusiness(data.accessToken);
    const { data: row, error } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", business.id).maybeSingle();
    if (error) throw new Error(tableHint(error.message));
    if (!row) return { exists: false, state: "disconnected", qrcode: null, paircode: null, phone: null, profileName: null };
    const s = await uazapi("/instance/status", { token: row.instance_token });
    if (!s.ok) throw new Error(`Não foi possível consultar o WhatsApp (${s.status}).`);
    const v = view(s.json);
    await save(admin, business.id, v);
    return { exists: true, ...v };
  });

export const whatsappDisconnect = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({ data }) => {
    const { admin, business } = await ownerBusiness(data.accessToken);
    const { data: row } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", business.id).maybeSingle();
    if (!row) return { ok: true };
    const r = await uazapi("/instance/disconnect", { token: row.instance_token, body: {} });
    if (!r.ok) throw new Error(`Não foi possível desconectar (${r.status}).`);
    await save(admin, business.id, { state: "disconnected", qrcode: null, paircode: null, phone: null, profileName: null });
    return { ok: true };
  });

// Manda uma mensagem de teste para o número informado (ou para o próprio número conectado).
export const whatsappSendTest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string(), number: z.string().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { admin, business } = await ownerBusiness(data.accessToken);
    const { data: row } = await admin.from("whatsapp_connections").select("instance_token,phone").eq("business_id", business.id).maybeSingle();
    if (!row) throw new Error("Conecte o WhatsApp primeiro");
    let number = (data.number ?? "").replace(/\D/g, "") || (row.phone ?? "");
    if (number.length === 10 || number.length === 11) number = `55${number}`; // número brasileiro sem DDI
    if (number.length < 12) throw new Error("Informe um número com DDD");
    const r = await uazapi("/send/text", { token: row.instance_token, body: { number, text: `✅ Teste do ConfirmaZap: o WhatsApp de ${business.name} está conectado.` } });
    if (!r.ok) throw new Error(`Não foi possível enviar (${r.status}). ${r.json?.error ?? r.json?.message ?? ""}`.trim());
    return { ok: true, number };
  });
