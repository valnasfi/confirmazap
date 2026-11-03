import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, BellRing, CalendarCheck, CalendarClock, Check, Cake, HeartHandshake, LineChart, MessageCircleHeart,
  QrCode, ShieldCheck, Users, X,
} from "lucide-react";
import { Logo } from "@/components/AppShell";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { brl } from "@/lib/booking";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SIGNUP = "/login?modo=cadastro";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReservaPix — Menos faltas na agenda, mais dinheiro no caixa" },
      { name: "description", content: "Agendamento online com sinal por Pix, lembretes e confirmação pelo WhatsApp. Pare de perder horário com cliente que não aparece. Teste grátis por 7 dias." },
      { property: "og:title", content: "ReservaPix — Acabe com as faltas na sua agenda" },
      { property: "og:description", content: "Sinal por Pix, lembretes no WhatsApp e confirmação por resposta. Teste grátis por 7 dias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const cta = "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-bold text-accent-foreground shadow-lg shadow-black/20 transition hover:brightness-110";
const ghost = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-base font-semibold transition hover:bg-white/10";

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Pain />
      <Steps />
      <Features />
      <Calculator />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
      {/* Barra fixa no celular: o botão de cadastro sempre à mão */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 p-3 backdrop-blur md:hidden">
        <a href={SIGNUP} className={`${cta} w-full`}>Quero testar no meu negócio</a>
      </div>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 text-ink-foreground backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <a href="/" aria-label="ReservaPix"><Logo light /></a>
        <nav className="hidden items-center gap-7 text-sm opacity-80 md:flex">
          <a href="#como-funciona" className="hover:opacity-100">Como funciona</a>
          <a href="#recursos" className="hover:opacity-100">Recursos</a>
          <a href="#planos" className="hover:opacity-100">Planos</a>
          <a href="#duvidas" className="hover:opacity-100">Dúvidas</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="/login" className="rounded-lg px-3 py-2 text-sm font-medium opacity-80 hover:opacity-100">Entrar</a>
          <a href={SIGNUP} className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:brightness-110 sm:inline-block">Testar grátis</a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-hero text-ink-foreground">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-14 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />Feito para quem vive de horário marcado
          </p>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] md:text-6xl">
            Cliente que marca, <span className="text-accent">aparece.</span> Horário que sobra, <span className="text-accent">enche.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-80">
            Seu cliente agenda pelo link, paga um sinal por Pix para garantir o horário e recebe lembrete no WhatsApp. Ele confirma ou cancela respondendo uma mensagem. Você para de perder dinheiro com cadeira vazia.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href={SIGNUP} className={cta}>Quero testar no meu negócio <ArrowRight className="h-5 w-5" /></a>
            <a href="#como-funciona" className={ghost}>Ver como funciona</a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm opacity-80">
            {["Pronto em minutos", "Sem instalar nada", "Funciona com o seu WhatsApp"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" />{t}</li>
            ))}
          </ul>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}

function PhoneMock() {
  const bubble = "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug shadow";
  return (
    <div className="mx-auto w-full max-w-[320px]" aria-hidden="true">
      <div className="rounded-[2.2rem] border-[6px] border-white/15 bg-[oklch(0.95_0.02_150)] p-3 text-[oklch(0.22_0.04_165)] shadow-2xl shadow-black/40">
        <div className="mb-3 flex items-center gap-2 border-b border-black/10 pb-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"><MessageCircleHeart className="h-4 w-4" /></span>
          <div className="text-xs"><b className="block text-sm">Barbearia do Zé</b>online</div>
        </div>
        <div className="space-y-2.5">
          <div className={`${bubble} bg-white`}>Olá, Ana! Lembrete: amanhã às <b>15:00</b>, Corte com o Zé. ✂️<br />Para confirmar, remarcar ou cancelar, toque no link:<br /><u>reservapix.vip/agendamento/…</u></div>
                    <div className="mt-4 rounded-xl bg-primary/10 p-3 text-center text-[11px] font-semibold text-primary">
            <CalendarCheck className="mx-auto mb-1 h-4 w-4" />Presença confirmada na sua agenda
          </div>
        </div>
      </div>
    </div>
  );
}

function Pain() {
  const items = [
    { t: "Cadeira vazia não se recupera", d: "O horário perdido já passou. Ninguém compra aquela hora de volta, e o custo é seu." },
    { t: "Lembrar um por um toma o dia", d: "Mandar mensagem para cada cliente, esperar resposta e anotar à mão é trabalho que ninguém quer fazer." },
    { t: "Sem compromisso, sem garantia", d: "Quando marcar não custa nada, é fácil esquecer, desistir em cima da hora ou nem avisar." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="mx-auto max-w-3xl text-center font-display text-3xl font-bold md:text-4xl">Toda falta é dinheiro que você deixou na mesa</h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">Se você atende por hora marcada, já passou por isso: o horário chega, o cliente não, e a agenda fica com buraco.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <div key={i.t} className="rounded-2xl bg-card p-6 text-center shadow-card">
            <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive"><X className="h-5 w-5" /></span>
            <h3 className="mt-4 text-lg font-semibold">{i.t}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{i.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { i: CalendarCheck, t: "Cliente agenda pelo seu link", d: "Escolhe serviço, profissional, dia e horário em segundos, sem baixar app nem criar conta." },
    { i: QrCode, t: "Paga o sinal por Pix", d: "O valor do sinal você define em cada serviço. Pagou, o horário está garantido, sozinho." },
    { i: BellRing, t: "Recebe lembrete e confirma", d: "O ReservaPix avisa no WhatsApp antes do horário. O cliente abre o link e confirma, remarca ou cancela em um toque." },
    { i: CalendarClock, t: "Você atende, ou reocupa o horário", d: "Quem cancela libera a vaga a tempo. Quem falta recebe um convite automático para remarcar." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-secondary/60 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">Como funciona, do agendamento ao atendimento</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, n) => (
            <div key={s.t} className="relative rounded-2xl bg-card p-6 shadow-card">
              <span className="absolute right-5 top-5 font-display text-4xl font-bold text-primary/15">{n + 1}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><s.i className="h-5 w-5" /></span>
              <h3 className="mt-4 font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const f = [
    { i: BellRing, t: "Lembretes automáticos no WhatsApp", d: "24h e 2h antes do horário, com confirmação por resposta. Sem você digitar nada." },
    { i: ShieldCheck, t: "Sinal por Pix", d: "Horário só fica confirmado depois do pagamento. O dinheiro cai na sua conta Asaas." },
    { i: CalendarClock, t: "Cancelar e remarcar pelo link", d: "O cliente resolve sozinho, dentro da regra que você definir, e a agenda atualiza na hora." },
    { i: Users, t: "Vários profissionais", d: "Cada um com a própria agenda e os próprios serviços. O cliente escolhe com quem agendar." },
    { i: HeartHandshake, t: "Clientes que sumiram voltam", d: "Convite automático para quem está há tempo sem aparecer. Quem não quiser receber responde SAIR." },
    { i: Cake, t: "Feliz aniversário automático", d: "Mensagem no dia, com o seu texto. Pequeno gesto que faz o cliente lembrar de você." },
    { i: MessageCircleHeart, t: "Aviso após falta", d: "Marcou falta? O cliente recebe na hora um convite para remarcar, em vez de sumir." },
    { i: LineChart, t: "Painel de faltas evitadas", d: "Veja quanto foi previsto no dia, o que foi protegido no mês e a taxa de comparecimento." },
  ];
  return (
    <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
      <h2 className="mx-auto max-w-3xl text-center font-display text-3xl font-bold md:text-4xl">Tudo que sua agenda precisa para parar de vazar dinheiro</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {f.map((x) => (
          <div key={x.t} className="rounded-2xl bg-card p-5 shadow-card transition hover:-translate-y-0.5">
            <x.i className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">{x.t}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{x.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Calculator() {
  const [n, setN] = useState(160);
  const [ticket, setTicket] = useState(60);
  const [rate, setRate] = useState(15);
  const loss = Math.round(n * ticket * (rate / 100));
  const half = Math.round(loss / 2);
  const num = (v: string, max: number) => Math.min(max, Math.max(0, Number(v.replace(/\D/g, "")) || 0));
  const field = "mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-lg font-semibold text-white outline-none focus:border-accent";
  return (
    <section className="bg-ink px-5 py-20 text-ink-foreground">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-bold md:text-4xl">Quanto as faltas custam para você por mês?</h2>
          <p className="mt-3 opacity-80">Coloque os seus números. É uma conta simples, só para você enxergar o tamanho do buraco.</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <label className="text-sm opacity-90">Atendimentos por mês<input className={field} inputMode="numeric" value={n} onChange={(e) => setN(num(e.target.value, 5000))} /></label>
            <label className="text-sm opacity-90">Valor médio (R$)<input className={field} inputMode="numeric" value={ticket} onChange={(e) => setTicket(num(e.target.value, 5000))} /></label>
            <label className="text-sm opacity-90">Faltas (%)<input className={field} inputMode="numeric" value={rate} onChange={(e) => setRate(num(e.target.value, 100))} /></label>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
          <p className="text-sm opacity-70">Você deixa de ganhar por mês</p>
          <p className="mt-1 font-display text-5xl font-bold text-accent">{brl(loss)}</p>
          <p className="mt-5 text-sm opacity-80">Se o ReservaPix evitasse só metade dessas faltas, seriam <b className="text-white">{brl(half)}</b> a mais por mês. O plano Pro custa {brl(PLANS.pro.price)}.</p>
          <p className="mt-2 text-xs opacity-60">Cenário ilustrativo com os números que você digitou. O resultado real depende do seu negócio.</p>
          <a href={SIGNUP} className={`${cta} mt-6 w-full`}>Quero parar de perder esse dinheiro</a>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const rows = (p: typeof PLANS.starter) => [
    p.maxAppointmentsPerMonth ? `${p.maxAppointmentsPerMonth} agendamentos por mês` : "Agendamentos ilimitados",
    p.maxServices ? `Até ${p.maxServices} serviços` : "Serviços ilimitados",
    p.maxProfessionals === 1 ? "1 profissional" : `Até ${p.maxProfessionals} profissionais`,
    "Página de agendamento própria",
    "Sinal por Pix",
    "Lembrete 24h antes com link de confirmação",
    "Cancelar e remarcar pelo link",
  ];
  const proExtra = ["Lembrete 2h antes", "Feliz aniversário automático", "Reativação de clientes sumidos", "Campos personalizados no cadastro", "Banner na página de agendamento"];
  return (
    <section id="planos" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-20">
      <h2 className="text-center font-display text-3xl font-bold md:text-4xl">Planos simples, sem pegadinha</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Teste grátis por {TRIAL_DAYS} dias com todos os recursos do Pro. Depois escolha o plano que cabe no seu negócio.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl bg-card p-7 shadow-card">
          <h3 className="text-xl font-bold">{PLANS.starter.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Para quem atende sozinho e está começando.</p>
          <p className="mt-5"><span className="font-display text-5xl font-bold">{brl(PLANS.starter.price)}</span><span className="text-muted-foreground"> /mês</span></p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {rows(PLANS.starter).map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t}</li>)}
          </ul>
          <a href={SIGNUP} className="mt-7 inline-flex w-full items-center justify-center rounded-xl border-2 border-primary px-6 py-3 font-bold text-primary transition hover:bg-primary/5">Começar grátis</a>
        </div>
        <div className="relative rounded-3xl bg-ink p-7 text-ink-foreground shadow-card ring-2 ring-accent">
          <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">Mais completo</span>
          <h3 className="text-xl font-bold">{PLANS.pro.name}</h3>
          <p className="mt-1 text-sm opacity-70">Para quem tem equipe e quer a agenda cheia.</p>
          <p className="mt-5"><span className="font-display text-5xl font-bold text-accent">{brl(PLANS.pro.price)}</span><span className="opacity-70"> /mês</span></p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {rows(PLANS.pro).map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t}</li>)}
            {proExtra.map((t) => <li key={t} className="flex gap-2 font-semibold"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t}</li>)}
          </ul>
          <a href={SIGNUP} className={`${cta} mt-7 w-full`}>Testar o Pro grátis</a>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const q = [
    { q: "Preciso de cartão para testar?", a: `Não. Você cria a conta, configura seu negócio e usa por ${TRIAL_DAYS} dias com os recursos do Pro. Só escolhe um plano se quiser continuar.` },
    { q: "Como o cliente paga o sinal?", a: "Por Pix, na hora de agendar. Você define o valor do sinal em cada serviço e recebe na sua conta Asaas. Quando o pagamento é identificado, o horário é confirmado automaticamente." },
    { q: "Os lembretes saem do meu WhatsApp?", a: "Sim. Você conecta o seu número lendo um QR Code, como no WhatsApp Web, e as mensagens saem por ele. Assim o cliente reconhece o contato." },
    { q: "E se o cliente precisar cancelar ou remarcar?", a: "Ele faz isso sozinho pelo link da mensagem ou respondendo ao lembrete. Você define até quantas horas antes o cancelamento é livre." },
    { q: "Posso ter mais de um profissional?", a: `Sim. O plano Starter inclui 1 profissional e o Pro até ${PLANS.pro.maxProfessionals}. Cada um tem agenda própria e você escolhe quais serviços cada um faz.` },
    { q: "Os dados dos meus clientes ficam seguros?", a: "Os dados ficam protegidos por login e regras de acesso, e cada negócio só enxerga os próprios clientes. Documentos como CPF aparecem mascarados nas telas, em respeito à LGPD." },
    { q: "Posso cancelar quando quiser?", a: "Pode. Você cancela a assinatura pelo próprio painel, sem multa e sem falar com ninguém." },
  ];
  return (
    <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-20">
      <h2 className="text-center font-display text-3xl font-bold md:text-4xl">Perguntas frequentes</h2>
      <Accordion type="single" collapsible className="mt-8 rounded-2xl bg-card px-5 shadow-card">
        {q.map((x, i) => (
          <AccordionItem key={x.q} value={`q${i}`}>
            <AccordionTrigger className="text-left font-semibold">{x.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{x.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-hero px-5 py-20 text-center text-ink-foreground">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl font-bold md:text-5xl">Sua próxima agenda cheia começa hoje</h2>
        <p className="mt-4 text-lg opacity-80">Crie sua conta, conecte o WhatsApp e compartilhe o link. Em poucos minutos seus clientes já podem agendar com sinal e lembrete.</p>
        <a href={SIGNUP} className={`${cta} mt-8`}>Quero testar no meu negócio <ArrowRight className="h-5 w-5" /></a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink px-5 pb-24 pt-10 text-ink-foreground md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm opacity-80 md:flex-row">
        <Logo light />
        <p className="text-center">Feito em Fortaleza, CE | VNF Digital | Suporte no WhatsApp</p>
        <a href="/login" className="hover:opacity-100">Entrar</a>
      </div>
    </footer>
  );
}
