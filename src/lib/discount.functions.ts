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

// A página de agendamento pergunta pelo WhatsApp digitado; só devolve o percentual, nunca dados do cliente.
export const getBirthdayDiscount = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid(), whatsapp: z.string().min(10).max(20) }).parse(i))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const phone = data.whatsapp.replace(/\D/g, "");
    const { data: c } = await admin.from("customers").select("birth_date").eq("business_id", data.businessId).eq("whatsapp", phone).limit(1).maybeSingle();
    return { percent: await birthdayPercentFor(admin, data.businessId, c) };
  });
