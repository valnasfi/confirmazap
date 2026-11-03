// uazapi: o token de ADMIN (UAZAPI_ADMIN_TOKEN) só cria instâncias e nunca sai do servidor.
// Cada negócio usa o token da PRÓPRIA instância, guardado em whatsapp_connections (tabela fechada ao navegador).
export const baseUrl = () => (process.env["UAZAPI_BASE_URL"] || "https://zapvnf.uazapi.com").replace(/\/$/, "");

export type Call = { method?: "GET" | "POST"; token?: string; admin?: boolean; body?: unknown };

export async function uazapi(path: string, o: Call = {}) {
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
    body: o.body !== undefined ? JSON.stringify(o.body) : null,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

