import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { uazapi } from "@/lib/uazapi";
import { DEFAULT_BIRTHDAY_MESSAGE, renderBirthday, type BirthdaySettings } from "@/lib/birthday";

// Chamado de hora em hora pelo agendador do Supabase (pg_cron + pg_net). Veja supabase-aniversarios.sql.
// É seguro repetir: cada cliente recebe no máximo 1 mensagem por ano (tabela birthday_messages, única por cliente+ano),
// e nada é enviado antes das 9h de Brasília.
const SEND_FROM_HOUR = 9;
const MAX_PER_RUN = 60;

async function run() {
  const nowBr = new Date(Date.now() - 3 * 3600_000); // campos UTC deste objeto = relógio de Brasília
  if (nowBr.getUTCHours() < SEND_FROM_HOUR) return { sent: 0, skipped: "antes das 9h" };
  const month = nowBr.getUTCMonth() + 1;
  const day = nowBr.getUTCDate();
  const year = nowBr.getUTCFullYear();

  const admin = getSupabaseAdmin();
  const { data: businesses, error } = await admin.from("businesses").select("id,name,settings").or("status.is.null,status.neq.suspended");
  if (error) throw new Error(error.message);

  let sent = 0, failed = 0;
  for (const b of businesses ?? []) {
    const cfg = ((b.settings ?? {}) as { birthday?: BirthdaySettings }).birthday;
    if (!cfg?.enabled) continue;
    if (sent >= MAX_PER_RUN) break;

    const { data: conn } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", b.id).maybeSingle();
    if (!conn) continue; // WhatsApp ainda não conectado

    // marketing_opt_out só existe depois do SQL da reativação: sem a coluna, ninguém está bloqueado.
    let cr = await admin.from("customers").select("id,name,whatsapp,birth_date,marketing_opt_out").eq("business_id", b.id).not("birth_date", "is", null);
    if (cr.error) cr = (await admin.from("customers").select("id,name,whatsapp,birth_date").eq("business_id", b.id).not("birth_date", "is", null)) as typeof cr;
    const customers = (cr.data ?? []) as Array<{ id: string; name: string | null; whatsapp: string; birth_date: string; marketing_opt_out?: boolean | null }>;
    const today = customers.filter((c) => {
      if (c.marketing_opt_out) return false;
      const [, m, d] = String(c.birth_date).split("-").map(Number);
      return m === month && d === day;
    });

    for (const c of today) {
      if (sent >= MAX_PER_RUN) break;
      let number = String(c.whatsapp ?? "").replace(/\D/g, "");
      if (number.length === 10 || number.length === 11) number = `55${number}`;
      if (number.length < 12) continue;

      // Reserva o envio antes de mandar: se duas execuções se cruzarem, só uma passa.
      const { error: claimErr } = await admin.from("birthday_messages").insert({ business_id: b.id, customer_id: c.id, year });
      if (claimErr) continue; // já enviado neste ano (ou tabela ausente)

      const text = renderBirthday(cfg.message?.trim() || DEFAULT_BIRTHDAY_MESSAGE, c.name, b.name);
      try {
        const r = await uazapi("/send/text", { token: conn.instance_token, body: { number, text } });
        if (!r.ok) throw new Error(String(r.status));
        sent++;
      } catch {
        failed++;
        await admin.from("birthday_messages").delete().eq("customer_id", c.id).eq("year", year); // tenta de novo na próxima hora
      }
    }
  }
  return { sent, failed };
}

export const Route = createFileRoute("/api/cron/birthdays")({
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
