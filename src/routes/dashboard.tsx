import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, useBiz, statusMeta } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { brl, activeHoldFilter, asUtc } from "@/lib/booking";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Painel — ConfirmaZap" }, { name: "description", content: "Resumo do dia e das faltas." }, { property: "og:title", content: "Painel — ConfirmaZap" }, { property: "og:description", content: "Resumo do dia e das faltas." }] }),
  component: () => <AppShell><Dashboard /></AppShell>,
});

type Row = { id: string; start_at: string; status: string; deposit_paid: boolean; customers: { name: string; whatsapp: string } | null; services: { name: string; price: number; deposit_value: number } | null };

type MRow = { status: string; customer_confirmed_at?: string | null; deposit_paid: boolean; services: { price: number } | null };

function Dashboard() {
  const { business } = useBiz();
  const [rows, setRows] = useState<Row[]>([]);
  const [month, setMonth] = useState<MRow[] | null>(null);
  const [stats, setStats] = useState({ today: 0, pending: 0, noShow: 0, deposits: 0 });

  useEffect(() => {
    (async () => {
      const s = new Date(); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setDate(e.getDate() + 1);
      const m = new Date(s.getFullYear(), s.getMonth(), 1);
      const sel = "id,start_at,status,deposit_paid,customers(name,whatsapp),services(name,price,deposit_value)";
      const [{ data: today }, { count: pending }, { count: noShow }, { data: paid }] = await Promise.all([
        supabase.from("appointments").select(sel).eq("business_id", business.id).gte("start_at", s.toISOString()).lt("start_at", e.toISOString()).or(activeHoldFilter()).order("start_at"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "pending").or(activeHoldFilter()),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "no_show").gte("start_at", m.toISOString()),
        supabase.from("appointments").select("services(deposit_value)").eq("business_id", business.id).eq("deposit_paid", true).gte("start_at", m.toISOString()),
      ]);
      // customer_confirmed_at só existe depois do SQL dos lembretes: sem ele, cai na consulta sem a coluna.
      const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      const q = (cols: string) => supabase.from("appointments").select(cols).eq("business_id", business.id).gte("start_at", m.toISOString()).lt("start_at", mEnd.toISOString());
      let mres = await q("status,customer_confirmed_at,deposit_paid,services(price)");
      if (mres.error) mres = await q("status,deposit_paid,services(price)");
      setMonth((mres.data as unknown as MRow[]) ?? []);
      const list = (today as unknown as Row[]) ?? [];
      setRows(list);
      const deposits = ((paid as unknown as { services: { deposit_value: number } | null }[]) ?? []).reduce((a, r) => a + Number(r.services?.deposit_value ?? 0), 0);
      setStats({ today: list.length, pending: pending ?? 0, noShow: noShow ?? 0, deposits });
    })();
  }, [business.id]);

  // Valores do dia (preço do serviço). Cancelados ficam fora; faltas saem do total.
  const live = rows.filter((r) => r.status !== "canceled");
  const sum = (l: Row[]) => l.reduce((a, r) => a + Number(r.services?.price ?? 0), 0);
  const planned = live;
  const done = live.filter((r) => r.status === "confirmed" || r.status === "showed");
  const awaiting = live.filter((r) => r.status === "pending");
  const missed = live.filter((r) => r.status === "no_show");
  const kept = live.filter((r) => r.status !== "no_show");

  const cards = [
    { l: "Agendamentos hoje", v: stats.today },
    { l: "Pendentes", v: stats.pending },
    { l: "Faltas no mês", v: stats.noShow },
    { l: "Sinais recebidos no mês", v: brl(stats.deposits), hi: true },
  ];
  const money = [
    { l: "Previsto do dia", v: brl(sum(planned)), n: planned.length },
    { l: "Confirmados / compareceram", v: brl(sum(done)), n: done.length },
    { l: "Aguardando confirmação", v: brl(sum(awaiting)), n: awaiting.length },
    { l: "Faltas (não entram)", v: brl(sum(missed)), n: missed.length },
    { l: "Total do dia", v: brl(sum(kept)), n: kept.length, hi: true },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold">Olá, {business.name}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className={`rounded-2xl p-5 shadow-card ${c.hi ? "bg-ink text-ink-foreground" : "bg-card"}`}>
            <p className="text-sm opacity-70">{c.l}</p><p className="mt-2 font-display text-3xl font-bold">{c.v}</p>
          </div>
        ))}
      </div>
      {month && (() => {
        const price = (r: MRow) => Number(r.services?.price ?? 0);
        const showed = month.filter((r) => r.status === "showed");
        const noShow = month.filter((r) => r.status === "no_show");
        const canceled = month.filter((r) => r.status === "canceled");
        const confirmedShowed = showed.filter((r) => r.customer_confirmed_at);
        const decided = showed.length + noShow.length;
        const rate = decided > 0 ? Math.round((showed.length / decided) * 100) : null;
        const avoided = confirmedShowed.length + canceled.length;
        const avoidedValue = [...confirmedShowed, ...canceled].reduce((a, r) => a + price(r), 0);
        const lost = noShow.reduce((a, r) => a + price(r), 0);
        const items = [
          { l: "Faltas evitadas", v: String(avoided), sub: `≈ ${brl(avoidedValue)} protegidos`, hi: true },
          { l: "Confirmaram pelo link e vieram", v: String(confirmedShowed.length), sub: "confirmaram no link do lembrete" },
          { l: "Cancelaram antes", v: String(canceled.length), sub: "horário liberado para outro cliente" },
          { l: "Taxa de comparecimento", v: rate === null ? "—" : `${rate}%`, sub: `${showed.length} vieram · ${noShow.length} faltaram` },
          { l: "Perdido com faltas", v: brl(lost), sub: `${noShow.length} ${noShow.length === 1 ? "falta" : "faltas"} no mês` },
        ];
        return (<>
          <h2 className="mt-10 text-xl font-semibold">Faltas evitadas no mês</h2>
          <p className="mt-1 text-sm text-muted-foreground">Estimativa: soma quem confirmou pelo lembrete e compareceu com quem cancelou antes, liberando o horário. Valores pelo preço do serviço.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {items.map((c) => (
              <div key={c.l} className={`rounded-2xl p-5 shadow-card ${c.hi ? "bg-ink text-ink-foreground" : "bg-card"}`}>
                <p className="text-sm opacity-70">{c.l}</p><p className="mt-2 font-display text-2xl font-bold">{c.v}</p>
                <p className="mt-1 text-xs opacity-70">{c.sub}</p>
              </div>
            ))}
          </div>
        </>);
      })()}
      <h2 className="mt-10 text-xl font-semibold">Valores de hoje</h2>
      <p className="mt-1 text-sm text-muted-foreground">Preço dos serviços agendados para hoje. O total considera confirmações e desconta as faltas; cancelados ficam de fora.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {money.map((c) => (
          <div key={c.l} className={`rounded-2xl p-5 shadow-card ${c.hi ? "bg-ink text-ink-foreground" : "bg-card"}`}>
            <p className="text-sm opacity-70">{c.l}</p><p className="mt-2 font-display text-2xl font-bold">{c.v}</p>
            <p className="mt-1 text-xs opacity-70">{c.n} {c.n === 1 ? "agendamento" : "agendamentos"}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-xl font-semibold">Hoje</h2>
      <div className="mt-3 divide-y rounded-2xl bg-card shadow-card">
        {rows.filter((r) => r.status !== "canceled").length === 0 && <p className="p-5 text-sm text-muted-foreground">Nenhum agendamento hoje.</p>}
        {rows.filter((r) => r.status !== "canceled").map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4">
            <div><p className="font-semibold">{new Date(asUtc(r.start_at)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {r.customers?.name}</p><p className="text-sm text-muted-foreground">{r.services?.name}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusMeta[r.status]?.cls}`}>{statusMeta[r.status]?.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
