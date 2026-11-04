import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { PLANS, TRIAL_DAYS } from "./plans";
import { siteUrl } from "./manage.core";

// Cria um negócio pelo painel do administrador da plataforma (cria o login do dono se ainda não existir).
export const adminCreateBusiness = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    accessToken: z.string(),
    name: z.string().trim().min(2).max(80),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Endereço inválido: use letras minúsculas, números e hífen").max(60),
    ownerEmail: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().max(30).optional(),
    plan: z.enum(["trial", "starter", "pro"]),
  }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: u } = await admin.auth.getUser(data.accessToken);
    if (!u.user) throw new Error("Não autenticado");
    const { data: adm } = await admin.from("platform_admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!adm) throw new Error("Acesso restrito ao administrador da plataforma");

    const { data: taken } = await admin.from("businesses").select("id").eq("slug", data.slug).maybeSingle();
    if (taken) throw new Error("Esse endereço (slug) já está em uso. Escolha outro.");

    // Dono: usa a conta existente ou cria uma nova e manda o e-mail para definir a senha.
    let ownerId: string | null = null;
    for (let page = 1; page <= 10 && !ownerId; page++) {
      const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      ownerId = list.users.find((x) => (x.email ?? "").toLowerCase() === data.ownerEmail)?.id ?? null;
      if (list.users.length < 1000) break;
    }
    let created = false;
    if (ownerId) {
      const { data: has } = await admin.from("businesses").select("id").eq("owner_id", ownerId).limit(1).maybeSingle();
      if (has) throw new Error("Esse e-mail já é dono de outro negócio.");
    } else {
      const { data: nu, error } = await admin.auth.admin.createUser({ email: data.ownerEmail, email_confirm: true });
      if (error || !nu.user) throw new Error(error?.message ?? "Não foi possível criar o usuário");
      ownerId = nu.user.id;
      created = true;
    }

    const digits = (data.phone ?? "").replace(/\D/g, "");
    const { data: biz, error: be } = await admin.from("businesses").insert({
      name: data.name, slug: data.slug, owner_id: ownerId, email: data.ownerEmail,
      ...(digits ? { phone: digits, whatsapp: digits } : {}),
    }).select("id").single();
    if (be || !biz) throw new Error(be?.message ?? "Erro ao criar o negócio");

    const now = Date.now();
    const paid = data.plan !== "trial";
    const { error: se } = await admin.from("subscriptions").upsert({
      business_id: biz.id, plan: data.plan, status: paid ? "active" : "trialing",
      price: paid ? PLANS[data.plan as "starter" | "pro"].price : 0,
      trial_ends_at: paid ? null : new Date(now + TRIAL_DAYS * 86400_000).toISOString(),
      current_period_end: paid ? new Date(now + 30 * 86400_000).toISOString() : null,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "business_id" });
    if (se) throw new Error(se.message);

    let emailed = false;
    if (created) {
      const { error } = await admin.auth.resetPasswordForEmail(data.ownerEmail, { redirectTo: `${siteUrl()}/redefinir-senha` });
      emailed = !error;
    }
    return { ok: true, created, emailed };
  });
