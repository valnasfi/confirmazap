import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getEntitlements, getUsage } from "./plans.core";

async function ownerBusiness(accessToken: string) {
  const admin = getSupabaseAdmin();
  const { data: u } = await admin.auth.getUser(accessToken);
  if (!u.user) throw new Error("Não autenticado");
  const { data: b } = await admin.from("businesses").select("id").eq("owner_id", u.user.id).limit(1).maybeSingle();
  if (!b) throw new Error("Negócio não encontrado");
  return { admin, businessId: b.id as string };
}

const limitMsg = (name: string, max: number) =>
  `O plano ${name} permite ${max} ${max === 1 ? "profissional" : "profissionais"}. Para adicionar mais, faça upgrade do plano em Configurações > Plano.`;

export const addProfessional = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string(), name: z.string().trim().min(2).max(80) }).parse(i))
  .handler(async ({ data }) => {
    const { admin, businessId } = await ownerBusiness(data.accessToken);
    const [ent, usage] = await Promise.all([getEntitlements(admin, businessId), getUsage(admin, businessId)]);
    if (usage.professionals >= ent.limits.maxProfessionals) throw new Error(limitMsg(ent.limits.name, ent.limits.maxProfessionals));
    const { error } = await admin.from("professionals").insert({ business_id: businessId, name: data.name });
    if (error) throw new Error(/relation|does not exist|schema cache/i.test(error.message) ? "O cadastro de profissionais ainda não foi atualizado no Supabase. Rode o SQL dos profissionais." : error.message);
    return { ok: true };
  });

export const setProfessionalActive = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string(), id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const { admin, businessId } = await ownerBusiness(data.accessToken);
    const { data: p } = await admin.from("professionals").select("id,active").eq("id", data.id).eq("business_id", businessId).maybeSingle();
    if (!p) throw new Error("Profissional não encontrado");
    const usage = await getUsage(admin, businessId);
    if (data.active && !p.active) {
      const ent = await getEntitlements(admin, businessId);
      if (usage.professionals >= ent.limits.maxProfessionals) throw new Error(limitMsg(ent.limits.name, ent.limits.maxProfessionals));
    }
    // A página de agendamento precisa de pelo menos um profissional ativo.
    if (!data.active && p.active && usage.professionals <= 1) throw new Error("Mantenha pelo menos um profissional ativo.");
    const { error } = await admin.from("professionals").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
