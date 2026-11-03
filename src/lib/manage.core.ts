import type { getSupabaseAdmin } from "./supabaseAdmin";

// Núcleo compartilhado só no servidor: regras de cancelamento, links e textos dos lembretes.
type Admin = ReturnType<typeof getSupabaseAdmin>;

// O banco guarda os horários sem fuso (UTC): marca com "Z" para ninguém ler como horário local.
export function asUtc(value: unknown) {
  const s = String(value);
  return /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s) ? s : s.replace(" ", "T") + "Z";
}

export const siteUrl = () => (process.env["PUBLIC_SITE_URL"] || "https://reservapix.vip").replace(/\/$/, "");
export const manageUrl = (token: string) => `${siteUrl()}/agendamento/${token}`;

export function cancelHoursOf(settings: unknown): number {
  const h = Number((settings as { cancel_hours?: unknown } | null)?.cancel_hours);
  return Number.isFinite(h) && h >= 0 ? h : 4;
}

// Dentro do prazo grátis? (faltam pelo menos `hours` horas para o início)
export const withinFreeWindow = (startAt: unknown, hours: number) =>
  new Date(asUtc(startAt)).getTime() - Date.now() >= hours * 3600_000;

// Cancela e, se o sinal estava pago e o cancelamento é dentro do prazo, marca a devolução para o profissional.
export async function cancelAppointment(
  admin: Admin,
  appt: { id: string; start_at: unknown; deposit_paid: boolean | null },
  hours: number,
) {
  const { error } = await admin.from("appointments").update({ status: "canceled" }).eq("id", appt.id).in("status", ["pending", "confirmed"]);
  if (error) throw new Error(error.message);
  const refund = Boolean(appt.deposit_paid) && withinFreeWindow(appt.start_at, hours);
  if (refund) await admin.from("payments").update({ status: "refund_needed" }).eq("appointment_id", appt.id).eq("status", "paid");
  return { refund };
}

const brTime = (startAt: unknown, opts: Intl.DateTimeFormatOptions) =>
  new Date(asUtc(startAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...opts });

export const whenText = (startAt: unknown) =>
  `${brTime(startAt, { weekday: "long", day: "2-digit", month: "long" })} às ${brTime(startAt, { hour: "2-digit", minute: "2-digit" })}`;
export const clockText = (startAt: unknown) => brTime(startAt, { hour: "2-digit", minute: "2-digit" });

export const firstName = (full: string | null | undefined) => {
  const f = (full ?? "").trim().split(/\s+/)[0] || "cliente";
  return f.charAt(0).toLocaleUpperCase("pt-BR") + f.slice(1).toLocaleLowerCase("pt-BR");
};

// Número do banco (10–11 dígitos, sem 55) → formato do uazapi.
export function toWaNumber(whatsapp: unknown) {
  let n = String(whatsapp ?? "").replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  return n.length >= 12 ? n : null;
}

export function reminderText(kind: "24h" | "2h", o: { name: string | null; business: string; service: string; startAt: unknown; link: string }) {
  const nome = firstName(o.name);
  if (kind === "24h") {
    return `Olá, ${nome}! 👋 Lembrete do seu horário na ${o.business}:\n\n📅 ${whenText(o.startAt)}\n✂️ ${o.service}\n\nPara confirmar, remarcar ou cancelar, é só abrir o link:\n${o.link}`;
  }
  return `Olá, ${nome}! Seu horário na ${o.business} é hoje, às ${clockText(o.startAt)}. 😉\n\nConfirme sua presença, remarque ou cancele por aqui:\n${o.link}`;
}
