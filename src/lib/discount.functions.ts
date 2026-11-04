import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getEntitlements } from "./plans.core";
import { birthdayDiscountPercent, type BirthdaySettings } from "./birthday";

type Admin = ReturnType<typeof getSupabaseAdmin>;

// % de desconto de aniversário para esse cliente agora (0 = nenhum). Só o plano Pro tem o recurso.
export async function birthdayPercentFor(admin: Admin, businessId: string, customer: { birth_date?: string | null } | null) {
  if (!customer?.birth_date) return 0;
  const { data: b } = await admin.from("businesses").select("settings").eq("id", businessId).maybeSingle();
  const cfg = ((b?.settings ?? {}) as { birthday?: BirthdaySettings }).birthday;
  if (!cfg?.enabled || !cfg.discountPercent) return 0;
  const ent = await getEntitlements(admin, businessId);
  if (ent.expired || !ent.limits.birthday) return 0;
  return birthdayDiscountPercent(customer.birth_date, cfg.discountPercent);
}

// A página de agendamento pergunta pelo CPF digitado (vínculo mais seguro que o telefone); só devolve o percentual, nunca dados do cliente.
export const getBirthdayDiscount = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid(), cpf: z.string().min(11).max(18) }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const cpf = data.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return { percent: 0 };
    const { data: c } = await admin.from("customers").select("birth_date").eq("business_id", data.businessId).eq("cpf", cpf).limit(1).maybeSingle();
    return { percent: await birthdayPercentFor(admin, data.businessId, c) };
  });
