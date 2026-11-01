import { Link } from "@tanstack/react-router";
import { usePlan } from "@/lib/usePlan";

// Aviso no topo do painel: teste acabando, assinatura em atraso ou vencida. Some quando está tudo em dia.
export function PlanBanner() {
  const { info } = usePlan();
  if (!info) return null;
  const end = info.status === "trialing" ? info.trialEndsAt : info.periodEnd;
  const days = end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86400000) : null;

  let msg: string | null = null;
  let tone = "bg-st-pending/25";
  if (info.expired) {
    tone = "bg-st-noshow/25";
    msg = "Seu plano venceu: novos agendamentos e os envios automáticos estão pausados. Assine para reativar.";
  } else if (info.status === "past_due") {
    msg = "Há uma mensalidade em atraso. Regularize para não perder o acesso.";
  } else if (info.plan === "trial" && days !== null && days <= 3) {
    msg = days <= 0 ? "Seu teste grátis termina hoje." : `Seu teste grátis termina em ${days} ${days === 1 ? "dia" : "dias"}.`;
  } else if (info.status === "canceled" && days !== null && days <= 7) {
    msg = `Sua assinatura foi cancelada e o acesso vai até ${new Date(end!).toLocaleDateString("pt-BR")}.`;
  }
  if (!msg) return null;
  return (
    <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm ${tone}`} role="status">
      <span>{msg}</span>
      <Link to="/config" className="font-semibold underline">Ver planos</Link>
    </div>
  );
}
