import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, LayoutDashboard, LogOut, Receipt, Settings, Users, MessageCircleHeart } from "lucide-react";
import { supabase, supabaseConfigured, type Business } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

type Ctx = { session: Session; business: Business; reload: () => Promise<void> };
const BizCtx = createContext<Ctx | null>(null);
export const useBiz = () => {
  const c = useContext(BizCtx);
  if (!c) throw new Error("useBiz fora do AppShell");
  return c;
};

const nav = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/cobrancas", label: "Cobranças", icon: Receipt },
  { to: "/config", label: "Configurações", icon: Settings },
] as const;

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2 font-display text-lg font-bold ${light ? "text-ink-foreground" : "text-foreground"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground"><MessageCircleHeart className="h-5 w-5" /></span>
      ConfirmaZap
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "nobiz">("loading");

  const load = async (s: Session) => {
    const { data } = await supabase.from("businesses").select("*").eq("owner_id", s.user.id).maybeSingle();
    if (data) { setBusiness(data as Business); setState("ready"); } else setState("nobiz");
  };

  useEffect(() => {
    if (!supabaseConfigured) { navigate({ to: "/login" }); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      else { setSession(data.session); load(data.session); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === "SIGNED_OUT") navigate({ to: "/login" });
      if (s) setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === "loading" || !session) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (state === "nobiz" || !business) return <CreateBusiness session={session} onDone={() => load(session)} />;

  return (
    <BizCtx.Provider value={{ session, business, reload: () => load(session) }}>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-5 text-sidebar-foreground md:flex">
          <Logo light />
          <nav className="mt-8 flex flex-col gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-80 hover:bg-sidebar-accent hover:opacity-100"
                activeProps={{ className: "bg-sidebar-accent !opacity-100 font-semibold" }}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto text-xs opacity-70">
            <p className="font-semibold">{business.name}</p>
            <a className="underline" href={`/agendar/${business.slug}`} target="_blank" rel="noreferrer">/agendar/{business.slug}</a>
            <button onClick={() => supabase.auth.signOut()} className="mt-4 flex items-center gap-2 hover:opacity-100"><LogOut className="h-3 w-3" />Sair</button>
          </div>
        </aside>
        <div className="flex-1">
          <div className="flex gap-1 overflow-x-auto border-b bg-card p-2 md:hidden">
            {nav.map((n) => <Link key={n.to} to={n.to} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm" activeProps={{ className: "bg-secondary font-semibold" }}>{n.label}</Link>)}
          </div>
          <main className="mx-auto max-w-6xl p-5 md:p-8">{children}</main>
        </div>
      </div>
    </BizCtx.Provider>
  );
}

function CreateBusiness({ session, onDone }: { session: Session; onDone: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    const { error } = await supabase.from("businesses").insert({ name, slug, owner_id: session.user.id });
    if (error) setErr(error.message); else onDone();
  };
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-card">
        <h1 className="text-2xl font-bold">Crie seu negócio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seu link público será /agendar/{slug || "seu-negocio"}</p>
        <input className="mt-6 w-full rounded-lg border bg-background px-3 py-2" placeholder="Nome (ex.: Barbearia do Zé)" value={name}
          onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} />
        <input className="mt-3 w-full rounded-lg border bg-background px-3 py-2" placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        <Button className="mt-5 w-full" disabled={!name || !slug} onClick={save}>Criar</Button>
      </div>
    </div>
  );
}

export const statusMeta: Record<string, { label: string; cls: string; color: string }> = {
  pending: { label: "Pendente", cls: "bg-st-pending/20 text-foreground", color: "var(--st-pending)" },
  confirmed: { label: "Confirmado", cls: "bg-st-confirmed/20 text-foreground", color: "var(--st-confirmed)" },
  showed: { label: "Compareceu", cls: "bg-st-showed/20 text-foreground", color: "var(--st-showed)" },
  no_show: { label: "Falta", cls: "bg-st-noshow/20 text-foreground", color: "var(--st-noshow)" },
  canceled: { label: "Cancelado", cls: "bg-st-canceled/25 text-foreground", color: "var(--st-canceled)" },
};
