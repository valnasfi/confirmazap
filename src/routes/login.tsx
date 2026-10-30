import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — ConfirmaZap" }, { name: "description", content: "Acesse o painel do ConfirmaZap." }, { property: "og:title", content: "Entrar — ConfirmaZap" }, { property: "og:description", content: "Acesse o painel do ConfirmaZap." }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    if (mode === "up" && !res.data.session) { toast.success("Confira seu e-mail para confirmar a conta."); return; }
    nav({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden bg-hero p-10 md:flex md:flex-col md:justify-between">
        <Logo light />
        <p className="max-w-sm font-display text-3xl font-semibold text-ink-foreground">Sua agenda cheia — e cumprida.</p>
      </div>
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-3">
          <h1 className="text-2xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
          {!supabaseConfigured && <p className="rounded-lg bg-st-pending/20 p-3 text-sm">Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para ativar o login.</p>}
          <Input type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Senha" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Cadastrar"}</Button>
          <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tenho conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
