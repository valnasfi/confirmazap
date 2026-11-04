import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Nova senha — ReservaPix" }] }),
  component: ResetPassword,
});

// O link do e-mail "Recuperar senha" chega aqui já com a sessão aberta pelo Supabase.
function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(/session|jwt/i.test(error.message) ? "Link expirado. Peça um novo em Entrar > Esqueci minha senha." : error.message); return; }
    toast.success("Senha alterada!");
    nav({ to: "/dashboard" });
  };
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <Logo />
        <h1 className="text-2xl font-bold">Crie uma nova senha</h1>
        <Input type="password" placeholder="Nova senha (mín. 6 caracteres)" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button className="w-full" disabled={busy}>Salvar senha</Button>
      </form>
    </div>
  );
}
