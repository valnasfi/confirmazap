import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { PLANS, type PlanKey } from "./plans";
import { getEntitlements } from "./plans.core";
import { asUtc } from "./manage.core";

// Mensalidade dos planos: assinatura recorrente na conta Asaas DA PLATAFORMA (PLATFORM_ASAAS_API_KEY),
// separada da chave de cada negócio (essa recebe os sinais dos clientes).
const base = () => ((process.env["PLATFORM_ASAAS_ENV"] || process.env["ASAAS_ENV"]) === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");

async function platformAsaas(path: string, method: "GET" | "POST" | "DELETE", body?: unknown) {
  const key = process.env["PLATFORM_ASAAS_API_KEY"];
  if (!key) throw new Error("A cobrança dos planos ainda não foi ativada pela plataforma (falta PLATFORM_ASAAS_API_KEY).");
  const res = await fetch(base() + path, {
    method,
    headers: { "Content-Type": "application/json", access_token: key, "User-Agent": "ConfirmaZap" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.errors?.[0]?.description || `Asaas erro ${res.status}`);
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const todayBr = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

async function ownerBusiness(accessToken: string) {
  const admin = getSupabaseAdmin();
  const { data: u } = await admin.auth.getUser(accessToken);
  if (!u.user) throw new Error("Não autenticado");
  const { data: b } = await admin.from("businesses").select("id,name,email,phone,document").eq("owner_id", u.user.id).limit(1).maybeSingle();
  if (!b) throw new Error("Negócio não encontrado");
  return { admin, business: b as { id: string; name: string; email: string | null; phone: string | null; document: string | null } };
}

const SQL_HINT = "A cobrança dos planos ainda não foi ativada no Supabase. Rode o SQL da assinatura.";

export const subscribePlan = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string(), plan: z.enum(["starter", "pro"]) }).parse(i))
  .handler(async ({ data }) => {
    const { admin, business } = await ownerBusiness(data.accessToken);
    const plan = data.plan as PlanKey;
    if (!business.document || !business.email) throw new Error("Complete e-mail e CPF/CNPJ em Configurações > Negócio e regras antes de assinar.");

    const { data: sub, error: subErr } = await admin.from("subscriptions").select("*").eq("business_id", business.id).maybeSingle();
    if (subErr || (sub && !("asaas_subscription_id" in sub))) throw new Error(SQL_HINT);

    const ent = await getEntitlements(admin, business.id);
    const covered = ent.status === "active" && !ent.expired;
    if (covered && ent.plan === plan && sub?.asaas_subscription_id) throw new Error(`Você já está no plano ${PLANS[plan].name}.`);

    // Pedido igual ainda em aberto: devolve a mesma fatura em vez de criar outra assinatura.
    if (sub?.asaas_subscription_id && sub.pending_plan === plan && sub.invoice_url) return { invoiceUrl: sub.invoice_url as string };

    // Troca de plano: encerra a assinatura anterior (se ainda existir) antes de criar a nova.
    if (sub?.asaas_subscription_id) {
      try { await platformAsaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE"); } catch { /* já removida */ }
    }

    let customerId: string | null = sub?.asaas_customer_id ?? null;
    if (!customerId) {
      const c = await platformAsaas("/customers", "POST", {
        name: business.name, email: business.email, cpfCnpj: business.document,
        mobilePhone: business.phone ?? undefined, externalReference: business.id,
      });
      customerId = c.id as string;
    }

    // Quem muda para um plano mais barato só começa a pagar o novo quando o período já pago terminar.
    const periodEnd = sub?.current_period_end ? new Date(asUtc(sub.current_period_end)) : null;
    const downgrade = covered && ent.plan !== "trial" && PLANS[plan].price < ent.limits.price && periodEnd && periodEnd.getTime() > Date.now();
    const nextDueDate = downgrade ? new Date(periodEnd!.getTime() - 3 * 3600_000).toISOString().slice(0, 10) : todayBr();

    const created = await platformAsaas("/subscriptions", "POST", {
      customer: customerId,
      billingType: "UNDEFINED", // o cliente escolhe Pix, boleto ou cartão na fatura
      value: PLANS[plan].price,
      nextDueDate,
      cycle: "MONTHLY",
      description: `ConfirmaZap ${PLANS[plan].name}`,
      externalReference: `biz:${business.id}`,
    });

    let invoiceUrl: string | null = null;
    for (let i = 0; i < 3 && !invoiceUrl; i++) {
      const list = await platformAsaas(`/subscriptions/${created.id}/payments`, "GET");
      invoiceUrl = (list?.data?.[0]?.invoiceUrl as string | undefined) ?? null;
      if (!invoiceUrl) await sleep(800);
    }

    const { error } = await admin.from("subscriptions").upsert(
      { business_id: business.id, asaas_subscription_id: created.id, asaas_customer_id: customerId, pending_plan: plan, invoice_url: invoiceUrl, updated_at: new Date().toISOString() },
      { onConflict: "business_id" },
    );
    if (error) throw new Error(error.message);
    return { invoiceUrl };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { admin, business } = await ownerBusiness(data.accessToken);
    const { data: sub } = await admin.from("subscriptions").select("*").eq("business_id", business.id).maybeSingle();
    if (!sub?.asaas_subscription_id) return { ok: true };
    try { await platformAsaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE"); } catch (e) {
      if (!/n[ãa]o encontrad|not found/i.test((e as Error).message)) throw e;
    }
    // Quem já pagou continua com o plano até o fim do período; quem ainda estava no teste só perde a fatura aberta.
    const patch: Record<string, unknown> = { asaas_subscription_id: null, pending_plan: null, invoice_url: null, updated_at: new Date().toISOString() };
    if (sub.status === "active" || sub.status === "past_due") patch["status"] = "canceled";
    const { error } = await admin.from("subscriptions").update(patch).eq("business_id", business.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
