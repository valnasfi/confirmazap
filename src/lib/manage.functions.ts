import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { MIN_ADVANCE_HOURS, activeHoldFilter, minAdvanceMs } from "./booking";
import { asUtc, cancelAppointment, cancelHoursOf, withinFreeWindow } from "./manage.core";

// Página pública /agendamento/<token>: o cliente vê, cancela ou remarca o próprio horário.
// O token (64 caracteres aleatórios) chega no link do WhatsApp e é a única "senha".
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{32,64}$/) });

async function load(token: string) {
  const admin = getSupabaseAdmin();
  const { data: a } = await admin
    .from("appointments")
    .select("*,businesses(name,slug,logo_url,whatsapp,settings,status),services(name,duration_minutes,deposit_value)")
    .eq("manage_token", token)
    .maybeSingle();
  if (!a) throw new Error("Agendamento não encontrado. Confira o link.");
  return { admin, a: a as any };
}

export const getManage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i))
  .handler(async ({ data }) => {
    const { a } = await load(data.token);
    const hours = cancelHoursOf(a.businesses?.settings);
    const upcoming = new Date(asUtc(a.start_at)).getTime() > Date.now();
    return {
      businessId: a.business_id as string,
      businessName: (a.businesses?.name ?? "") as string,
      businessSlug: (a.businesses?.slug ?? "") as string,
      logoUrl: (a.businesses?.logo_url ?? null) as string | null,
      businessWhatsapp: (a.businesses?.whatsapp ?? null) as string | null,
      serviceName: (a.services?.name ?? "") as string,
      durationMinutes: Number(a.services?.duration_minutes ?? 60),
      startAt: asUtc(a.start_at),
      status: a.status as string,
      depositPaid: a.deposit_paid === true,
      professionalId: (a.professional_id ?? null) as string | null,
      cancelHours: hours,
      confirmedByCustomer: Boolean(a.customer_confirmed_at),
      canChange: a.status === "confirmed" && upcoming,
      freeWindow: withinFreeWindow(a.start_at, hours),
    };
  });

export const cancelByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.extend({ acceptLate: z.boolean().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { admin, a } = await load(data.token);
    if (a.status === "canceled") return { ok: true as const, refund: false };
    if (!["pending", "confirmed"].includes(a.status) || new Date(asUtc(a.start_at)).getTime() < Date.now()) throw new Error("Este agendamento não pode mais ser cancelado.");
    const hours = cancelHoursOf(a.businesses?.settings);
    // Fora do prazo grátis: só cancela se o cliente aceitar perder o sinal.
    if (!withinFreeWindow(a.start_at, hours) && !data.acceptLate) return { ok: false as const, late: true as const, hours };
    const r = await cancelAppointment(admin, a, hours);
    return { ok: true as const, refund: r.refund };
  });

export const rescheduleByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.extend({ newStartAt: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { admin, a } = await load(data.token);
    if (a.status !== "confirmed") throw new Error("Só dá para remarcar um horário confirmado.");
    const hours = cancelHoursOf(a.businesses?.settings);
    if (!withinFreeWindow(a.start_at, hours)) {
      throw new Error(`Faltam menos de ${hours}h para o horário, então não dá para remarcar por aqui. Fale com ${a.businesses?.name ?? "o estabelecimento"}.`);
    }
    const start = new Date(data.newStartAt);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) throw new Error("Horário inválido. Escolha outro.");
    if (start.getTime() < Date.now() + minAdvanceMs()) throw new Error(`Só é possível remarcar com pelo menos ${MIN_ADVANCE_HOURS} horas de antecedência. Escolha outro horário.`);
    const end = new Date(start.getTime() + Number(a.services?.duration_minutes ?? 60) * 60000);

    let clashQuery = admin
      .from("appointments").select("id")
      .eq("business_id", a.business_id).eq("start_at", start.toISOString())
      .neq("status", "canceled").neq("id", a.id).or(activeHoldFilter());
    if (a.professional_id) clashQuery = clashQuery.eq("professional_id", a.professional_id); // remarca com o mesmo profissional
    const { data: clash } = await clashQuery.limit(1);
    if (clash && clash.length) throw new Error("Esse horário acabou de ser reservado. Escolha outro.");

    const { error } = await admin.from("appointments").update({ start_at: start.toISOString(), end_at: end.toISOString(), customer_confirmed_at: null }).eq("id", a.id);
    if (error) throw new Error(error.message);
    // Novo horário, novos lembretes.
    await admin.from("reminders").delete().eq("appointment_id", a.id);
    return { ok: true, startAt: start.toISOString() };
  });

export const confirmByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i))
  .handler(async ({ data }) => {
    const { admin, a } = await load(data.token);
    if (a.status !== "confirmed" || new Date(asUtc(a.start_at)).getTime() < Date.now()) throw new Error("Este agendamento não pode mais ser confirmado.");
    if (!a.customer_confirmed_at) {
      const { error } = await admin.from("appointments").update({ customer_confirmed_at: new Date().toISOString() }).eq("id", a.id);
      if (error) throw new Error(/column|schema cache/i.test(error.message) ? "A confirmação por link ainda não foi ativada no Supabase." : error.message);
    }
    return { ok: true as const };
  });
