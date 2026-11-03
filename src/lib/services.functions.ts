import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getEntitlements, getUsage } from "./plans.core";

// Cadastro de serviço pelo servidor, para o limite do plano valer de verdade (Starter: 15 serviços).
export const addService = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      accessToken: z.string(),
      name: z.string().trim().min(1).max(120),
      duration: z.number().int().positive().max(1440),
      price: z.number().min(0),
      deposit: z.number().min(0),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: u } = await admin.auth.getUser(data.accessToken);
    if (!u.user) throw new Error("Não autenticado");
    const { data: b } = await admin.from("businesses").select("id").eq("owner_id", u.user.id).limit(1).maybeSingle();
    if (!b) throw new Error("Negócio não encontrado");

    const [ent, usage] = await Promise.all([getEntitlements(admin, b.id), getUsage(admin, b.id)]);
    const max = ent.limits.maxServices;
    if (max !== null && usage.services >= max) throw new Error(`O plano ${ent.limits.name} permite ${max} serviços. Para cadastrar mais, faça upgrade em Configurações > Plano.`);

    const { error } = await admin.from("services").insert({ business_id: b.id, name: data.name, duration_minutes: data.duration, price: data.price, deposit_value: data.deposit });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
