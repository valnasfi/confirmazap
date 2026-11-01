import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getPlanInfo } from "@/lib/plans.functions";

export type PlanInfo = Awaited<ReturnType<typeof getPlanInfo>>;

// Plano e uso do negócio logado. Enquanto carrega (ou se falhar), info = null e a tela não trava nada.
export function usePlan() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      setInfo(await getPlanInfo({ data: { accessToken: data.session.access_token } }));
    } catch { /* o servidor confere os limites de qualquer forma */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { info, refresh };
}
