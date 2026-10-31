import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { HOLD_MINUTES, activeHoldFilter } from "./booking";

function asaasBase() {
  return process.env["ASAAS_ENV"] === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

// Sem corpo = GET; com corpo = POST.
async function asaas(apiKey: string, path: string, body?: unknown) {
  const res = await fetch(asaasBase() + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey, "User-Agent": "ConfirmaZap" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description || `Asaas erro ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// O banco guarda os horários sem fuso (UTC): marca com "Z" para o navegador não ler como horário local.
function asUtc(value: unknown) {
  const s = String(value);
  return /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s) ? s : s.replace(" ", "T") + "Z";
}

// Horários ocupados (público, só devolve horários). Reserva não paga fora do prazo não ocupa o horário.
export const getBusySlots = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid(), from: z.string(), to: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: rows } = await admin
      .from("appointments")
      .select("start_at")
      .eq("business_id", data.businessId)
      .neq("status", "canceled")
      .or(activeHoldFilter())
      .gte("start_at", data.from)
      .lt("start_at", data.to);
    return (rows ?? []).map((r) => asUtc(r.start_at));
  });

type BookingResult = {
  appointmentId: string;
  status: "pending" | "confirmed";
  value: number;
  qrCode: string | null;
  pixCopyAndPaste: string | null;
};

// Cria cliente + agendamento pendente + cobrança Pix do sinal. O horário só é confirmado
// quando o pagamento chega pelo webhook (src/routes/api.asaas-webhook.ts).
export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      businessId: z.string().uuid(),
      serviceId: z.string().uuid(),
      startAt: z.string(),
      name: z.string().min(2).max(120),
      whatsapp: z.string().min(10).max(20),
      cpf: z.string().min(11).max(18),
      consent: z.literal(true),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<BookingResult> => {
    const admin = getSupabaseAdmin();
    const { data: biz } = await admin.from("businesses").select("id,name,asaas_api_key,status").eq("id", data.businessId).single();
    const { data: svc } = await admin.from("services").select("*").eq("id", data.serviceId).eq("business_id", data.businessId).eq("active", true).single();
    if (!biz || !svc) throw new Error("Serviço não encontrado");
    if (biz.status === "suspended") throw new Error("Este negócio está temporariamente indisponível.");

    const value = Number(svc.deposit_value ?? 0);
    const apiKey: string | undefined = biz.asaas_api_key || process.env["ASAAS_API_KEY"];
    if (value > 0 && !apiKey) throw new Error("Este negócio ainda não ativou o recebimento por Pix. Fale com o estabelecimento.");

    const start = new Date(data.startAt);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) throw new Error("Horário inválido. Escolha outro.");
    const end = new Date(start.getTime() + svc.duration_minutes * 60000);
    const { data: clash } = await admin
      .from("appointments").select("id")
      .eq("business_id", biz.id).eq("start_at", start.toISOString())
      .neq("status", "canceled").or(activeHoldFilter()).limit(1);
    if (clash && clash.length) throw new Error("Horário acabou de ser reservado. Escolha outro.");

    const phone = data.whatsapp.replace(/\D/g, "");
    const { data: customer, error: cErr } = await admin
      .from("customers")
      .insert({ business_id: biz.id, name: data.name, whatsapp: phone, cpf: data.cpf.replace(/\D/g, ""), consent_at: new Date().toISOString() })
      .select().single();
    if (cErr) throw new Error(cErr.message);

    const { data: appt, error: aErr } = await admin
      .from("appointments")
      .insert({ business_id: biz.id, customer_id: customer.id, service_id: svc.id, start_at: start.toISOString(), end_at: end.toISOString(), status: "pending" })
      .select().single();
    if (aErr) {
      await admin.from("customers").delete().eq("id", customer.id);
      throw new Error(aErr.message);
    }

    // Serviço sem sinal: não há o que cobrar, o horário já fica confirmado.
    if (value <= 0) {
      const { error } = await admin.from("appointments").update({ status: "confirmed" }).eq("id", appt.id);
      if (error) throw new Error(error.message);
      return { appointmentId: appt.id, status: "confirmed", value: 0, qrCode: null, pixCopyAndPaste: null };
    }

    const key = apiKey as string; // garantido pela checagem acima (value > 0)
    try {
      const ac = await asaas(key, "/customers", { name: data.name, cpfCnpj: customer.cpf, mobilePhone: phone });
      const dueDate = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // data em Brasília
      const pay = await asaas(key, "/payments", {
        customer: ac.id,
        billingType: "PIX",
        value,
        dueDate,
        description: `Sinal de agendamento - ${biz.name}`,
        externalReference: appt.id,
      });
      // Guarda o ID do pagamento logo: é por ele que o webhook acha o agendamento.
      const { error: uErr } = await admin.from("appointments").update({ asaas_payment_id: pay.id }).eq("id", appt.id);
      if (uErr) throw new Error(uErr.message);
      const qr = await asaas(key, `/payments/${pay.id}/pixQrCode`);
      await admin.from("customers").update({ asaas_customer_id: ac.id }).eq("id", customer.id);
      const { error: pErr } = await admin.from("payments").insert({
        business_id: biz.id, appointment_id: appt.id, customer_id: customer.id, asaas_payment_id: pay.id, value, status: "pending",
      });
      if (pErr) throw new Error(pErr.message);
      return {
        appointmentId: appt.id,
        status: "pending",
        value,
        qrCode: (qr.encodedImage as string) ?? null,
        pixCopyAndPaste: (qr.payload as string) ?? null,
      };
    } catch (e) {
      // Falhou antes de o cliente ver o Pix: libera o horário e não deixa cadastro solto.
      await admin.from("appointments").delete().eq("id", appt.id);
      await admin.from("customers").delete().eq("id", customer.id);
      throw new Error(`Não foi possível gerar o Pix: ${(e as Error).message}`);
    }
  });

// Status do agendamento para a tela do cliente (consulta a cada poucos segundos).
export const getBookingStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ appointmentId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: a } = await admin.from("appointments").select("status,deposit_paid,created_at").eq("id", data.appointmentId).maybeSingle();
    if (!a) throw new Error("Agendamento não encontrado");
    const expired = a.status === "pending" && new Date(asUtc(a.created_at)).getTime() < Date.now() - HOLD_MINUTES * 60_000;
    return { status: a.status as string, paid: a.deposit_paid === true, expired };
  });

// Marca falta. Se o sinal já foi pago na reserva, não há nova cobrança.
export const chargeNoShow = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ appointmentId: z.string().uuid(), accessToken: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: u } = await admin.auth.getUser(data.accessToken);
    if (!u.user) throw new Error("Não autenticado");
    const { data: appt } = await admin
      .from("appointments")
      .select("*, customers(*), services(*), businesses(id, owner_id, asaas_api_key)")
      .eq("id", data.appointmentId).single();
    if (!appt || appt.businesses?.owner_id !== u.user.id) throw new Error("Sem permissão");

    await admin.from("appointments").update({ status: "no_show" }).eq("id", appt.id);
    const c = appt.customers;
    if (appt.deposit_paid) return { ok: true, message: "Falta marcada. O sinal já estava pago." };
    // Reserva do fluxo novo que não chegou a pagar o sinal: não existe autorização Pix para cobrar.
    if (!c?.pix_auth_id) return { ok: true, message: "Falta marcada. O sinal desta reserva não foi pago, então não há o que cobrar." };

    const value = Number(appt.services?.deposit_value ?? 30);
    const apiKey = appt.businesses?.asaas_api_key || process.env["ASAAS_API_KEY"];
    if (!apiKey || !c?.asaas_customer_id) {
      await admin.from("payments").insert({ business_id: appt.business_id, appointment_id: appt.id, customer_id: c?.id, value, status: "failed" });
      return { ok: false, message: "Falta marcada, mas o cliente não tem autorização Pix ativa." };
    }
    try {
      const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const p = await asaas(apiKey, "/payments", {
        customer: c.asaas_customer_id, billingType: "PIX", value, dueDate: due,
        pixAutomaticAuthorizationId: c.pix_auth_id, description: "Taxa de não comparecimento",
      });
      await admin.from("appointments").update({ asaas_payment_id: p.id }).eq("id", appt.id);
      await admin.from("payments").insert({ business_id: appt.business_id, appointment_id: appt.id, customer_id: c.id, asaas_payment_id: p.id, value, status: "pending" });
      return { ok: true, message: "Falta marcada e cobrança criada." };
    } catch (e) {
      await admin.from("payments").insert({ business_id: appt.business_id, appointment_id: appt.id, customer_id: c.id, value, status: "failed" });
      return { ok: false, message: (e as Error).message };
    }
  });
