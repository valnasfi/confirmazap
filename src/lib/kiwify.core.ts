import type { getSupabaseAdmin } from "./supabaseAdmin";
import { PLANS } from "./plans";
import { siteUrl } from "./manage.core";

type Admin = ReturnType<typeof getSupabaseAdmin>;
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

export type KiwifyChange = { email: string; plan: "starter" | "pro"; status: "active" | "past_due" | "canceled"; periodEnd: string | null; subId: string | null; name?: string; phone?: string };

// Lê o aviso da Kiwify com tolerância: nomes de campos podem variar entre eventos.
export function parseKiwify(body: unknown): KiwifyChange | null {
  const b = o(body);
  const event = s(b["webhook_event_type"]) || s(b["event"]);
  const email = (s(o(b["Customer"])["email"]) || s(o(b["customer"])["email"])).trim().toLowerCase();
  if (!email) return null;
  const sub = o(b["Subscription"]);
  const product = o(b["Product"]);
  const planName = s(o(sub["plan"])["name"]);
  const text = `${s(product["product_name"])} ${planName}`.toLowerCase();
  const charge = Number(o(b["Commissions"])["charge_amount"]);
  const plan: "starter" | "pro" = /\bpro\b/.test(text) || (Number.isFinite(charge) && charge >= 9000) ? "pro" : "starter";
  const status: KiwifyChange["status"] | null =
    event === "order_approved" || event === "subscription_renewed" ? "active"
    : event === "subscription_late" ? "past_due"
    : event === "subscription_canceled" || event === "order_refunded" || event === "chargeback" ? "canceled"
    : null;
  if (!status) return null;
  const next = Date.parse(s(sub["next_payment"]));
  const fallback = Date.now() + 33 * 86400_000;
  const end = Number.isFinite(next) && next > Date.now() ? next + 86400_000 : fallback;
  return { email, plan, status, periodEnd: status === "canceled" ? null : new Date(end).toISOString(), subId: s(sub["id"]) || s(b["subscription_id"]) || null, name: s(o(b["Customer"])["full_name"]).trim(), phone: s(o(b["Customer"])["mobile"]).replace(/\D/g, "") };
}

export async function applyKiwify(admin: Admin, c: KiwifyChange, keepPeriod = false) {
  const { data: biz } = await admin.from("businesses").select("id").ilike("email", c.email).limit(1).maybeSingle();
  if (!biz) {
    // Primeira compra desse e-mail: cria o login e manda o convite para definir a senha (se já houver conta, só guarda o plano).
    if (c.status === "active") {
      const { data: seen } = await admin.from("kiwify_pending").select("email").eq("email", c.email).maybeSingle();
      if (!seen) {
        const { error } = await admin.auth.admin.inviteUserByEmail(c.email, { redirectTo: `${siteUrl()}/dashboard`, data: { full_name: c.name ?? "", phone: c.phone ?? "", needs_password: true } });
        if (error && !/already|registered|exists/i.test(error.message)) console.error("kiwify-invite", error.message);
      }
    }
    await admin.from("kiwify_pending").upsert({ email: c.email, plan: c.plan, status: c.status, period_end: c.periodEnd, kiwify_subscription_id: c.subId, updated_at: new Date().toISOString() });
    return "pending";
  }
  return setSub(admin, biz.id as string, c, keepPeriod);
}

async function setSub(admin: Admin, businessId: string, c: KiwifyChange, keepPeriod: boolean) {
  const patch: Record<string, unknown> = { business_id: businessId, plan: c.plan, status: c.status, price: PLANS[c.plan].price, kiwify_subscription_id: c.subId, pending_plan: null, invoice_url: null, updated_at: new Date().toISOString() };
  if (c.periodEnd && !keepPeriod) patch["current_period_end"] = c.periodEnd;
  const { error } = await admin.from("subscriptions").upsert(patch, { onConflict: "business_id" });
  if (error) throw new Error(error.message);
  return "applied";
}

// Compra feita antes de existir conta com esse e-mail: vale assim que o dono entra.
export async function claimKiwify(admin: Admin, businessId: string, email: string | undefined) {
  if (!email) return;
  try {
    const e = email.trim().toLowerCase();
    const { data: p } = await admin.from("kiwify_pending").select("*").eq("email", e).maybeSingle();
    if (!p) return;
    await setSub(admin, businessId, { email: e, plan: p.plan, status: p.status, periodEnd: p.period_end, subId: p.kiwify_subscription_id }, false);
    await admin.from("kiwify_pending").delete().eq("email", e);
  } catch { /* tabela ainda não criada */ }
}
