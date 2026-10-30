import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ConfirmaZap — Acabe com as faltas na sua agenda" },
      { name: "description", content: "Agendamento online com garantia via Pix Automático e lembretes no WhatsApp. Menos no-show, mais faturamento." },
      { property: "og:title", content: "ConfirmaZap — Anti No-Show via WhatsApp e Pix" },
      { property: "og:description", content: "Cliente agenda, autoriza o Pix e só paga se faltar sem avisar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-hero text-ink-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between p-6">
        <Logo light />
        <Link to="/login"><Button variant="secondary">Entrar</Button></Link>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Anti no-show</p>
        <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-tight md:text-7xl">Cliente que falta, <span className="text-accent">paga.</span> Cliente que vem, nem percebe.</h1>
        <p className="mt-6 max-w-xl text-lg opacity-80">Agendamento online com autorização Pix Automático. Cobra a taxa só quando o cliente não aparece nem cancela com 4h de antecedência.</p>
        <div className="mt-10 flex gap-3">
          <Link to="/login"><Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">Começar grátis</Button></Link>
        </div>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { i: CalendarCheck, t: "Link de agendamento", d: "Seu cliente escolhe serviço e horário em segundos." },
            { i: QrCode, t: "Autorização Pix", d: "Garantia via Pix Automático, sem cartão." },
            { i: ShieldCheck, t: "Cobrança em 1 clique", d: "Marcou falta? A taxa é cobrada automaticamente." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-6">
              <f.i className="h-6 w-6 text-accent" />
              <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm opacity-75">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
