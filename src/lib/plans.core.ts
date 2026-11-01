import type { getSupabaseAdmin } from "./supabaseAdmin";
import { GRACE_DAYS, PLANS, type PlanSpec } from "./plans";
import { asUtc } from "./manage.core";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export type Entitlements = {
  plan: "trial" | "starter" | "pro";
  status: "trialing" | "active" | "past_due" | "canceled" | "none";
  expired: boolean; // teste/assinatura vencidos e fora da tolerância: novos agendamentos ficam bloqueados
  limits: PlanSpec;
  trialEndsAt: string | null;
  periodEnd: string | null;
};

const DAY = 86400_000;

// Plano em vigor do negócio. Sem registro de assinatura (ou sem a tabela), vale o teste completo: nunca trava por falta de dado.
export async function getEntitlements(admin: Admin, businessId: string): Promise<Entitlements> {
  const trial = (extra: Partial<Entitlements> = {}): Entitlements => ({ plan: "trial", status: "trialing", expired: false, limits: PLANS.pro, trialEndsAt: null, periodEnd: null, ...extra });
  try {
    const { data: biz } = await admin.from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
    if (biz?.owner_id) {
      const { data: adm } = await admin.from("platform_admins").select("user_id").eq("user_id", biz.owner_id).maybeSingle();
      if (adm) return { plan: "pro", status: "active", expired: false, limits: PLANS.pro, trialEndsAt: null, periodEnd: null }; // conta do dono da plataforma
    }
    const { data: s } = await admin.from("subscriptions").select("plan,status,trial_ends_at,current_period_end").eq("business_id", businessId).maybeSingle();
    if (!s) return trial({ status: "none" });

    const now = Date.now();
    const trialEnd = s.trial_ends_at ? new Date(asUtc(s.trial_ends_at)).getTime() : null;
    const periodEnd = s.current_period_end ? new Date(asUtc(s.current_period_end)).getTime() : null;
    const iso = { trialEndsAt: s.trial_ends_at ? new Date(trialEnd!).toISOString() : null, periodEnd: s.current_period_end ? new Date(periodEnd!).toISOString() : null };
    const planKey = s.plan === "starter" || s.plan === "pro" ? (s.plan as "starter" | "pro") : null;

    if (planKey && (s.status === "active" || s.status === "past_due" || s.status === "canceled")) {
      // Pago até current_period_end; depois dele só a tolerância (em atraso) ou nada (cancelada).
      const grace = s.status === "canceled" ? 0 : GRACE_DAYS * DAY;
      const covered = periodEnd === null ? s.status === "active" : now <= periodEnd + grace;
      return { plan: planKey, status: s.status, expired: !covered, limits: PLANS[planKey], ...iso };
    }
    // Teste (ou assinatura ainda não paga): vale o Pro até o fim do teste + tolerância.
    const stillTrial = trialEnd === null || now <= trialEnd + GRACE_DAYS * DAY;
    return { plan: "trial", status: "trialing", expired: !stillTrial, limits: PLANS.pro, ...iso };
  } catch {
    return trial();
  }
}

// Uso do mês (para mostrar na tela e travar o Starter).
export async function getUsage(admin: Admin, businessId: string) {
  const br = new Date(Date.now() - 3 * 3600_000);
  const monthStart = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3)).toISOString(); // 00:00 de Brasília
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? 0 : (r.count ?? 0); };
  const [appointments, services, professionals] = await Promise.all([
    count(admin.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", businessId).neq("status", "canceled").gte("created_at", monthStart)),
    count(admin.from("services").select("id", { count: "exact", head: true }).eq("business_id", businessId)),
    count(admin.from("professionals").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("active", true)),
  ]);
  return { appointments, services, professionals };
}
