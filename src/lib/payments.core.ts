import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { sendBookingConfirmed } from "./booking-notify";

// Confirmação do sinal Pix. Usada pelo webhook do Asaas e também pela conferência direta (reconcile), então
// o horário confirma mesmo que o aviso do Asaas não chegue. Seguro para repetir.
export async function confirmPayment(paymentId: string) {
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

const PAID_STATUS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

function asaasBase() {
  return process.env["ASAAS_ENV"] === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

// Pergunta ao Asaas se o Pix deste agendamento já foi pago e, se sim, confirma o horário.
// Devolve true quando o pagamento está pago. Nunca lança erro.
export async function reconcilePending(admin: SupabaseClient, appt: { id: string; business_id: string; asaas_payment_id?: string | null; status: string }): Promise<boolean> {
  try {
    if (appt.status !== "pending" || !appt.asaas_payment_id) return false;
    const { data: b } = await admin.from("businesses").select("asaas_api_key").eq("id", appt.business_id).maybeSingle();
    const key = (b?.asaas_api_key as string | null) || process.env["ASAAS_API_KEY"];
    if (!key) return false;
    const res = await fetch(`${asaasBase()}/payments/${appt.asaas_payment_id}`, { headers: { access_token: key, "User-Agent": "ReservaPix" } });
    if (!res.ok) return false;
    const pay = await res.json().catch(() => ({}));
    if (!PAID_STATUS.has(String(pay?.status ?? ""))) return false;
    await confirmPayment(appt.asaas_payment_id);
    return true;
  } catch (e) {
    console.error("reconcilePending:", (e as Error).message);
    return false;
  }
}
