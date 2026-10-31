import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";

function asaasBase() {
  return process.env["ASAAS_ENV"] === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function asaas(apiKey: string, path: string, body: unknown) {
  const res = await fetch(asaasBase() + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey, "User-Agent": "ConfirmaZap" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description || `Asaas erro ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// Horários ocupados (público, só devolve horários)
export const getBusySlots = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid(), from: z.string(), to: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: rows } = await admin
      .from("appointments")
      .select("start_at")
      .eq("business_id", data.businessId)
      .neq("status", "canceled")
      .gte("start_at", data.from)
      .lt("start_at", data.to);
    // Se a coluna vier sem fuso (timestamp), os horários estão em UTC: marca com "Z".
    return (rows ?? []).map((r) => {
      const s = String(r.start_at);
      return /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s) ? s : s.replace(" ", "T") + "Z";
    });
  });

// create-auth: cria cliente + agendamento pendente + autorização Pix Automático
export const createBookingAuth = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: biz } = await admin.from("businesses").select("id,name,asaas_api_key,status").eq("id", data.businessId).single();
    const { data: svc } = await admin.from("services").select("*").eq("id", data.serviceId).eq("business_id", data.businessId).eq("active", true).single();
    if (!biz || !svc) throw new Error("Serviço não encontrado");
    if (biz.status === "suspended") throw new Error("Este negócio está temporariamente indisponível.");

    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + svc.duration_minutes * 60000);
    const { data: clash } = await admin.from("appointments").select("id").eq("business_id", biz.id).neq("status", "canceled").eq("start_at", start.toISOString()).limit(1);
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
    if (aErr) throw new Error(aErr.message);

    const apiKey = biz.asaas_api_key || process.env["ASAAS_API_KEY"];
    if (!apiKey) {
      return { appointmentId: appt.id, qrCode: null, pixCopyAndPaste: null, warning: "Asaas não configurado para este negócio." };
    }
    try {
      const ac = await asaas(apiKey, "/customers", { name: data.name, cpfCnpj: customer.cpf, mobilePhone: phone });
      const auth = await asaas(apiKey, "/pix/automatic/authorizations", {
        customerId: ac.id,
        frequency: "MONTHLY",
        contractId: appt.id,
        startDate: new Date().toISOString().slice(0, 10),
        value: Number(svc.deposit_value),
        paymentCreationMode: "MANUAL",
        description: `Garantia de comparecimento - ${biz.name}`,
        immediateQrCode: { value: 0.01, expirationSeconds: 3600 },
      });
      await admin.from("customers").update({ asaas_customer_id: ac.id, pix_auth_id: auth.id }).eq("id", customer.id);
      const qr = auth.immediateQrCode ?? auth.qrCode ?? auth;
      return {
        appointmentId: appt.id,
        qrCode: (qr.encodedImage as string) ?? null,
        pixCopyAndPaste: (qr.payload ?? qr.pixCopyAndPaste ?? null) as string | null,
        warning: null as string | null,
      };
    } catch (e) {
      return { appointmentId: appt.id, qrCode: null, pixCopyAndPaste: null, warning: (e as Error).message };
    }
  });

// charge-no-show: marca falta e cobra via autorização Pix
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
    const value = Number(appt.services?.deposit_value ?? 30);
    const apiKey = appt.businesses?.asaas_api_key || process.env["ASAAS_API_KEY"];
    const c = appt.customers;
    if (!apiKey || !c?.pix_auth_id || !c?.asaas_customer_id) {
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
