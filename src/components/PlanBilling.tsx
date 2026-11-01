import { useState } from "react";
import { toast } from "sonner";
import { Check, CreditCard, X } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { brl } from "@/lib/booking";
import { FEATURE_LABEL, PLANS, type PlanKey, type PlanSpec } from "@/lib/plans";
import { cancelSubscription, subscribePlan } from "@/lib/billing.functions";
import { usePlan } from "@/lib/usePlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS: Record<string, { label: string; cls: string }> = {
  trialing: { label: "Em teste", cls: "bg-st-pending/20" },
  active: { label: "Ativa", cls: "bg-st-confirmed/20" },
  past_due: { label: "Pagamento em atraso", cls: "bg-st-noshow/20" },
  canceled: { label: "Cancelada", cls: "bg-st-canceled/25" },
  none: { label: "Em teste", cls: "bg-st-pending/20" },
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const FEATURES = Object.keys(FEATURE_LABEL) as Array<keyof typeof FEATURE_LABEL>;

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sessão expirada. Entre de novo.");
  return data.session.access_token;
}

function Usage({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{used}{max ? ` de ${max}` : ""}{max === null && " (sem limite)"}</span></div>
      {max !== null && <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${pct >= 100 ? "bg-st-noshow" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

function PlanCard({ id, spec, current, pending, busy, onPick }: { id: PlanKey; spec: PlanSpec; current: boolean; pending: boolean; busy: boolean; onPick: () => void }) {
  const rows: Array<[string, boolean | string]> = [
    ["Agendamentos por mês", spec.maxAppointmentsPerMonth === null ? "Ilimitados" : `Até ${spec.maxAppointmentsPerMonth}`],
    ["Serviços", spec.maxServices === null ? "Ilimitados" : `Até ${spec.maxServices}`],
    ["Profissionais", spec.maxProfessionals === 1 ? "1" : `Até ${spec.maxProfessionals}`],
  ];
  return (
    <div className={`rounded-2xl border p-5 ${current ? "border-primary bg-secondary/40" : ""}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{spec.name}</h3>
        {current && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Seu plano</span>}
      </div>
      <p className="mt-1 text-2xl font-bold">{brl(spec.price)}<span className="text-sm font-normal text-muted-foreground"> /mês</span></p>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><b>{v as string}</b></li>)}
        <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" />Página de agendamento, logo e Pix de sinal</li>
        <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" />WhatsApp, lembrete 24h e confirmação por resposta</li>
        {FEATURES.map((f) => (
          <li key={f} className={`flex items-center gap-2 ${spec[f] ? "" : "text-muted-foreground"}`}>
            {spec[f] ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}{FEATURE_LABEL[f]}
          </li>
        ))}
      </ul>
      <Button className="mt-5 w-full" variant={current ? "secondary" : "default"} disabled={busy || current} onClick={onPick}>
        {current ? "Plano atual" : pending ? `Abrir fatura do ${spec.name}` : `Assinar ${spec.name}`}
      </Button>
    </div>
  );
}

export function PlanBilling() {
  const { business, reload } = useBiz();
  const { info, refresh } = usePlan();
  const [busy, setBusy] = useState(false);
  const [asaas, setAsaas] = useState(business.asaas_api_key ?? "");
  const [saving, setSaving] = useState(false);

  const saveAsaas = async () => {
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ asaas_api_key: asaas.trim() || null }).eq("id", business.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Chave salva");
    reload();
  };

  const subscribe = async (plan: PlanKey) => {
    setBusy(true);
    try {
      const r = await subscribePlan({ data: { accessToken: await token(), plan } });
      if (r.invoiceUrl) { window.open(r.invoiceUrl, "_blank", "noopener"); toast.success("Fatura aberta em outra aba. Depois de pagar, o plano é ativado sozinho."); }
      else toast.success("Assinatura criada. A fatura foi enviada para o seu e-mail.");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const cancel = async () => {
    if (!window.confirm("Cancelar a assinatura? Você continua com o plano até o fim do período já pago.")) return;
    setBusy(true);
    try { await cancelSubscription({ data: { accessToken: await token() } }); toast.success("Assinatura cancelada"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const card = "rounded-2xl bg-card p-6 shadow-card";
  const st = info ? STATUS[info.status] ?? STATUS["none"]! : null;
  const trialPlan = info?.plan === "trial";
  const end = info ? (info.status === "trialing" || info.status === "none" ? info.trialEndsAt : info.periodEnd) : null;

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5" />Seu plano</h2>
        {!info ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Plano</dt><dd className="mt-1 font-semibold">{trialPlan ? "Teste grátis (tudo do Pro)" : info.limits.name}</dd></div>
              <div><dt className="text-muted-foreground">Situação</dt><dd className="mt-1">{info.expired ? <span className="rounded-full bg-st-noshow/25 px-2 py-1 text-xs">Vencido</span> : st && <span className={`rounded-full px-2 py-1 text-xs ${st.cls}`}>{st.label}</span>}</dd></div>
              <div><dt className="text-muted-foreground">Valor mensal</dt><dd className="mt-1 font-semibold">{trialPlan ? "Grátis" : brl(info.limits.price)}</dd></div>
              <div><dt className="text-muted-foreground">{trialPlan ? "Teste termina em" : info.status === "canceled" ? "Acesso até" : "Próxima renovação"}</dt><dd className="mt-1 font-semibold">{day(end)}</dd></div>
            </dl>
            {info.expired && <p className="mt-4 rounded-xl bg-st-noshow/20 p-3 text-sm">Seu plano venceu: novos agendamentos e os envios automáticos estão pausados. Assine abaixo para reativar na hora.</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Usage label="Agendamentos no mês" used={info.usage.appointments} max={info.limits.maxAppointmentsPerMonth} />
              <Usage label="Serviços" used={info.usage.services} max={info.limits.maxServices} />
              <Usage label="Profissionais ativos" used={info.usage.professionals} max={info.limits.maxProfessionals} />
            </div>
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Escolha seu plano</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pague por Pix, boleto ou cartão na fatura do Asaas. O plano é ativado assim que o pagamento é confirmado. Mudar para um plano mais barato só começa a valer depois do período já pago.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(["starter", "pro"] as PlanKey[]).map((id) => (
            <PlanCard key={id} id={id} spec={PLANS[id]} busy={busy || !info}
              current={Boolean(info) && !info!.expired && info!.plan === id && info!.status === "active"}
              pending={info?.pendingPlan === id && Boolean(info?.invoiceUrl)}
              onPick={() => (info?.pendingPlan === id && info.invoiceUrl ? window.open(info.invoiceUrl, "_blank", "noopener") : subscribe(id))} />
          ))}
        </div>
        {info?.hasSubscription && <Button className="mt-4" variant="ghost" disabled={busy} onClick={cancel}>Cancelar assinatura</Button>}
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
