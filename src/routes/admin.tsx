import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LogOut, ShieldCheck } from "lucide-react";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/AppShell";
import { brl } from "@/lib/booking";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — ConfirmaZap" }, { name: "description", content: "Gestão da plataforma ConfirmaZap." }, { property: "og:title", content: "Admin — ConfirmaZap" }, { property: "og:description", content: "Gestão da plataforma ConfirmaZap." }] }),
  component: AdminPage,
});

type Overview = {
  businesses_total: number; businesses_active: number; businesses_suspended: number; new_businesses_30d: number;
  subs_trialing: number; subs_active: number; subs_past_due: number; subs_canceled: number; trials_ending_7d: number;
  mrr: number; customers_total: number; appointments_30d: number; showed_30d: number; no_show_30d: number;
  deposits_recovered: number; signups_6m: { month: string; count: number }[];
};

type BizRow = {
  id: string; name: string; slug: string; whatsapp: string | null; status: "active" | "suspended"; suspended_reason: string | null;
  created_at: string; owner_email: string | null; last_sign_in_at: string | null;
  plan: string | null; sub_status: string | null; price: number | null; trial_ends_at: string | null; current_period_end: string | null;
  customers_count: number; appointments_30d: number; no_show_30d: number; last_appointment_at: string | null;
};

const planLabel: Record<string, string> = { trial: "Teste", starter: "Starter", pro: "Pro" };
const subLabel: Record<string, { label: string; cls: string }> = {
  trialing: { label: "Em teste", cls: "bg-st-pending/20 text-foreground" },
  active: { label: "Ativa", cls: "bg-st-confirmed/20 text-foreground" },
  past_due: { label: "Inadimplente", cls: "bg-st-noshow/20 text-foreground" },
  canceled: { label: "Cancelada", cls: "bg-st-canceled/25 text-foreground" },
};

const dayMs = 86400000;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / dayMs);
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / dayMs);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const toInputDate = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const fromInputDate = (v: string) => (v ? new Date(v + "T23:59:59").toISOString() : null);
const selectCls = "rounded-lg border bg-background px-2 py-1.5 text-sm";

function AdminPage() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<"loading" | "denied" | "setup" | "ok">("loading");
  const [tab, setTab] = useState<"geral" | "negocios" | "assinaturas">("geral");
  const [ov, setOv] = useState<Overview | null>(null);
  const [rows, setRows] = useState<BizRow[]>([]);

  const load = useCallback(async () => {
    const [o, l] = await Promise.all([supabase.rpc("admin_overview"), supabase.rpc("admin_list_businesses")]);
    const err = o.error ?? l.error;
    if (err) { toast.error(err.message); return; }
    setOv(o.data as Overview);
    setRows((l.data as BizRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) { navigate({ to: "/login" }); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { navigate({ to: "/login" }); return; }
      const { data: ok, error } = await supabase.rpc("is_platform_admin");
      if (error) { setAccess("setup"); return; }
      if (!ok) { setAccess("denied"); return; }
      setAccess("ok");
      load();
    });
  }, []);

  if (access === "loading") return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (access === "setup") return <Notice title="Painel ainda não configurado" text="Rode o arquivo supabase-admin.sql no SQL Editor do Supabase e cadastre seu usuário como super admin." />;
  if (access === "denied") return <Notice title="Acesso restrito" text="Esta área é só para o administrador da plataforma." />;

  const tabs = [
    { id: "geral", label: "Visão geral" },
    { id: "negocios", label: "Negócios" },
    { id: "assinaturas", label: "Assinaturas" },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold"><ShieldCheck className="h-3 w-3" />Super admin</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/dashboard" className="underline">Meu painel</Link>
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><LogOut className="h-3 w-3" />Sair</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-5 md:p-8">
        <div className="flex gap-1 overflow-x-auto border-b">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap px-4 py-2 text-sm ${tab === t.id ? "border-b-2 border-foreground font-semibold" : "text-muted-foreground"}`}>{t.label}</button>
          ))}
          <button onClick={load} className="ml-auto whitespace-nowrap px-4 py-2 text-sm text-muted-foreground underline">Atualizar</button>
        </div>
        <div className="mt-6">
          {tab === "geral" && <Geral ov={ov} rows={rows} />}
          {tab === "negocios" && <Negocios rows={rows} reload={load} />}
          {tab === "assinaturas" && <Assinaturas rows={rows} reload={load} />}
        </div>
      </main>
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-card">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        <Link to="/dashboard" className="mt-5 inline-block text-sm underline">Voltar ao painel</Link>
      </div>
    </div>
  );
}

function Geral({ ov, rows }: { ov: Overview | null; rows: BizRow[] }) {
  const alerts = useMemo(() => {
    const trialing = rows.filter((r) => r.sub_status === "trialing" && r.trial_ends_at);
    return {
      ending: trialing.filter((r) => { const d = daysLeft(r.trial_ends_at as string); return d >= 0 && d <= 7; }),
      expired: trialing.filter((r) => daysLeft(r.trial_ends_at as string) < 0),
      pastDue: rows.filter((r) => r.sub_status === "past_due"),
      inactive: rows.filter((r) => r.status === "active" && (!r.last_appointment_at || daysSince(r.last_appointment_at) > 14)),
    };
  }, [rows]);

  if (!ov) return <p className="text-sm text-muted-foreground">Carregando indicadores…</p>;

  const done = ov.showed_30d + ov.no_show_30d;
  const noShowRate = done > 0 ? Math.round((ov.no_show_30d / done) * 100) : 0;
  const cards = [
    { l: "Receita mensal (MRR)", v: brl(Number(ov.mrr)), hi: true },
    { l: "Assinaturas ativas", v: ov.subs_active },
    { l: "Em teste", v: ov.subs_trialing },
    { l: "Testes acabando (7 dias)", v: ov.trials_ending_7d },
    { l: "Inadimplentes", v: ov.subs_past_due },
    { l: "Canceladas", v: ov.subs_canceled },
    { l: "Negócios ativos", v: ov.businesses_active },
    { l: "Negócios bloqueados", v: ov.businesses_suspended },
    { l: "Novos negócios (30 dias)", v: ov.new_businesses_30d },
    { l: "Agendamentos (30 dias)", v: ov.appointments_30d },
    { l: "Taxa de falta (30 dias)", v: `${noShowRate}%` },
    { l: "Sinais recuperados", v: brl(Number(ov.deposits_recovered)) },
  ];
  const maxSignups = Math.max(1, ...ov.signups_6m.map((s) => s.count));

  const lists = [
    { t: "Testes acabando em até 7 dias", items: alerts.ending, extra: (r: BizRow) => `${daysLeft(r.trial_ends_at as string)} dia(s)` },
    { t: "Testes vencidos sem assinar", items: alerts.expired, extra: (r: BizRow) => `venceu há ${Math.abs(daysLeft(r.trial_ends_at as string))} dia(s)` },
    { t: "Inadimplentes", items: alerts.pastDue, extra: (r: BizRow) => `${planLabel[r.plan ?? ""] ?? "—"} · ${brl(Number(r.price ?? 0))}` },
    { t: "Sem agendamentos há mais de 14 dias", items: alerts.inactive, extra: (r: BizRow) => (r.last_appointment_at ? `último há ${daysSince(r.last_appointment_at)} dia(s)` : "nunca teve") },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className={`rounded-2xl p-5 shadow-card ${c.hi ? "bg-ink text-ink-foreground" : "bg-card"}`}>
            <p className="text-sm opacity-70">{c.l}</p>
            <p className="mt-2 font-display text-3xl font-bold">{c.v}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Atenção</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {lists.map((g) => (
          <div key={g.t} className="rounded-2xl bg-card p-5 shadow-card">
            <p className="font-semibold">{g.t} <span className="text-muted-foreground">({g.items.length})</span></p>
            {g.items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum.</p>}
            <ul className="mt-2 divide-y text-sm">
              {g.items.slice(0, 6).map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-1.5"><span className="truncate">{r.name}</span><span className="shrink-0 text-muted-foreground">{g.extra(r)}</span></li>
              ))}
            </ul>
            {g.items.length > 6 && <p className="mt-1 text-xs text-muted-foreground">e mais {g.items.length - 6} na aba Negócios.</p>}
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Novos negócios por mês</h2>
      <div className="mt-3 space-y-2 rounded-2xl bg-card p-5 shadow-card">
        {ov.signups_6m.map((s) => (
          <div key={s.month} className="flex items-center gap-3 text-sm">
            <span className="w-16 text-muted-foreground">{s.month}</span>
            <div className="h-3 flex-1 rounded-full bg-secondary"><div className="h-3 rounded-full bg-accent" style={{ width: `${(s.count / maxSignups) * 100}%` }} /></div>
            <span className="w-8 text-right font-semibold">{s.count}</span>
          </div>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">{ov.businesses_total} negócios no total · {ov.customers_total} clientes finais cadastrados.</p>
      </div>
    </div>
  );
}

function Negocios({ rows, reload }: { rows: BizRow[]; reload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | "active" | "suspended">("todos");

  const shown = rows.filter((r) => {
    if (filter !== "todos" && r.status !== filter) return false;
    const t = q.trim().toLowerCase();
    return !t || r.name.toLowerCase().includes(t) || r.slug.toLowerCase().includes(t) || (r.owner_email ?? "").toLowerCase().includes(t);
  });

  const toggle = async (r: BizRow) => {
    const suspend = r.status === "active";
    let reason: string | null = null;
    if (suspend) {
      reason = window.prompt(`Motivo do bloqueio de "${r.name}" (o dono vai ver esta mensagem):`, "Pagamento pendente");
      if (reason === null) return;
    } else if (!window.confirm(`Liberar o negócio "${r.name}"?`)) return;
    const { error } = await supabase.rpc("admin_set_business_status", { _business_id: r.id, _suspend: suspend, _reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success(suspend ? "Negócio bloqueado" : "Negócio liberado");
    reload();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Buscar por nome, link ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={selectCls} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="todos">Todos</option>
          <option value="active">Ativos</option>
          <option value="suspended">Bloqueados</option>
        </select>
        <span className="self-center text-sm text-muted-foreground">{shown.length} de {rows.length}</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Negócio</th><th className="p-3">Dono</th><th className="p-3">Plano</th><th className="p-3">Criado</th><th className="p-3">Clientes</th><th className="p-3">Agend. 30d</th><th className="p-3">Faltas 30d</th><th className="p-3">Último agend.</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y">
            {shown.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={9}>Nenhum negócio encontrado.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id} className={r.status === "suspended" ? "bg-st-noshow/10" : ""}>
                <td className="p-3">
                  <a className="font-semibold underline" href={`/agendar/${r.slug}`} target="_blank" rel="noreferrer">{r.name}</a>
                  <p className="text-xs text-muted-foreground">/{r.slug}{r.status === "suspended" && r.suspended_reason ? ` · bloqueado: ${r.suspended_reason}` : ""}</p>
                </td>
                <td className="p-3">{r.owner_email ?? "—"}<p className="text-xs text-muted-foreground">último acesso {fmtDate(r.last_sign_in_at)}</p></td>
                <td className="p-3">
                  <span className="font-medium">{planLabel[r.plan ?? ""] ?? "—"}</span>
                  {r.sub_status && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${subLabel[r.sub_status]?.cls}`}>{subLabel[r.sub_status]?.label}</span>}
                </td>
                <td className="p-3">{fmtDate(r.created_at)}</td>
                <td className="p-3">{r.customers_count}</td>
                <td className="p-3">{r.appointments_30d}</td>
                <td className="p-3">{r.no_show_30d}</td>
                <td className="p-3">{fmtDate(r.last_appointment_at)}</td>
                <td className="p-3 text-right"><Button size="sm" variant={r.status === "active" ? "outline" : "default"} onClick={() => toggle(r)}>{r.status === "active" ? "Bloquear" : "Liberar"}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Assinaturas({ rows, reload }: { rows: BizRow[]; reload: () => Promise<void> }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">Defina o plano, o valor mensal e as datas de cada negócio. A receita mensal (MRR) soma só as assinaturas com situação "Ativa".</p>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Negócio</th><th className="p-3">Plano</th><th className="p-3">Situação</th><th className="p-3">Valor mensal (R$)</th><th className="p-3">Fim do teste</th><th className="p-3">Próximo vencimento</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Nenhum negócio cadastrado.</td></tr>}
            {rows.map((r) => <SubRow key={r.id + (r.sub_status ?? "") + (r.plan ?? "")} r={r} reload={reload} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubRow({ r, reload }: { r: BizRow; reload: () => Promise<void> }) {
  const [plan, setPlan] = useState(r.plan ?? "trial");
  const [status, setStatus] = useState(r.sub_status ?? "trialing");
  const [price, setPrice] = useState(String(r.price ?? 0));
  const [trial, setTrial] = useState(toInputDate(r.trial_ends_at));
  const [period, setPeriod] = useState(toInputDate(r.current_period_end));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("subscriptions").upsert(
      { business_id: r.id, plan, status, price: Number(price.replace(",", ".")) || 0, trial_ends_at: fromInputDate(trial), current_period_end: fromInputDate(period), updated_at: new Date().toISOString() },
      { onConflict: "business_id" },
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Assinatura de ${r.name} salva`);
    reload();
  };

  return (
    <tr>
      <td className="p-3 font-semibold">{r.name}<p className="text-xs font-normal text-muted-foreground">{r.owner_email ?? "—"}</p></td>
      <td className="p-3">
        <select className={selectCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="trial">Teste</option><option value="starter">Starter</option><option value="pro">Pro</option>
        </select>
      </td>
      <td className="p-3">
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="trialing">Em teste</option><option value="active">Ativa</option><option value="past_due">Inadimplente</option><option value="canceled">Cancelada</option>
        </select>
      </td>
      <td className="p-3"><Input className="w-28" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></td>
      <td className="p-3"><input type="date" className={selectCls} value={trial} onChange={(e) => setTrial(e.target.value)} /></td>
      <td className="p-3"><input type="date" className={selectCls} value={period} onChange={(e) => setPeriod(e.target.value)} /></td>
      <td className="p-3 text-right"><Button size="sm" disabled={busy} onClick={save}>Salvar</Button></td>
    </tr>
  );
}
