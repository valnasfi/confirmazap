import type { SupabaseClient } from "@supabase/supabase-js";
import { uazapi } from "./uazapi";
import { firstName, manageUrl, toWaNumber, whenText } from "./manage.core";

// Avisa o cliente pelo WhatsApp do negócio assim que o horário fica confirmado (sinal pago ou serviço sem sinal).
// Nunca lança erro: falha no aviso não pode atrapalhar a confirmação. Chame só quando a confirmação acabou de acontecer.
export async function sendBookingConfirmed(admin: SupabaseClient, appointmentId: string): Promise<boolean> {
  try {
    const q = (cols: string) => admin.from("appointments").select(cols).eq("id", appointmentId).maybeSingle();
    let r0 = await q("id,business_id,start_at,manage_token,customers(name,whatsapp),services(name),professionals(name),businesses(name,status)");
    if (r0.error) r0 = await q("id,business_id,start_at,manage_token,customers(name,whatsapp),services(name),businesses(name,status)"); // sem a tabela de profissionais
    const ap = r0.data as any;
    if (!ap || ap.businesses?.status === "suspended") return false;
    const number = toWaNumber(ap.customers?.whatsapp);
    if (!number) return false;
    const { data: conn } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", ap.business_id).maybeSingle();
    if (!conn?.instance_token) return false;

    const pro = ap.professionals?.name ? `\n👤 ${ap.professionals.name}` : "";
    const link = ap.manage_token ? `\n\nPara remarcar ou cancelar:\n${manageUrl(ap.manage_token)}` : "";
    const text = `✅ Horário confirmado, ${firstName(ap.customers?.name)}!\n\n${ap.businesses?.name ?? ""}\n📅 ${whenText(ap.start_at)}\n✂️ ${ap.services?.name ?? "Atendimento"}${pro}${link}\n\nTe esperamos!`;
    const r = await uazapi("/send/text", { token: conn.instance_token, body: { number, text } });
    return r.ok;
  } catch {
    return false;
  }
}

// Avisa o cliente quando o ESTABELECIMENTO cancela o horário. Nunca lança erro.
export async function sendCanceledByBusiness(admin: SupabaseClient, appointmentId: string, depositPaid: boolean): Promise<{ sent: boolean; reason: string }> {
  try {
    const q = (cols: string) => admin.from("appointments").select(cols).eq("id", appointmentId).maybeSingle();
    let r0 = await q("id,business_id,start_at,customers(name,whatsapp),services(name),professionals(name),businesses(name,slug)");
    if (r0.error) r0 = await q("id,business_id,start_at,customers(name,whatsapp),services(name),businesses(name,slug)");
    const ap = r0.data as any;
    if (!ap) return { sent: false, reason: "agendamento não encontrado" };
    const number = toWaNumber(ap.customers?.whatsapp);
    if (!number) return { sent: false, reason: "o cliente não tem um WhatsApp válido cadastrado" };
    const { data: conn } = await admin.from("whatsapp_connections").select("instance_token").eq("business_id", ap.business_id).maybeSingle();
    if (!conn?.instance_token) return { sent: false, reason: "o WhatsApp do negócio não está conectado" };

    const site = (process.env["PUBLIC_SITE_URL"] || "https://reservapix.vip").replace(/\/$/, "");
    const refund = depositPaid ? "\n\n💸 O sinal que você pagou será devolvido por Pix." : "";
    const text = `Olá, ${firstName(ap.customers?.name)}. Infelizmente precisamos cancelar o seu horário na ${ap.businesses?.name ?? "nossa equipe"}:\n\n📅 ${whenText(ap.start_at)}\n✂️ ${ap.services?.name ?? "Atendimento"}${refund}\n\nPedimos desculpas pelo transtorno. Para escolher um novo horário:\n${site}/agendar/${ap.businesses?.slug ?? ""}`;
    const r = await uazapi("/send/text", { token: conn.instance_token, body: { number, text } });
    return r.ok ? { sent: true, reason: "" } : { sent: false, reason: `o WhatsApp recusou o envio (erro ${r.status})` };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}
