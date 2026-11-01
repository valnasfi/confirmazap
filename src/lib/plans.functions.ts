import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getEntitlements, getUsage } from "./plans.core";

// Plano e uso do negócio do usuário logado (a tela mostra o que falta e o que está bloqueado).
export const getPlanInfo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const { data: u } = await admin.auth.getUser(data.accessToken);
    if (!u.user) throw new Error("Não autenticado");
    const { data: b } = await admin.from("businesses").select("id").eq("owner_id", u.user.id).limit(1).maybeSingle();
    if (!b) throw new Error("Negócio não encontrado");
    const [ent, usage] = await Promise.all([getEntitlements(admin, b.id), getUsage(admin, b.id)]);
    return { ...ent, usage };
  });
