import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { uazapi } from "./uazapi";
import { firstName, toWaNumber } from "./manage.core";

function asaasBase() {
  return process.env["ASAAS_ENV"] === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Devolve o sinal Pix pelo Asaas (estorno integral) e avisa o cliente. Só o dono do negócio, só para pagamentos marcados como "Devolver sinal".
export const refundDeposit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string(), paymentId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: u } = await admin.auth.getUser(data.accessToken);
    if (!u.user) throw new Error("Não autenticado");

    const { data: p } = await admin
      .from("payments")
      .select("id,business_id,asaas_payment_id,value,status,customers(name,whatsapp),businesses(name,owner_id,asaas_api_key)")
      .eq("id", data.paymentId)
      .maybeSingle();
    const pay = p as any;
    if (!pay || pay.businesses?.owner_id !== u.user.id) throw new Error("Sem permissão");
    if (pay.status === "refunded") return { ok: true as const, notified: false, already: true as const };
    if (pay.status !== "refund_needed") throw new Error("Este pagamento não está marcado para devolução.");
    if (!pay.asaas_payment_id) throw new Error("Pagamento sem identificação no Asaas. Faça a devolução direto no painel do Asaas.");

    const key = (pay.businesses?.asaas_api_key as string | null) || process.env["ASAAS_API_KEY"];
    if (!key) throw new Error("Chave do Asaas não configurada. Cadastre em Configurações > Plano.");

    const res = await fetch(`${asaasBase()}/payments/${pay.asaas_payment_id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: key, "User-Agent": "ReservaPix" },
      body: JSON.stringify({ description: "Devolução do sinal: agendamento cancelado" }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.errors?.[0]?.description || `Asaas erro ${res.status}`;
      throw new Error(`O Asaas não fez a devolução: ${msg}`);
    }

    await admin.from("payments").update({ status: "refunded" }).eq("id", pay.id);

    // Aviso ao cliente: tentativa única, nunca atrapalha a devolução.
    let notified = false;
    try {
      const number = toWaNumber(pay.customers?.whatsapp);
      const { data: conn } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", pay.business_id).maybeSingle();
      if (number && conn?.instance_token) {
        const text = `Olá, ${firstName(pay.customers?.name)}! 💸 Devolvemos o sinal de ${brl(Number(pay.value))} do seu agendamento na ${pay.businesses?.name ?? ""}. O valor volta por Pix para a conta de origem e pode levar alguns instantes para aparecer.`;
        const r = await uazapi("/send/text", { token: conn.instance_token, body: { number, text } });
        notified = r.ok;
      }
    } catch { /* ignora */ }
    return { ok: true as const, notified, already: false as const };
  });
