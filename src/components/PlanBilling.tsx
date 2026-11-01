import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { brl } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Sub = { plan: string; status: string; price: number; trial_ends_at: string | null; current_period_end: string | null };

const PLAN: Record<string, string> = { trial: "Teste grátis", starter: "Starter", pro: "Pro" };
const STATUS: Record<string, { label: string; cls: string }> = {
  trialing: { label: "Em teste", cls: "bg-st-pending/20" },
  active: { label: "Ativa", cls: "bg-st-confirmed/20" },
  past_due: { label: "Pagamento em atraso", cls: "bg-st-noshow/20" },
  canceled: { label: "Cancelada", cls: "bg-st-canceled/25" },
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export function PlanBilling() {
  const { business, reload } = useBiz();
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [asaas, setAsaas] = useState(business.asaas_api_key ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("subscriptions").select("plan,status,price,trial_ends_at,current_period_end").eq("business_id", business.id).maybeSingle()
      .then(({ data, error }) => setSub(error ? null : (data as Sub | null)));
  }, [business.id]);

  const saveAsaas = async () => {
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ asaas_api_key: asaas.trim() || null }).eq("id", business.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Chave salva");
    reload();
  };

  const card = "rounded-2xl bg-card p-6 shadow-card";
  const st = sub ? STATUS[sub.status] : null;
  const daysLeft = sub?.status === "trialing" && sub.trial_ends_at ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5" />Seu plano</h2>
        {sub === undefined ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        ) : !sub ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma assinatura encontrada para este negócio.</p>
        ) : (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Plano</dt><dd className="mt-1 font-semibold">{PLAN[sub.plan] ?? sub.plan}</dd></div>
            <div><dt className="text-muted-foreground">Situação</dt><dd className="mt-1">{st && <span className={`rounded-full px-2 py-1 text-xs ${st.cls}`}>{st.label}</span>}</dd></div>
            <div><dt className="text-muted-foreground">Valor mensal</dt><dd className="mt-1 font-semibold">{Number(sub.price) > 0 ? brl(sub.price) : "Grátis"}</dd></div>
            <div>
              <dt className="text-muted-foreground">{sub.status === "trialing" ? "Teste termina em" : "Próxima renovação"}</dt>
              <dd className="mt-1 font-semibold">{day(sub.status === "trialing" ? sub.trial_ends_at : sub.current_period_end)}{daysLeft !== null && <span className="ml-2 text-xs font-normal text-muted-foreground">({daysLeft} {daysLeft === 1 ? "dia" : "dias"})</span>}</dd>
            </div>
          </dl>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Para mudar de plano ou tirar dúvidas sobre cobrança, fale com o suporte do ConfirmaZap.</p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Recebimento do sinal por Pix</h2>
        <p className="mt-1 text-sm text-muted-foreground">O sinal pago pelos seus clientes cai direto na sua conta do Asaas. Cole aqui a chave de API da sua conta para ativar o recebimento.</p>
        <label className="mt-4 block text-sm">Chave de API do Asaas
          <Input className="mt-1 max-w-md" type="password" autoComplete="off" value={asaas} onChange={(e) => setAsaas(e.target.value)} />
        </label>
        <Button className="mt-4" disabled={saving} onClick={saveAsaas}>{saving ? "Salvando…" : "Salvar chave"}</Button>
      </section>
    </div>
  );
}
