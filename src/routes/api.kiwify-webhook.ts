import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { applyKiwify, parseKiwify } from "@/lib/kiwify.core";

// Webhook da Kiwify. URL: https://reservapix.vip/api/kiwify-webhook
// A Kiwify assina o corpo com HMAC-SHA1 (hex) usando o token do webhook e envia em ?signature=. Segredo: KIWIFY_TOKEN.
async function hmacHex(key: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
  return Array.from(sig).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const Route = createFileRoute("/api/kiwify-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["KIWIFY_TOKEN"];
        if (!token) return new Response("KIWIFY_TOKEN não configurado", { status: 500 });
        const raw = await request.text();
        const given = (new URL(request.url).searchParams.get("signature") ?? "").toLowerCase();
        if (!safeEqual(given, await hmacHex(token, raw))) return new Response("unauthorized", { status: 401 });
        let body: unknown;
        try { body = JSON.parse(raw); } catch { return new Response("invalid json", { status: 400 }); }
        const change = parseKiwify(body);
        if (!change) return new Response("ignored", { status: 200 });
        try {
          const r = await applyKiwify(getSupabaseAdmin(), change);
          return new Response(r, { status: 200 });
        } catch (e) {
          console.error("kiwify-webhook", (e as Error).message);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
