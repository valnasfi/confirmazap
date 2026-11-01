import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { uazapi } from "@/lib/uazapi";
import { cancelAppointment, cancelHoursOf, firstName, manageUrl, whenText, withinFreeWindow } from "@/lib/manage.core";

// Respostas dos clientes no WhatsApp (uazapi → este endereço). O webhook é cadastrado sozinho ao conectar o WhatsApp.
// Autenticação: o campo `token` do corpo é o token da instância, que só o servidor conhece (guardado em whatsapp_connections).
// "1" confirma presença, "2" cancela. Qualquer outra conversa é ignorada.

const pick = (...v: unknown[]) => v.find((x) => typeof x === "string" && x.length > 0) as string | undefined;
const digitsOf = (jid: string | undefined) => (jid ? jid.split("@")[0]!.split(":")[0]!.replace(/\D/g, "") : "");

// Variações do mesmo número (com e sem o 9 depois do DDD) como o cadastro guarda: só DDD + número.
function localCandidates(waDigits: string) {
  let n = waDigits.startsWith("55") && waDigits.length >= 12 ? waDigits.slice(2) : waDigits;
  const out = new Set<string>([n]);
  if (n.length === 11 && n[2] === "9") out.add(n.slice(0, 2) + n.slice(3));
  if (n.length === 10) out.add(n.slice(0, 2) + "9" + n.slice(2));
  return [...out];
}

async function handle(body: any) {
  const token: string | undefined = body?.token;
  if (!token) return { status: 401 };
  const admin = getSupabaseAdmin();
  const { data: conn } = await admin.from("whatsapp_connections").select("business_id,instance_token").eq("instance_token", token).maybeSingle();
  if (!conn) return { status: 401 };

  const m = body.message ?? body;
  if (m?.fromMe || m?.isGroup || m?.wasSentByApi) return { status: 200 };
  const content = m?.content;
  const raw = pick(m?.text, typeof content === "string" ? content : undefined, content?.text, content?.conversation) ?? "";
  const answer = raw.replace(/[^\p{L}\p{N}]/gu, "").trim();
  if (answer !== "1" && answer !== "2") return { status: 200 };

  // Quem escreveu: sender_pn traz o telefone mesmo quando o chat vem como @lid.
  const chat = pick(m?.chatid);
  const phoneJid = pick(m?.sender_pn, chat?.endsWith("@s.whatsapp.net") ? chat : undefined, m?.sender);
  const wa = digitsOf(phoneJid);
  if (wa.length < 10) return { status: 200 };

  const businessId: string = conn.business_id;
  const { data: customers } = await admin.from("customers").select("id,name").eq("business_id", businessId).in("whatsapp", localCandidates(wa));
  if (!customers?.length) return { status: 200 };

  // Próximo horário confirmado que já recebeu lembrete.
  const { data: appts } = await admin
    .from("appointments").select("id,start_at,deposit_paid,manage_token,businesses(name,settings)")
    .eq("business_id", businessId).eq("status", "confirmed").in("customer_id", customers.map((c) => c.id))
    .gt("start_at", new Date().toISOString()).order("start_at", { ascending: true }).limit(5);
  let target: any = null;
  for (const a of appts ?? []) {
    const { data: r } = await admin.from("reminders").select("id").eq("appointment_id", a.id).limit(1);
    if (r?.length) { target = a; break; }
  }
  if (!target) return { status: 200 };

  const nome = firstName(customers[0]!.name);
  const biz = target.businesses;
  const link = target.manage_token ? manageUrl(target.manage_token) : "";
  const reply = async (text: string) => { try { await uazapi("/send/text", { token, body: { number: wa, text } }); } catch { /* sem resposta não é crítico */ } };

  if (answer === "1") {
    await admin.from("appointments").update({ customer_confirmed_at: new Date().toISOString() }).eq("id", target.id);
    await reply(`Perfeito, ${nome}! Presença confirmada para ${whenText(target.start_at)}. Até lá! ✅`);
    return { status: 200 };
  }

  const hours = cancelHoursOf(biz?.settings);
  if (!withinFreeWindow(target.start_at, hours)) {
    // Cancelar dentro do prazo perde o sinal: só com aceite explícito, na página do agendamento.
    await reply(`${nome}, faltam menos de ${hours}h para o seu horário, e nesse caso o sinal não é devolvido. Se mesmo assim quiser cancelar, é só acessar: ${link}`);
    return { status: 200 };
  }
  const r = await cancelAppointment(admin, target, hours);
  await reply(`Tudo bem, ${nome}. Seu horário de ${whenText(target.start_at)} foi cancelado.${r.refund ? " O estabelecimento fará a devolução do sinal." : ""} Para marcar outro horário: ${link}`);
  return { status: 200 };
}

export const Route = createFileRoute("/api/uazapi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = null;
        try { body = await request.json(); } catch { return new Response("ok"); }
        try {
          const r = await handle(body);
          return new Response(r.status === 401 ? "unauthorized" : "ok", { status: r.status });
        } catch {
          return new Response("ok"); // sempre 200: o uazapi repete o envio se houver erro
        }
      },
    },
  },
});
