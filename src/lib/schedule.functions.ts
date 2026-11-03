import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { readSchedule } from "./schedule";

// Funcionamento e fechamentos públicos de um negócio (sem motivos, que são só do dono).
export const getSchedule = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ businessId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: b } = await getSupabaseAdmin().from("businesses").select("settings").eq("id", data.businessId).maybeSingle();
    const s = readSchedule(b?.settings);
    return { ...s, blocks: s.blocks.map(({ reason: _r, ...rest }) => rest) };
  });
