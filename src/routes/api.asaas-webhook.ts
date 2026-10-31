import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
    .select("id,business_id,status,start_at")
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
  const { data: taken, error: tErr } = await admin
    .from("appointments")
    .select("id")
    .eq("business_id", appt.business_id)
    .eq("start_at", appt.start_at)
    .neq("id", appt.id)
    .in("status", ["confirmed", "showed", "no_show"])
    .limit(1);
  if (tErr) throw new Error(tErr.message);

  if (taken && taken.length) {
    // O prazo desta reserva venceu e outra pessoa já pagou o mesmo horário.
    const { error: cErr } = await admin.from("appointments").update({ status: "canceled" }).eq("id", appt.id).eq("status", "pending");
    if (cErr) throw new Error(cErr.message);
    await setPayment("refund_needed");
    return;
  }

  const { error: uErr } = await admin.from("appointments").update({ status: "confirmed", deposit_paid: true }).eq("id", appt.id).eq("status", "pending");
  if (uErr) throw new Error(uErr.message);
  await setPayment("paid");
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

        let body: { event?: unknown; payment?: { id?: unknown } };
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const event = typeof body?.event === "string" ? body.event : "";
        const paymentId = typeof body?.payment?.id === "string" ? body.payment.id : "";

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
