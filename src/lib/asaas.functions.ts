import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { HOLD_MINUTES, MIN_ADVANCE_HOURS, activeHoldFilter, minAdvanceMs } from "./booking";
import { getEntitlements, getUsage } from "./plans.core";
import { siteUrl, toWaNumber, firstName } from "./manage.core";
import { uazapi } from "./uazapi";
import { DEFAULT_NOSHOW_MESSAGE } from "./birthday";
import { sendBookingConfirmed } from "./booking-notify";
import { reconcilePending } from "./payments.core";
import { readSchedule, slotAllowed } from "./schedule";

// Profissionais ativos do negócio. Sem a tabela (SQL ainda não rodado) ou sem nenhum, a agenda vale para o negócio todo.
async function activePros(admin: ReturnType<typeof getSupabaseAdmin>, businessId: string) {
  const { data, error } = await admin.from("professionals").select("id,name").eq("business_id", businessId).eq("active", true).order("created_at");
  return error ? [] : ((data ?? []) as Array<{ id: string; name: string }>);
}

// Profissionais que fazem o serviço: os marcados nele; sem nenhum marcado, todos os ativos.
// Sem a tabela de vínculos (SQL ainda não rodado), vale todos.
async function prosForService(admin: ReturnType<typeof getSupabaseAdmin>, pros: Array<{ id: string; name: string }>, serviceId?: string | null) {
  if (!serviceId || pros.length === 0) return pros;
  const { data, error } = await admin.from("professional_services").select("professional_id").eq("service_id", serviceId);
  if (error || !data || data.length === 0) return pros;
  const ids = new Set(data.map((r) => r.professional_id as string));
  return pros.filter((p) => ids.has(p.id));
}

function asaasBase() {
  return process.env["ASAAS_ENV"] === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

// Sem corpo = GET; com corpo = POST.
async function asaas(apiKey: string, path: string, body?: unknown) {
  const res = await fetch(asaasBase() + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey, "User-Agent": "ReservaPix" },
    body: body === undefined ? null : JSON.stringify(body),
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
// Com professionalId: os horários desse profissional. Sem ele ("sem preferência"): só os horários em que TODOS estão ocupados.
export const getBusySlots = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid(), from: z.string(), to: z.string(), professionalId: z.string().uuid().nullish(), serviceId: z.string().uuid().nullish() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const allPros = await activePros(admin, data.businessId);
    const pros = await prosForService(admin, allPros, data.serviceId);
    const { data: rows } = await admin
      .from("appointments")
      .select("*")
      .eq("business_id", data.businessId)
      .neq("status", "canceled")
      .or(activeHoldFilter())
      .gte("start_at", data.from)
      .lt("start_at", data.to);
    const all = (rows ?? []) as Array<{ start_at: unknown; professional_id?: string | null }>;
    if (allPros.length === 0) return all.map((r) => asUtc(r.start_at));
    if (pros.length === 0) return all.map((r) => asUtc(r.start_at)); // ninguém atende: tudo ocupado
    if (data.professionalId) return all.filter((r) => r.professional_id === data.professionalId).map((r) => asUtc(r.start_at));
    const busyBy = new Map<string, Set<string>>();
    for (const r of all) {
      const k = asUtc(r.start_at);
      if (!busyBy.has(k)) busyBy.set(k, new Set());
      if (r.professional_id) busyBy.get(k)!.add(r.professional_id);
    }
    return [...busyBy.entries()].filter(([, set]) => pros.every((p) => set.has(p.id))).map(([k]) => k);
  });

type BookingResult = {
  appointmentId: string;
  status: "pending" | "confirmed";
  value: number;
  qrCode: string | null;
  pixCopyAndPaste: string | null;
  manageToken: string | null;
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
      professionalId: z.string().uuid().nullish(),
      consent: z.literal(true),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<BookingResult> => {
    const admin = getSupabaseAdmin();
    const { data: biz } = await admin.from("businesses").select("id,name,asaas_api_key,status,settings").eq("id", data.businessId).single();
    const { data: svc } = await admin.from("services").select("*").eq("id", data.serviceId).eq("business_id", data.businessId).eq("active", true).single();
    if (!biz || !svc) throw new Error("Serviço não encontrado");
    if (biz.status === "suspended") throw new Error("Este negócio está temporariamente indisponível.");

    // Plano: teste/assinatura vencidos bloqueiam novos agendamentos; o Starter tem teto mensal.
    const ent = await getEntitlements(admin, biz.id);
    if (ent.expired) throw new Error("Este negócio está temporariamente indisponível para novos agendamentos.");
    if (ent.limits.maxAppointmentsPerMonth !== null) {
      const usage = await getUsage(admin, biz.id);
      if (usage.appointments >= ent.limits.maxAppointmentsPerMonth) throw new Error("Este negócio atingiu o limite de agendamentos deste mês. Fale com o estabelecimento.");
    }

    const value = Number(svc.deposit_value ?? 0);
    const apiKey: string | undefined = biz.asaas_api_key || process.env["ASAAS_API_KEY"];
    if (value > 0 && !apiKey) throw new Error("Este negócio ainda não ativou o recebimento por Pix. Fale com o estabelecimento.");

    const start = new Date(data.startAt);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) throw new Error("Horário inválido. Escolha outro.");
    if (start.getTime() < Date.now() + minAdvanceMs()) throw new Error(`Só é possível agendar com pelo menos ${MIN_ADVANCE_HOURS} horas de antecedência. Escolha outro horário.`);
    const sch = readSchedule(biz.settings);
    if (!slotAllowed(start.getTime(), svc.duration_minutes, sch)) throw new Error(sch.paused ? "A agenda deste negócio está fechada no momento." : "O estabelecimento não atende nesse horário. Escolha outro.");
    const end = new Date(start.getTime() + svc.duration_minutes * 60000);
    // Quem atende: o profissional escolhido ou, sem preferência, o primeiro livre naquele horário.
    const allPros = await activePros(admin, biz.id);
    const pros = await prosForService(admin, allPros, svc.id);
    if (allPros.length > 0 && pros.length === 0) throw new Error("Nenhum profissional disponível para este serviço no momento.");
    if (data.professionalId && !pros.some((p) => p.id === data.professionalId)) throw new Error("Este profissional não faz este serviço. Escolha outro.");
    const candidates = allPros.length === 0 ? [null] : data.professionalId ? [data.professionalId] : pros.map((p) => p.id);
    let professionalId: string | null = null;
    let free = false;
    for (const cand of candidates) {
      let q = admin.from("appointments").select("id").eq("business_id", biz.id).eq("start_at", start.toISOString()).neq("status", "canceled").or(activeHoldFilter());
      if (cand) q = q.eq("professional_id", cand);
      const { data: clash } = await q.limit(1);
      if (!clash || !clash.length) { professionalId = cand; free = true; break; }
    }
    if (!free) throw new Error("Horário acabou de ser reservado. Escolha outro.");

    const phone = data.whatsapp.replace(/\D/g, "");
    const cpf = data.cpf.replace(/\D/g, "");

    // Não duplica: o mesmo cliente (mesmo CPF ou mesmo WhatsApp neste negócio) é reaproveitado.
    // Os dados que o profissional já completou/editou não são sobrescritos.
    const findCustomer = async () => {
      const { data: byCpf } = await admin.from("customers").select("*").eq("business_id", biz.id).eq("cpf", cpf).limit(1);
      if (byCpf?.[0]) return byCpf[0];
      const { data: byPhone } = await admin.from("customers").select("*").eq("business_id", biz.id).eq("whatsapp", phone).limit(1);
      return byPhone?.[0] ?? null;
    };
    const now = new Date().toISOString();
    let customer = await findCustomer();
    let createdCustomer = false;
    if (customer) {
      const patch: Record<string, unknown> = { consent_at: now };
      if (!customer.name) patch["name"] = data.name;
      if (!customer.cpf) patch["cpf"] = cpf;
      await admin.from("customers").update(patch).eq("id", customer.id);
      customer = { ...customer, ...patch };
    } else {
      const { data: ins, error: cErr } = await admin
        .from("customers")
        .insert({ business_id: biz.id, name: data.name, whatsapp: phone, cpf, consent_at: now })
        .select().single();
      if (cErr) {
        // Duas reservas ao mesmo tempo: a outra chegou primeiro, então usa o cadastro dela.
        customer = cErr.code === "23505" ? await findCustomer() : null;
        if (!customer) throw new Error(cErr.message);
      } else {
        customer = ins;
        createdCustomer = true;
      }
    }

    const { data: appt, error: aErr } = await admin
      .from("appointments")
      .insert({ business_id: biz.id, customer_id: customer.id, service_id: svc.id, start_at: start.toISOString(), end_at: end.toISOString(), status: "pending", ...(professionalId ? { professional_id: professionalId } : {}) })
      .select().single();
    if (aErr) {
      if (createdCustomer) await admin.from("customers").delete().eq("id", customer.id);
      throw new Error(aErr.message);
    }

    // Serviço sem sinal: não há o que cobrar, o horário já fica confirmado.
    if (value <= 0) {
      const { error } = await admin.from("appointments").update({ status: "confirmed" }).eq("id", appt.id);
      if (error) throw new Error(error.message);
      await sendBookingConfirmed(admin, appt.id);
      return { appointmentId: appt.id, status: "confirmed", value: 0, qrCode: null, pixCopyAndPaste: null, manageToken: appt.manage_token ?? null };
    }

    const key = apiKey as string; // garantido pela checagem acima (value > 0)
    try {
      // Reaproveita o cliente do Asaas se já existe; se a chave mudou e o ID não vale mais, cria outro.
      const newAsaasCustomer = () => asaas(key, "/customers", { name: customer.name || data.name, cpfCnpj: customer.cpf || cpf, mobilePhone: phone });
      const dueDate = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // data em Brasília
      const createPayment = (asaasCustomerId: string) => asaas(key, "/payments", {
        customer: asaasCustomerId,
        billingType: "PIX",
        value,
        dueDate,
        description: `Sinal de agendamento - ${biz.name}`,
        externalReference: appt.id,
      });
      const known: string | null = customer.asaas_customer_id ?? null;
      let ac: { id: string } = { id: known ?? (await newAsaasCustomer()).id };
      let pay;
      try {
        pay = await createPayment(ac.id);
      } catch (e) {
        if (!known) throw e;
        ac = await newAsaasCustomer();
        pay = await createPayment(ac.id);
      }
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
        manageToken: appt.manage_token ?? null,
      };
    } catch (e) {
      // Falhou antes de o cliente ver o Pix: libera o horário e não deixa cadastro solto.
      await admin.from("appointments").delete().eq("id", appt.id);
      if (createdCustomer) await admin.from("customers").delete().eq("id", customer.id);
      throw new Error(`Não foi possível gerar o Pix: ${(e as Error).message}`);
    }
  });

// Status do agendamento para a tela do cliente (consulta a cada poucos segundos).
export const getBookingStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ appointmentId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const cols = "id,business_id,asaas_payment_id,status,deposit_paid,created_at,manage_token";
    let { data: a } = await admin.from("appointments").select(cols).eq("id", data.appointmentId).maybeSingle();
    if (!a) throw new Error("Agendamento não encontrado");
    // Enquanto a página espera o Pix, confere direto no Asaas: não depende do aviso (webhook) chegar.
    if (a.status === "pending" && await reconcilePending(admin, a as any)) {
      ({ data: a } = await admin.from("appointments").select(cols).eq("id", data.appointmentId).maybeSingle());
      if (!a) throw new Error("Agendamento não encontrado");
    }
    const expired = a.status === "pending" && new Date(asUtc(a.created_at)).getTime() < Date.now() - HOLD_MINUTES * 60_000;
    return { status: a.status as string, paid: a.deposit_paid === true, expired, manageToken: (a.manage_token as string | null) ?? null };
  });

// Depois da falta, convida o cliente a remarcar pelo WhatsApp conectado do negócio. Falha aqui nunca atrapalha marcar a falta.
async function sendNoShowNudge(admin: ReturnType<typeof getSupabaseAdmin>, appt: { business_id: string; customers?: { name?: string | null; whatsapp?: unknown } | null }): Promise<{ sent: boolean; reason: string }> {
  try {
    const number = toWaNumber(appt.customers?.whatsapp);
    if (!number) return { sent: false, reason: "o cliente não tem um WhatsApp válido cadastrado" };
    const { data: conn } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", appt.business_id).maybeSingle();
    if (!conn?.instance_token) return { sent: false, reason: "o WhatsApp do negócio não está conectado (Configurações > Negócio e regras)" };
    const { data: b } = await admin.from("businesses").select("name,slug,settings").eq("id", appt.business_id).maybeSingle();
    if (!b) return { sent: false, reason: "negócio não encontrado" };
    const custom = ((b.settings ?? {}) as { noshow?: { enabled?: boolean; message?: string } }).noshow;
    if (custom?.enabled === false) return { sent: false, reason: "a mensagem após falta está desligada nas configurações" };
    const link = `${siteUrl()}/agendar/${b.slug}`;
    const base = custom?.message?.trim() || DEFAULT_NOSHOW_MESSAGE;
    const text = base.replace(/\{nome\}/gi, firstName(appt.customers?.name)).replace(/\{negocio\}/gi, b.name).replace(/\{link\}/gi, link) + (/\{link\}/i.test(base) ? "" : ` ${link}`);
    const r = await uazapi("/send/text", { token: conn.instance_token, body: { number, text } });
    if (!r.ok) return { sent: false, reason: `o WhatsApp recusou o envio (erro ${r.status}). Reconecte o WhatsApp em Configurações` };
    return { sent: true, reason: "" };
  } catch (e) { return { sent: false, reason: `falha ao enviar (${(e as Error).message})` }; }
}

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

    const wasNoShow = appt.status === "no_show";
    await admin.from("appointments").update({ status: "no_show" }).eq("id", appt.id);
    const nudge = wasNoShow ? { sent: false, reason: "" } : await sendNoShowNudge(admin, appt);
    const note = nudge.sent ? " Mensagem de reagendamento enviada ao cliente." : nudge.reason ? ` Mensagem de reagendamento NÃO enviada: ${nudge.reason}.` : "";
    const c = appt.customers;
    if (appt.deposit_paid) return { ok: true, message: `Falta marcada. O sinal já estava pago.${note}` };
    // Reserva do fluxo novo que não chegou a pagar o sinal: não existe autorização Pix para cobrar.
    if (!c?.pix_auth_id) return { ok: true, message: `Falta marcada. O sinal desta reserva não foi pago, então não há o que cobrar.${note}` };

    const value = Number(appt.services?.deposit_value ?? 30);
    const apiKey = appt.businesses?.asaas_api_key || process.env["ASAAS_API_KEY"];
    if (!apiKey || !c?.asaas_customer_id) {
      await admin.from("payments").insert({ business_id: appt.business_id, appointment_id: appt.id, customer_id: c?.id, value, status: "failed" });
      return { ok: false, message: `Falta marcada, mas o cliente não tem autorização Pix ativa.${note}` };
    }
    try {
      const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const p = await asaas(apiKey, "/payments", {
        customer: c.asaas_customer_id, billingType: "PIX", value, dueDate: due,
        pixAutomaticAuthorizationId: c.pix_auth_id, description: "Taxa de não comparecimento",
      });
      await admin.from("appointments").update({ asaas_payment_id: p.id }).eq("id", appt.id);
      await admin.from("payments").insert({ business_id: appt.business_id, appointment_id: appt.id, customer_id: c.id, asaas_payment_id: p.id, value, status: "pending" });
      return { ok: true, message: `Falta marcada e cobrança criada.${note}` };
    } catch (e) {
      await admin.from("payments").insert({ business_id: appt.business_id, appointment_id: appt.id, customer_id: c.id, value, status: "failed" });
      return { ok: false, message: (e as Error).message };
    }
  });
