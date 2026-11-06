import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, BatteryFull, Check, Copy, Heart, Link2, QrCode, Signal, Wifi } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { brl, HOLD_MINUTES } from "@/lib/booking";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SIGNUP = "/login?modo=cadastro";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReservaPix — Cliente que marca, aparece" },
      { name: "description", content: `Agendamento online em que o horário só é confirmado com o sinal pago por Pix, e lembretes que saem do seu WhatsApp. Configure em minutos. Teste grátis por ${TRIAL_DAYS} dias.` },
      { property: "og:title", content: "ReservaPix — Cliente que marca, aparece" },
      { property: "og:description", content: `Sinal por Pix e lembretes no WhatsApp para acabar com as faltas na agenda. Teste grátis por ${TRIAL_DAYS} dias.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/* Botão principal. No escuro é limão; no claro é floresta (limão some sobre o menta). */
function Cta({ dark, className = "", children = "Teste grátis" }: { dark?: boolean; className?: string; children?: ReactNode }) {
  const tone = dark
    ? "bg-accent text-accent-foreground shadow-lg shadow-black/25 hover:brightness-110 focus-visible:outline-ink-foreground"
    : "bg-ink text-ink-foreground shadow-card hover:bg-[oklch(0.3_0.06_166)] focus-visible:outline-primary";
  return (
    <a href={SIGNUP} className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-[filter,background-color,transform] duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 ${tone} ${className}`}>
      {children}
      <ArrowRight className={`h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 ${dark ? "" : "text-accent"}`} aria-hidden="true" />
    </a>
  );
}

function TrialNote({ dark }: { dark?: boolean }) {
  return <p className={`mt-3 text-sm ${dark ? "text-ink-foreground/70" : "text-muted-foreground"}`}>{TRIAL_DAYS} dias grátis com tudo do Pro. Sem cartão.</p>;
}

/* Entrada das seções: o conteúdo nasce visível; só esconde o que está abaixo da dobra quando o JS roda. */
function useReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
    els.forEach((el) => el.classList.add("rp-out"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove("rp-out"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Index() {
  useReveal();
  // Barra fixa do celular só aparece depois que o botão do hero sai da tela.
  const [bar, setBar] = useState(false);
  useEffect(() => {
    const el = document.getElementById("hero-cta");
    if (!el || typeof IntersectionObserver === "undefined") { setBar(true); return; }
    const io = new IntersectionObserver(([e]) => setBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="rp-landing min-h-screen bg-background">
      <Nav />
      <main>
        <Hero />
        <Pains />
        <Features />
        <Steps />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-[opacity,translate] duration-300 md:hidden ${bar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`} inert={!bar}>
        <Cta dark className="w-full" />
      </div>
    </div>
  );
}

function Nav() {
  const links = [["#recursos", "Recursos"], ["#como-funciona", "Como funciona"], ["#planos", "Planos"], ["#duvidas", "Dúvidas"]];
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 px-4 text-ink-foreground backdrop-blur sm:px-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-3">
        <a href="/" aria-label="ReservaPix, início" className="rounded-md focus-visible:outline-2 focus-visible:outline-accent"><Logo light /></a>
        <nav aria-label="Seções" className="hidden items-center gap-7 text-sm md:flex">
          {links.map(([h, l]) => <a key={h} href={h} className="text-ink-foreground/75 transition-colors hover:text-ink-foreground">{l}</a>)}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <a href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-foreground/80 hover:text-ink-foreground">Entrar</a>
          <a href={SIGNUP} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold whitespace-nowrap text-accent-foreground transition hover:brightness-110 sm:px-4">Teste grátis</a>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="relative bg-hero px-4 text-ink-foreground sm:px-5">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 pb-12 pt-12 md:grid-cols-[1fr_minmax(0,27rem)] md:gap-x-14 md:gap-y-0 md:pb-0 md:pt-20 lg:grid-cols-[1fr_minmax(0,30rem)]">
        {/* No celular a ordem é título, agenda e botão; no desktop a agenda fica ao lado. */}
        <div className="md:col-start-1 md:row-start-1 md:self-end">
          <h1 className="rp-rise font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl lg:text-[4.25rem]">
            Cliente que marca, <span className="text-accent">aparece.</span>
          </h1>
          <p className="rp-rise mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-foreground/80 [animation-delay:90ms]">
            No ReservaPix, o horário só é confirmado quando o cliente paga o sinal por Pix. Depois, ele recebe o lembrete no seu WhatsApp. Você configura em minutos.
          </p>
        </div>
        <div className="rp-rise md:col-start-2 md:row-span-2 md:row-start-1 md:self-center md:translate-y-16 [animation-delay:260ms]">
          <AgendaSim />
        </div>
        <div id="hero-cta" className="rp-rise md:col-start-1 md:row-start-2 md:mt-8 md:pb-28 [animation-delay:180ms]">
          <Cta dark className="w-full sm:w-auto" />
          <TrialNote dark />
        </div>
      </div>
    </section>
  );
}

type Slot = { time: string; service: string; client: string; deposit: number; state: "paid" | "waiting" | "free" };
const SLOTS: Slot[] = [
  { time: "09:00", service: "Limpeza de pele", client: "Ana Souza", deposit: 30, state: "paid" },
  { time: "10:30", service: "Corte e barba", client: "Bruno Lima", deposit: 20, state: "paid" },
  { time: "13:00", service: "Escova", client: "Carla Mendes", deposit: 25, state: "waiting" },
  { time: "14:30", service: "", client: "", deposit: 0, state: "free" },
  { time: "16:00", service: "Avaliação", client: "Diego Rocha", deposit: 40, state: "waiting" },
];

function DepositPill({ paid }: { paid: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground transition-colors duration-500 ${paid ? "bg-st-confirmed/20" : "bg-st-pending/25"}`}>
      <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${paid ? "bg-st-confirmed" : "bg-st-pending"}`} aria-hidden="true" />
      {paid ? "Sinal pago" : "Aguardando sinal"}
    </span>
  );
}

/* Assinatura: o horário das 13:00 sai de "aguardando sinal" para "sinal pago" quando o Pix chega. */
function AgendaSim() {
  const [paid, setPaid] = useState(false);
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPaid(true); return; }
    // Primeiro a linha muda para "Sinal pago"; o aviso chega logo depois, abaixo do card, e sai.
    const a = setTimeout(() => setPaid(true), 2200);
    const b = setTimeout(() => setToast(true), 2550);
    const c = setTimeout(() => setToast(false), 6800);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, []);
  return (
    <figure className="relative mx-auto w-full max-w-md md:max-w-none">
      <div className="overflow-hidden rounded-[1.4rem] bg-card text-card-foreground shadow-[0_30px_60px_-30px_rgb(0_0_0/0.55),0_1px_0_rgb(255_255_255/0.08)_inset] ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
          <div>
            <p className="font-display text-base font-semibold">Agenda de hoje</p>
            <p className="text-xs text-muted-foreground">Terça, 5 profissionais</p>
          </div>
          <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">Simulação</span>
        </div>
        <ul className="divide-y">
          {SLOTS.map((s, i) => {
            const isPaid = s.state === "paid" || (i === 2 && paid);
            const flips = i === 2;
            if (s.state === "free") return (
              <li key={s.time} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <span className="w-12 font-display text-sm font-semibold tabular-nums text-muted-foreground">{s.time}</span>
                <span className="flex-1 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Horário livre na sua página</span>
              </li>
            );
            return (
              <li key={s.time} className={`relative flex items-center gap-4 px-4 py-3 transition-colors duration-700 sm:px-5 ${flips && paid ? "bg-accent/15" : ""}`}>
                <span className="w-12 font-display text-sm font-semibold tabular-nums">{s.time}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.service}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.client}<span className="max-sm:hidden"> · sinal {brl(s.deposit)}</span></p>
                </div>
                <DepositPill paid={isPaid} />
              </li>
            );
          })}
        </ul>
        <p className="border-t bg-muted/60 px-4 py-3 text-xs text-muted-foreground sm:px-5">Só entra como confirmado quem pagou o sinal.</p>
      </div>
      <div
        aria-live="polite"
        className={`absolute -bottom-6 right-3 flex items-center gap-2.5 rounded-xl bg-accent px-3.5 py-2.5 text-accent-foreground shadow-xl shadow-black/25 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:-right-4 ${toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-foreground text-accent"><Check className="h-4 w-4" aria-hidden="true" /></span>
        <span className="text-xs leading-tight"><b className="block text-sm">Pix recebido</b>13:00 confirmado · {brl(25)}</span>
      </div>
      <figcaption className="sr-only">Simulação da agenda do ReservaPix: horários com sinal pago e horários aguardando sinal.</figcaption>
    </figure>
  );
}

/* ---------- Dores ---------- */

function Pains() {
  const pains = [
    { t: "O cliente marca e não vem.", d: "A cadeira fica vazia e não dá tempo de chamar outra pessoa. Aquele horário não volta." },
    { t: "Lembrar um por um toma o seu dia.", d: "Mensagem para cada cliente, resposta que não chega, anotação no caderno. É tempo que era para atender." },
    { t: "Marcar de graça é fácil de esquecer.", d: "Sem nenhum compromisso, o cliente desiste em cima da hora ou nem avisa." },
  ];
  return (
    <section className="px-4 pb-20 pt-20 sm:px-5 md:pt-36">
      <div className="mx-auto max-w-6xl">
        <h2 data-reveal className="rp-reveal max-w-2xl font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-balance md:text-[2.6rem]">
          Toda falta custa o horário inteiro.
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {pains.map((p, i) => (
            <div key={p.t} data-reveal className="rp-reveal border-t-2 border-foreground/80 pt-5" style={{ transitionDelay: `${i * 80}ms` }}>
              <h3 className="font-display text-xl font-semibold leading-snug">{p.t}</h3>
              <p className="mt-3 max-w-[34ch] text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
        <div data-reveal className="rp-reveal mt-12"><Cta /></div>
      </div>
    </section>
  );
}

/* ---------- Recursos com mini tela ---------- */

function Feature({ id, title, text, points, screen, flip }: { id?: string; title: string; text: string; points: string[]; screen: ReactNode; flip?: boolean }) {
  return (
    <div id={id} className="grid scroll-mt-24 items-center gap-10 md:grid-cols-2 md:gap-16">
      <div data-reveal className={`rp-reveal ${flip ? "md:order-2" : ""}`}>
        <h3 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-balance md:text-[2rem]">{title}</h3>
        <p className="mt-4 max-w-[46ch] text-lg text-muted-foreground">{text}</p>
        <ul className="mt-6 space-y-2.5">
          {points.map((p) => <li key={p} className="flex gap-2.5"><Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{p}</li>)}
        </ul>
      </div>
      <div data-reveal className={`rp-reveal ${flip ? "md:order-1" : ""}`}>
        <div className="relative overflow-hidden rounded-[1.75rem] bg-secondary/70 px-5 pb-10 pt-6 sm:px-8 sm:pb-12 sm:pt-8">
          {screen}
          <span className="absolute bottom-3 right-4 rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur">Simulação da tela</span>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="recursos" className="scroll-mt-16 border-t bg-card/60 px-4 py-20 sm:px-5 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="rp-reveal mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-balance md:text-[2.6rem]">Três peças que fecham a porta da falta.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Do agendamento ao atendimento, sem você mandar nenhuma mensagem.</p>
        </div>
        <div className="mt-16 space-y-20 md:space-y-28">
          <Feature
            title="O cliente agenda sozinho, pelo seu link"
            text="Você ganha uma página de agendamento com o nome do seu negócio. O cliente escolhe o serviço, o profissional, o dia e o horário."
            points={["Sem baixar app e sem criar conta", "Só aparecem os horários livres de cada profissional", "Agendamento com pelo menos 4 horas de antecedência"]}
            screen={<MiniBooking />}
          />
          <Feature
            flip
            title="O horário só é confirmado com o sinal pago"
            text="Você define o valor do sinal em cada serviço. O cliente paga por Pix na hora de agendar e o dinheiro cai na sua conta Asaas."
            points={[`A reserva fica guardada por ${HOLD_MINUTES} minutos enquanto o cliente paga`, "Pagou, o horário é confirmado sozinho", "Precisa devolver? Um botão no painel estorna o Pix"]}
            screen={<MiniPix />}
          />
          <Feature
            title="O lembrete sai do seu WhatsApp"
            text="Antes do horário, o cliente recebe uma mensagem do seu número, com o link para confirmar, remarcar ou cancelar."
            points={["24 horas antes no Starter, e também 2 horas antes no Pro", "Você conecta o número lendo um QR Code", "Cancelou a tempo? O horário volta a ficar livre"]}
            screen={<MiniWhatsApp />}
          />
        </div>
      </div>
    </section>
  );
}

/*
 * Foto de uma mão segurando um iPhone (public/landing/iphone-mao.webp), com o fundo
 * e a tela recortados. A tela de verdade é HTML, encaixada no buraco da foto.
 * Medidas em pixels da foto (1042 x 1249); K converte para pixels de CSS.
 */
const HAND = { w: 1042, h: 1249, screenX: 139, screenY: 19, screenW: 467, screenH: 996, radius: 68, phoneCenterX: 372 };
const K = 278 / HAND.screenW; // tela com 278px de largura, como as mini telas foram desenhadas
const px = (n: number) => `${(n * K).toFixed(2)}px`;

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    // A foto termina cortada no punho: o cartão em volta esconde o que passa da borda de baixo.
    <div className="relative -mb-10 sm:-mb-12" style={{ height: px(HAND.h) }}>
      <div className="absolute top-0" style={{ left: `calc(50% - ${px(HAND.phoneCenterX)})`, width: px(HAND.w), height: px(HAND.h) }}>
        <div
          className="absolute flex flex-col overflow-hidden bg-background [&>*:last-child]:grow"
          style={{ left: px(HAND.screenX), top: px(HAND.screenY), width: px(HAND.screenW), height: px(HAND.screenH), borderRadius: px(HAND.radius) }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between px-7 text-[12px] font-semibold text-white" aria-hidden="true">
            <span className="tabular-nums">9:41</span>
            <span className="flex items-center gap-1"><Signal className="h-3.5 w-3.5" /><Wifi className="h-3.5 w-3.5" /><BatteryFull className="h-4 w-4" /></span>
          </div>
          <span className="absolute left-1/2 top-[11px] z-10 h-[23px] w-[80px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          {children}
          <span className="absolute bottom-2 left-1/2 h-[5px] w-28 -translate-x-1/2 rounded-full bg-foreground/80" aria-hidden="true" />
        </div>
        <img src="/landing/iphone-mao.webp" alt="" width={HAND.w} height={HAND.h} loading="lazy" decoding="async" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none drop-shadow-[0_24px_30px_rgb(0_0_0/0.18)]" />
      </div>
    </div>
  );
}

function MiniBooking() {
  const services = [
    { n: "Corte feminino", m: "45 min", p: 80, d: 20 },
    { n: "Escova", m: "40 min", p: 60, d: 15 },
    { n: "Hidratação", m: "50 min", p: 90, d: 25 },
  ];
  return (
    <PhoneFrame>
      <div className="bg-hero px-4 pb-8 pt-12 text-ink-foreground">
        <p className="flex items-center gap-1.5 text-[10px] text-ink-foreground/60"><Link2 className="h-3 w-3" aria-hidden="true" />reservapix.vip/agendar/studio-bela</p>
        <div className="mt-3 flex items-center gap-2.5">
          <img src="/landing/studio-bela-whatsapp.jpg" alt="" width={40} height={40} loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-xl bg-white object-cover ring-2 ring-white/80" />
          <p className="font-display text-base font-bold">Studio Bela</p>
        </div>
      </div>
      <div className="-mt-5 space-y-2 px-3 pb-7">
        <div className="rounded-xl bg-card p-3 shadow-card">
          <p className="text-[11px] font-semibold text-muted-foreground">Serviço</p>
          <ul className="mt-2 space-y-1.5">
            {services.map((s, i) => (
              <li key={s.n} className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <span><b className="block">{s.n}</b><span className="opacity-75">{s.m} · sinal {brl(s.d)}</span></span>
                <b className="tabular-nums">{brl(s.p)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-card p-3 shadow-card">
          <p className="text-[11px] font-semibold text-muted-foreground">Quinta-feira</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold tabular-nums">
            {["09:00", "10:00", "11:30", "14:00", "15:00", "16:30"].map((t, i) => (
              <span key={t} className={`rounded-md py-1.5 ${i === 3 ? "bg-ink text-ink-foreground" : "border"}`}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* Padrão de QR desenhado só para ilustrar (não é um código válido). */
function QrArt() {
  const n = 21;
  const finder = (x: number, y: number) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const cells: ReactNode[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    if (((x * 7 + y * 13 + x * y) % 5) < 2) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  }
  const eye = (x: number, y: number) => (
    <g key={`e${x}${y}`}><rect x={x + 0.5} y={y + 0.5} width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-32 w-32 text-ink" fill="currentColor" aria-hidden="true" shapeRendering="crispEdges">
      {cells}{eye(0, 0)}{eye(n - 7, 0)}{eye(0, n - 7)}
    </svg>
  );
}

function MiniPix() {
  return (
    <div className="mx-auto w-full max-w-[22rem] rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold">Pague o sinal para confirmar</p>
        <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Corte feminino · quinta, 14:00</p>
      <p className="mt-4 font-display text-4xl font-bold tabular-nums">{brl(20)}</p>
      <div className="mt-4 grid place-items-center rounded-xl border bg-white p-3"><QrArt /></div>
      <span className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><Copy className="h-3.5 w-3.5" aria-hidden="true" />Copiar código Pix</span>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-st-confirmed/15 px-3 py-2.5 text-xs">
        <span className="font-semibold">Pagamento identificado</span>
        <DepositPill paid />
      </div>
    </div>
  );
}

function MiniWhatsApp() {
  return (
    <PhoneFrame>
      <div className="flex items-center gap-2.5 bg-ink px-4 pb-3 pt-12 text-ink-foreground">
        <img src="/landing/studio-bela-whatsapp.jpg" alt="" width={36} height={36} loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/20" />
        <span className="text-xs leading-tight"><b className="block text-sm">Studio Bela</b><span className="tabular-nums">(11) 95326-1958</span></span>
      </div>
      <div className="space-y-2.5 bg-[oklch(0.95_0.02_150)] p-3 pb-10 text-[12.5px] leading-snug">
        <p className="w-fit rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] text-muted-foreground">Quarta, 14:00</p>
        <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm">
          Olá, Ana! Lembrete do seu horário na Studio Bela:
          <br /><br />Quinta, 14:00
          <br />Corte feminino
          <br /><br />Para confirmar, remarcar ou cancelar, é só abrir o link:
          <br /><span className="text-primary underline">reservapix.vip/agendamento/…</span>
        </div>
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-[oklch(0.9_0.08_140)] px-3 py-2">Confirmado, até amanhã!</div>
        <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-st-confirmed/20 px-3 py-1 text-[11px] font-semibold"><Check className="h-3.5 w-3.5" aria-hidden="true" />Presença confirmada na agenda</div>
      </div>
    </PhoneFrame>
  );
}

/* ---------- Como funciona ---------- */

function Steps() {
  const steps = [
    { t: "Crie sua conta e cadastre seus serviços", d: "Nome, duração, preço e o valor do sinal de cada um. Se tiver equipe, cadastre os profissionais." },
    { t: "Conecte o WhatsApp e o Asaas", d: "Leia o QR Code com o celular, como no WhatsApp Web, e cole a chave da sua conta Asaas para receber os sinais." },
    { t: "Compartilhe o seu link", d: "Coloque na bio do Instagram e mande no WhatsApp. A partir daí, a agenda se preenche e se confirma sozinha." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-16 bg-ink px-4 py-20 text-ink-foreground sm:px-5 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="rp-reveal max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-balance md:text-[2.6rem]">Pronto em minutos, em três passos.</h2>
          <p className="mt-4 text-lg text-ink-foreground/75">Sem instalar nada. Funciona no navegador do celular ou do computador.</p>
        </div>
        <ol className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-white/10 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} data-reveal className="rp-reveal bg-ink p-6 md:p-8" style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="font-display text-4xl font-bold tabular-nums text-accent">{i + 1}</span>
              <h3 className="mt-6 font-display text-xl font-semibold leading-snug">{s.t}</h3>
              <p className="mt-3 text-ink-foreground/70">{s.d}</p>
            </li>
          ))}
        </ol>
        <div data-reveal className="rp-reveal mt-12"><Cta dark /><TrialNote dark /></div>
      </div>
    </section>
  );
}

/* ---------- Planos ---------- */

function Pricing() {
  const base = (p: typeof PLANS.starter) => [
    p.maxAppointmentsPerMonth ? `${p.maxAppointmentsPerMonth} agendamentos por mês` : "Agendamentos ilimitados",
    p.maxServices ? `Até ${p.maxServices} serviços` : "Serviços ilimitados",
    p.maxProfessionals === 1 ? "1 profissional" : `Até ${p.maxProfessionals} profissionais`,
    "Página de agendamento própria",
    "Sinal por Pix",
    "Lembrete 24h antes no WhatsApp",
    "Cancelar e remarcar pelo link",
  ];
  const proExtra = ["Lembrete 2h antes", "Feliz aniversário automático", "Reativação de clientes sumidos", "Campos personalizados no cadastro", "Banner na página de agendamento"];
  return (
    <section id="planos" className="scroll-mt-16 px-4 py-20 sm:px-5 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div data-reveal className="rp-reveal max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-balance md:text-[2.6rem]">Dois planos. Sem pegadinha.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Os {TRIAL_DAYS} dias de teste têm tudo do Pro. Depois, você escolhe o plano que cabe no seu negócio, ou cancela pelo painel.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div data-reveal className="rp-reveal flex flex-col rounded-3xl bg-card p-7 shadow-card md:p-8">
            <h3 className="font-display text-xl font-bold">{PLANS.starter.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Para quem atende sozinho.</p>
            <p className="mt-6 flex items-baseline gap-1"><span className="font-display text-5xl font-bold tabular-nums">{brl(PLANS.starter.price)}</span><span className="text-muted-foreground">/mês</span></p>
            <ul className="mt-7 flex-1 space-y-2.5 text-sm">
              {base(PLANS.starter).map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{t}</li>)}
            </ul>
            <Cta className="mt-8 w-full" />
          </div>
          <div data-reveal className="rp-reveal relative flex flex-col rounded-3xl bg-ink p-7 text-ink-foreground shadow-card ring-2 ring-accent md:p-8" style={{ transitionDelay: "80ms" }}>
            <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">Mais completo</span>
            <h3 className="font-display text-xl font-bold">{PLANS.pro.name}</h3>
            <p className="mt-1 text-sm text-ink-foreground/70">Para quem tem equipe e quer a agenda cheia.</p>
            <p className="mt-6 flex items-baseline gap-1"><span className="font-display text-5xl font-bold tabular-nums text-accent">{brl(PLANS.pro.price)}</span><span className="text-ink-foreground/70">/mês</span></p>
            <ul className="mt-7 flex-1 space-y-2.5 text-sm">
              {base(PLANS.pro).map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{t}</li>)}
              {proExtra.map((t) => <li key={t} className="flex gap-2 font-semibold"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{t}</li>)}
            </ul>
            <Cta dark className="mt-8 w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Dúvidas ---------- */

function Faq() {
  const q = [
    { q: "Preciso de cartão para testar?", a: `Não. Você cria a conta, configura o seu negócio e usa por ${TRIAL_DAYS} dias com tudo do Pro. Só escolhe um plano se quiser continuar.` },
    { q: "Meu cliente vai aceitar pagar sinal?", a: "Quem decide é você. O valor do sinal é definido em cada serviço, e um serviço pode ficar sem sinal. O cliente vê o valor e a regra antes de confirmar, na sua página de agendamento." },
    { q: "Para onde vai o dinheiro do sinal?", a: "Para a sua conta Asaas. Você cola a chave da sua conta no painel, e cada Pix pago pelo cliente cai direto nela. Quando o pagamento é identificado, o horário é confirmado automaticamente." },
    { q: "Os lembretes saem do meu WhatsApp?", a: "Sim. Você conecta o seu número lendo um QR Code, como no WhatsApp Web, e as mensagens saem por ele. Assim o cliente reconhece o contato." },
    { q: "E se o cliente precisar cancelar ou remarcar?", a: "Ele faz isso sozinho pelo link da mensagem. Você define até quantas horas antes o cancelamento é livre. Se precisar devolver o sinal, um botão no painel estorna o Pix." },
    { q: "Posso ter mais de um profissional?", a: `Sim. O Starter inclui 1 profissional e o Pro até ${PLANS.pro.maxProfessionals}. Cada um tem a própria agenda, e você escolhe quais serviços cada um faz.` },
    { q: "Os dados dos meus clientes ficam seguros?", a: "Os dados ficam protegidos por login e regras de acesso, e cada negócio só enxerga os próprios clientes. Documentos como CPF aparecem mascarados nas telas, em respeito à LGPD." },
    { q: "Posso cancelar quando quiser?", a: "Pode. Você cancela a assinatura pelo próprio painel, sem multa e sem falar com ninguém." },
  ];
  return (
    <section id="duvidas" className="scroll-mt-16 border-t bg-card/60 px-4 py-20 sm:px-5 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-16">
        <div data-reveal className="rp-reveal">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-balance md:text-[2.6rem]">Perguntas frequentes</h2>
          <p className="mt-4 text-muted-foreground">O que os donos de negócio mais perguntam antes de testar.</p>
          <div className="mt-8 hidden md:block"><Cta /></div>
        </div>
        <div data-reveal className="rp-reveal">
          <Accordion type="single" collapsible className="border-t">
            {q.map((x, i) => (
              <AccordionItem key={x.q} value={`q${i}`}>
                <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline">{x.q}</AccordionTrigger>
                <AccordionContent className="max-w-[62ch] pb-5 text-base text-muted-foreground">{x.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-8 md:hidden"><Cta /></div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-hero px-4 py-24 text-ink-foreground sm:px-5 md:py-32">
      <div data-reveal className="rp-reveal mx-auto max-w-3xl text-center">
        <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-balance md:text-6xl">
          Cliente que marca, <span className="text-accent">aparece.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-foreground/80">Sinal por Pix para garantir o horário e lembrete no seu WhatsApp para ninguém esquecer. Configure hoje e compartilhe o link.</p>
        <div className="mt-9"><Cta dark className="w-full sm:w-auto" /><TrialNote dark /></div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink px-4 pb-28 pt-10 text-ink-foreground sm:px-5 md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-sm md:flex-row">
        <Logo light />
        <p className="flex items-center gap-1.5 text-center text-ink-foreground/70">
          Feito com <Heart className="h-4 w-4 fill-accent text-accent" aria-hidden="true" /><span className="sr-only">amor</span> por VNF Digital
        </p>
        <a href="/login" className="text-ink-foreground/70 hover:text-ink-foreground">Entrar</a>
      </div>
    </footer>
  );
}
