import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { PLANS } from "@/lib/plans";
import { sendBookingConfirmed } from "@/lib/booking-notify";

// Webhook do Asaas: quando o Pix do sinal é pago, o horário é confirmado.
// URL a cadastrar no Asaas: https://SEU-SITE/api/asaas-webhook
// Token de autenticação: o mesmo valor do segredo ASAAS_WEBHOOK_TOKEN (chega no cabeçalho asaas-access-token).

// Eventos do Asaas que significam "dinheiro recebido".
const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Seguro para repetir: o Asaas pode enviar o mesmo evento mais de uma vez.
async function confirmPayment(paymentId: string) {
  const admin = getSupabaseAdmin();
  const setPayment = async (status: string) => {
    const { error } = await admin.from("payments").update({ status }).eq("asaas_payment_id", paymentId);
    if (error) throw new Error(error.message);
  };

  const { data: appt, error } = await admin
    .from("appointments")
    .select("*")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  // Cobrança que não é de nenhum agendamento nosso.
  if (!appt) { await setPayment("paid"); return; }

  // Já confirmado (evento repetido) ou falta/comparecimento: só registra o pagamento.
  if (appt.status === "confirmed" || appt.status === "showed" || appt.status === "no_show") { await setPayment("paid"); return; }

  // Pagou, mas o agendamento já tinha sido cancelado: o sinal precisa ser devolvido.
  if (appt.status === "canceled") { await setPayment("refund_needed"); return; }

  // Pendente: quem paga primeiro fica com o horário.
  let takenQuery = admin
    .from("appointments")
    .select("id")
    .eq("business_id", appt.business_id)
    .eq("start_at", appt.start_at)
    .neq("id", appt.id)
    .in("status", ["confirmed", "showed", "no_show"]);
  if (appt.professional_id) takenQuery = takenQuery.eq("professional_id", appt.professional_id); // outro profissional no mesmo horário não conflita
  const { data: taken, error: tErr } = await takenQuery.limit(1);
  if (tErr) throw new Error(tErr.message);

  if (taken && taken.length) {
    // O prazo desta reserva venceu e outra pessoa já pagou o mesmo horário.
    const { error: cErr } = await admin.from("appointments").update({ status: "canceled" }).eq("id", appt.id).eq("status", "pending");
    if (cErr) throw new Error(cErr.message);
    await setPayment("refund_needed");
    return;
  }

  const { data: changed, error: uErr } = await admin.from("appointments").update({ status: "confirmed", deposit_paid: true }).eq("id", appt.id).eq("status", "pending").select("id");
  if (uErr) throw new Error(uErr.message);
  await setPayment("paid");
  // Só avisa quando esta chamada foi quem confirmou (evento repetido do Asaas não reenvia).
  if (changed && changed.length > 0) await sendBookingConfirmed(admin, appt.id);
}

// Mensalidade dos planos (conta Asaas da plataforma): o pagamento ativa o plano e estende o período.
async function handleSubscriptionPayment(event: string, pay: { subscription: string; dueDate?: string | undefined }) {
  const admin = getSupabaseAdmin();
  const { data: s } = await admin.from("subscriptions").select("*").eq("asaas_subscription_id", pay.subscription).maybeSingle();
  if (!s) return;
  if (PAID_EVENTS.has(event)) {
    const plan = s.pending_plan ?? (s.plan === "starter" || s.plan === "pro" ? s.plan : null);
    if (!plan) return;
    // Cobre um mês a partir do vencimento (mínimo: amanhã). Evento repetido dá o mesmo resultado.
    const due = pay.dueDate ? new Date(`${pay.dueDate}T12:00:00Z`) : new Date();
    const end = new Date(due);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const minEnd = new Date(Date.now() + 86400_000);
    const { error } = await admin.from("subscriptions").update({
      plan, status: "active", price: PLANS[plan as "starter" | "pro"].price,
      current_period_end: (end > minEnd ? end : minEnd).toISOString(), pending_plan: null, invoice_url: null, updated_at: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) throw new Error(error.message);
  } else if (event === "PAYMENT_OVERDUE" && s.status === "active") {
    await admin.from("subscriptions").update({ status: "past_due", updated_at: new Date().toISOString() }).eq("id", s.id);
  }
}

export const Route = createFileRoute("/api/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
        if (!expected) return new Response("ASAAS_WEBHOOK_TOKEN não configurado", { status: 500 });
        if (!safeEqual(request.headers.get("asaas-access-token") ?? "", expected)) {
          return new Response("unauthorized", { status: 401 });
        }

        let body: { event?: unknown; payment?: { id?: unknown; subscription?: unknown; dueDate?: unknown }; subscription?: { id?: unknown } };
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const event = typeof body?.event === "string" ? body.event : "";
        const paymentId = typeof body?.payment?.id === "string" ? body.payment.id : "";

        // Assinatura cancelada na plataforma: o plano vale até o fim do período já pago.
        if (event === "SUBSCRIPTION_DELETED" && typeof body?.subscription?.id === "string") {
          try {
            await getSupabaseAdmin().from("subscriptions").update({ status: "canceled", asaas_subscription_id: null, pending_plan: null, invoice_url: null }).eq("asaas_subscription_id", body.subscription.id).in("status", ["active", "past_due"]);
          } catch (e) { return new Response("erro ao processar", { status: 500 }); }
          return Response.json({ received: true });
        }

        // Cobrança de assinatura da plataforma (tem o campo `subscription`): não é sinal de agendamento.
        if (typeof body?.payment?.subscription === "string" && body.payment.subscription) {
          try {
            await handleSubscriptionPayment(event, { subscription: body.payment.subscription, dueDate: typeof body.payment.dueDate === "string" ? body.payment.dueDate : undefined });
          } catch (e) {
            console.error("asaas-webhook: falha na assinatura", (e as Error).message);
            return new Response("erro ao processar", { status: 500 });
          }
          return Response.json({ received: true });
        }

        // Outros eventos (vencida, estornada etc.) não mudam nada por enquanto: responde 200 para o Asaas não reenviar.
        if (!PAID_EVENTS.has(event) || !paymentId) return Response.json({ received: true });

        try {
          await confirmPayment(paymentId);
        } catch (e) {
          console.error("asaas-webhook: falha ao confirmar pagamento", paymentId, (e as Error).message);
          return new Response("erro ao processar", { status: 500 }); // o Asaas tenta de novo
        }
        return Response.json({ received: true });
      },
    },
  },
});
