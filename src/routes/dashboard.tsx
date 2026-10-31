import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, useBiz, statusMeta } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { brl, activeHoldFilter } from "@/lib/booking";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Painel — ConfirmaZap" }, { name: "description", content: "Resumo do dia e das faltas." }, { property: "og:title", content: "Painel — ConfirmaZap" }, { property: "og:description", content: "Resumo do dia e das faltas." }] }),
  component: () => <AppShell><Dashboard /></AppShell>,
});

type Row = { id: string; start_at: string; status: string; deposit_paid: boolean; customers: { name: string; whatsapp: string } | null; services: { name: string; deposit_value: number } | null };

function Dashboard() {
  const { business } = useBiz();
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ today: 0, pending: 0, noShow: 0, recovered: 0 });

  useEffect(() => {
    (async () => {
      const s = new Date(); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setDate(e.getDate() + 1);
      const m = new Date(s.getFullYear(), s.getMonth(), 1);
      const sel = "id,start_at,status,deposit_paid,customers(name,whatsapp),services(name,deposit_value)";
      const [{ data: today }, { count: pending }, { count: noShow }, { data: paid }] = await Promise.all([
        supabase.from("appointments").select(sel).eq("business_id", business.id).gte("start_at", s.toISOString()).lt("start_at", e.toISOString()).or(activeHoldFilter()).order("start_at"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "pending").or(activeHoldFilter()),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "no_show").gte("start_at", m.toISOString()),
        supabase.from("appointments").select("services(deposit_value)").eq("business_id", business.id).eq("deposit_paid", true),
      ]);
      const list = (today as unknown as Row[]) ?? [];
      setRows(list);
      const recovered = ((paid as unknown as { services: { deposit_value: number } | null }[]) ?? []).reduce((a, r) => a + Number(r.services?.deposit_value ?? 0), 0);
      setStats({ today: list.length, pending: pending ?? 0, noShow: noShow ?? 0, recovered });
    })();
  }, [business.id]);

  const cards = [
    { l: "Agendamentos hoje", v: stats.today },
    { l: "Pendentes", v: stats.pending },
    { l: "Faltas no mês", v: stats.noShow },
    { l: "Valor recuperado", v: brl(stats.recovered), hi: true },
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
      <h2 className="mt-10 text-xl font-semibold">Hoje</h2>
      <div className="mt-3 divide-y rounded-2xl bg-card shadow-card">
        {rows.length === 0 && <p className="p-5 text-sm text-muted-foreground">Nenhum agendamento hoje.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4">
            <div><p className="font-semibold">{new Date(r.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {r.customers?.name}</p><p className="text-sm text-muted-foreground">{r.services?.name}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusMeta[r.status]?.cls}`}>{statusMeta[r.status]?.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
