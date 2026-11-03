import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { uazapi } from "@/lib/uazapi";
import { asUtc, manageUrl, reminderText, toWaNumber } from "@/lib/manage.core";
import { getEntitlements } from "@/lib/plans.core";
import { reconcilePending } from "@/lib/payments.core";

// Chamado a cada 15 minutos pelo agendador do Supabase (pg_cron + pg_net). Veja supabase-lembretes.sql.
// Seguro para repetir: cada lembrete (agendamento + tipo) é reservado antes do envio e nunca sai duas vezes.
// Só envia entre 7h e 21h de Brasília.
const FROM_HOUR = 7;
const TO_HOUR = 21;
const MAX_PER_RUN = 80;

type RemindersCfg = { enabled?: boolean; h24?: boolean; h2?: boolean };

// Rede de segurança do sinal: pendentes das últimas 24h cujo Pix já foi pago (aviso do Asaas que não chegou) são confirmados.
async function reconcileRecent() {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await admin.from("appointments").select("id,business_id,asaas_payment_id,status").eq("status", "pending").not("asaas_payment_id", "is", null).gte("created_at", since).limit(50);
  let confirmed = 0;
  for (const a of data ?? []) if (await reconcilePending(admin, a as any)) confirmed++;
  return confirmed;
}

// Limpeza: cobranças de sinal que ficaram "Aguardando" por mais de 1 dia somem da lista. Taxas de falta (agendamento marcado como falta) ficam, pois ainda podem ser pagas.
async function cleanupStalePayments() {
  const admin = getSupabaseAdmin();
  const before = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await admin.from("payments").select("id,appointments(status)").eq("status", "pending").lt("created_at", before).limit(500);
  const ids = (data ?? []).filter((r: any) => r.appointments?.status !== "no_show").map((r: any) => r.id as string);
  if (ids.length === 0) return 0;
  await admin.from("payments").delete().in("id", ids);
  return ids.length;
}

async function run() {
  const reconciled = await reconcileRecent().catch(() => 0);
  const cleaned = await cleanupStalePayments().catch(() => 0);
  const hourBr = new Date(Date.now() - 3 * 3600_000).getUTCHours();
  if (hourBr < FROM_HOUR || hourBr >= TO_HOUR) return { sent: 0, reconciled, cleaned, skipped: "fora do horário de envio" };

  const admin = getSupabaseAdmin();
  const now = Date.now();
  const { data: businesses, error } = await admin.from("businesses").select("id,name,settings").or("status.is.null,status.neq.suspended");
  if (error) throw new Error(error.message);

  let sent = 0, failed = 0;
  const diag = { businesses: 0, semWhatsapp: 0, vencidos: 0, confirmadosNaJanela: 0, semNumero: 0, jaEnviados: 0 };
  for (const b of businesses ?? []) {
    if (sent >= MAX_PER_RUN) break;
    const cfg = (((b.settings ?? {}) as { reminders?: RemindersCfg }).reminders ?? {}) as RemindersCfg;
    if (cfg.enabled === false) continue; // ligado por padrão
    const { data: conn } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", b.id).maybeSingle();
    diag.businesses++;
    if (!conn) { diag.semWhatsapp++; continue; }
    const ent = await getEntitlements(admin, b.id);
    if (ent.expired) { diag.vencidos++; continue; } // teste/assinatura vencidos: sem envios automáticos

    const { data: appts } = await admin
      .from("appointments")
      .select("id,start_at,created_at,manage_token,customers(name,whatsapp),services(name)")
      .eq("business_id", b.id).eq("status", "confirmed")
      .gt("start_at", new Date(now).toISOString())
      .lte("start_at", new Date(now + 25 * 3600_000).toISOString());

    for (const a of (appts ?? []) as any[]) {
      if (sent >= MAX_PER_RUN) break;
      diag.confirmadosNaJanela++;
      const startMs = new Date(asUtc(a.start_at)).getTime();
      const createdMs = new Date(asUtc(a.created_at)).getTime();
      const hoursTo = (startMs - now) / 3600_000;

      // Quem agendou em cima da hora não precisa do lembrete daquele prazo.
      let kind: "24h" | "2h" | null = null;
      // Horário até 8h59: o lembrete "2h antes" cairia antes das 7h, então sai às 7h em ponto (primeira execução do dia), em qualquer plano.
      const earlyBr = new Date(startMs - 3 * 3600_000).getUTCHours() - 2 < FROM_HOUR;
      if (hoursTo <= 2) { if (cfg.h2 !== false && (ent.limits.reminder2h || earlyBr) && createdMs <= startMs - 2 * 3600_000) kind = "2h"; }
      else if (hoursTo <= 24) { if (cfg.h24 !== false && createdMs <= startMs - 24 * 3600_000) kind = "24h"; }
      if (!kind || !a.manage_token) continue;

      const number = toWaNumber(a.customers?.whatsapp);
      if (!number) { diag.semNumero++; continue; }

      // Reserva antes de enviar: se duas execuções se cruzarem, só uma passa.
      const { error: claimErr } = await admin.from("reminders").insert({ appointment_id: a.id, business_id: b.id, kind });
      if (claimErr) { diag.jaEnviados++; continue; }

      const text = reminderText(kind, { name: a.customers?.name, business: b.name, service: a.services?.name ?? "Atendimento", startAt: a.start_at, link: manageUrl(a.manage_token) });
      try {
        const r = await uazapi("/send/text", { token: conn.instance_token, body: { number, text } });
        if (!r.ok) throw new Error(String(r.status));
        sent++;
      } catch {
        failed++;
        await admin.from("reminders").delete().eq("appointment_id", a.id).eq("kind", kind); // tenta de novo no próximo ciclo
      }
    }
  }
  return { sent, failed, reconciled, cleaned, diag };
}

export const Route = createFileRoute("/api/cron/reminders")({
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
