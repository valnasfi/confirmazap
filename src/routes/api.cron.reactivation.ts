import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { uazapi } from "@/lib/uazapi";
import { DEFAULT_REACTIVATION_MESSAGE, renderReactivation, type ReactivationSettings } from "@/lib/birthday";
import { asUtc, siteUrl, toWaNumber } from "@/lib/manage.core";
import { getEntitlements } from "@/lib/plans.core";

// Chamado de hora em hora pelo agendador do Supabase (veja supabase-reativacao.sql).
// Envia "sentimos sua falta" a quem já foi atendido, não volta há X dias e não tem horário marcado.
// No máximo 1 mensagem por cliente a cada 90 dias. Só entre 10h e 19h de Brasília. Quem respondeu SAIR não recebe.
const FROM_HOUR = 10;
const TO_HOUR = 19;
const MAX_PER_RUN = 30;
const COOLDOWN_DAYS = 90;
const DEFAULT_DAYS = 60;

async function run() {
  const nowBr = new Date(Date.now() - 3 * 3600_000);
  const hour = nowBr.getUTCHours();
  if (hour < FROM_HOUR || hour >= TO_HOUR) return { sent: 0, skipped: "fora do horário de envio" };
  const today = nowBr.toISOString().slice(0, 10);
  const now = Date.now();

  const admin = getSupabaseAdmin();
  const { data: businesses, error } = await admin.from("businesses").select("id,name,slug,settings").or("status.is.null,status.neq.suspended");
  if (error) throw new Error(error.message);

  let sent = 0, failed = 0;
  for (const b of businesses ?? []) {
    if (sent >= MAX_PER_RUN) break;
    const cfg = ((b.settings ?? {}) as { reactivation?: ReactivationSettings }).reactivation;
    if (!cfg?.enabled) continue;
    const days = Number.isFinite(Number(cfg.days)) && Number(cfg.days) >= 15 ? Number(cfg.days) : DEFAULT_DAYS;

    const { data: conn } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", b.id).maybeSingle();
    if (!conn) continue;
    const ent = await getEntitlements(admin, b.id);
    if (ent.expired || !ent.limits.reactivation) continue; // recurso do plano Pro (e do teste)

    // Última visita e se já existe horário futuro, por cliente.
    const { data: appts } = await admin.from("appointments").select("customer_id,start_at,status").eq("business_id", b.id).in("status", ["confirmed", "showed"]).limit(10000);
    const lastVisit = new Map<string, number>();
    const hasFuture = new Set<string>();
    for (const a of appts ?? []) {
      if (!a.customer_id) continue;
      const t = new Date(asUtc(a.start_at)).getTime();
      if (t > now) hasFuture.add(a.customer_id);
      else if (t > (lastVisit.get(a.customer_id) ?? 0)) lastVisit.set(a.customer_id, t);
    }
    const cutoff = now - days * 86400_000;
    const dueIds = [...lastVisit.entries()].filter(([id, t]) => t <= cutoff && !hasFuture.has(id)).map(([id]) => id);
    if (!dueIds.length) continue;

    const { data: recent } = await admin.from("reactivation_messages").select("customer_id").eq("business_id", b.id).gte("sent_at", new Date(now - COOLDOWN_DAYS * 86400_000).toISOString());
    const contacted = new Set((recent ?? []).map((r) => r.customer_id as string));

    const { data: customers } = await admin.from("customers").select("id,name,whatsapp,marketing_opt_out").eq("business_id", b.id).in("id", dueIds);
    const link = `${siteUrl()}/agendar/${b.slug}`;

    for (const c of customers ?? []) {
      if (sent >= MAX_PER_RUN) break;
      if (c.marketing_opt_out || contacted.has(c.id)) continue;
      const number = toWaNumber(c.whatsapp);
      if (!number) continue;

      // Reserva antes de enviar (única por cliente por dia): duas execuções ao mesmo tempo não repetem.
      const { error: claimErr } = await admin.from("reactivation_messages").insert({ business_id: b.id, customer_id: c.id, sent_on: today });
      if (claimErr) continue;

      const text = renderReactivation(cfg.message?.trim() || DEFAULT_REACTIVATION_MESSAGE, c.name, b.name, link);
      try {
        const r = await uazapi("/send/text", { token: conn.instance_token, body: { number, text } });
        if (!r.ok) throw new Error(String(r.status));
        sent++;
      } catch {
        failed++;
        await admin.from("reactivation_messages").delete().eq("customer_id", c.id).eq("sent_on", today);
      }
    }
  }
  return { sent, failed };
}

export const Route = createFileRoute("/api/cron/reactivation")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(await run());
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
