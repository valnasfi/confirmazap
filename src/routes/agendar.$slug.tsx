import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase, type Business, type Service } from "@/lib/supabaseClient";
import { generateSlots, isOpenDay, maskWhatsapp, brl } from "@/lib/booking";
import { getBusySlots, createBookingAuth } from "@/lib/asaas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/agendar/$slug")({
  head: () => ({ meta: [{ title: "Agendar horário — ConfirmaZap" }, { name: "description", content: "Escolha o serviço e o horário e confirme seu agendamento." }, { property: "og:title", content: "Agende seu horário" }, { property: "og:description", content: "Agendamento online com confirmação via Pix." }] }),
  component: Booking,
});

function Booking() {
  const { slug } = Route.useParams();
  const [biz, setBiz] = useState<Business | null | undefined>(undefined);
  const [services, setServices] = useState<Service[]>([]);
  const [svc, setSvc] = useState<Service | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [slot, setSlot] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [ok, setOk] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ qrCode: string | null; pixCopyAndPaste: string | null; warning: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from("businesses").select("id,name,slug,whatsapp,logo_url").eq("slug", slug).maybeSingle();
      setBiz(b as Business | null);
      if (b) {
        const { data: s } = await supabase.from("services").select("*").eq("business_id", b.id).eq("active", true).order("name");
        setServices((s as Service[]) ?? []);
      }
    })();
  }, [slug]);

  const days = useMemo(() => {
    const out: Date[] = []; const d = new Date(); d.setHours(0, 0, 0, 0);
    while (out.length < 12) { if (isOpenDay(d)) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  }, []);

  useEffect(() => {
    if (!biz || !day) return;
    const to = new Date(day); to.setDate(to.getDate() + 1);
    getBusySlots({ data: { businessId: biz.id, from: day.toISOString(), to: to.toISOString() } }).then(setBusy).catch(() => setBusy([]));
  }, [biz, day]);

  const slots = useMemo(() => (day && svc ? generateSlots(day, svc.duration_minutes, busy).filter((s) => s > new Date()) : []), [day, svc, busy]);

  const confirm = async () => {
    if (!biz || !svc || !slot) return;
    setSending(true);
    try {
      const r = await createBookingAuth({ data: { businessId: biz.id, serviceId: svc.id, startAt: slot.toISOString(), name, whatsapp: phone, cpf, consent: true } });
      setResult(r);
    } catch (e) { toast.error((e as Error).message); }
    setSending(false);
  };

  if (biz === undefined) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (!biz) return <div className="grid min-h-screen place-items-center">Negócio não encontrado.</div>;

  return (
    <div className="min-h-screen">
      <header className="bg-hero px-6 pb-16 pt-6 text-ink-foreground">
        <div className="mx-auto max-w-2xl"><Logo light /><h1 className="mt-10 text-3xl font-bold">{biz.name}</h1><p className="opacity-75">Agende seu horário</p></div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl space-y-4 px-4 pb-16">
        {result ? (
          <div className="rounded-2xl bg-card p-6 text-center shadow-card">
            <h2 className="text-xl font-bold">Agendamento recebido!</h2>
            <p className="mt-1 text-sm text-muted-foreground">{slot?.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}</p>
            {result.qrCode && <img alt="QR Code Pix" className="mx-auto mt-6 h-56 w-56" src={`data:image/png;base64,${result.qrCode}`} />}
            {result.pixCopyAndPaste && (
              <Button variant="secondary" className="mt-4" onClick={() => { navigator.clipboard.writeText(result.pixCopyAndPaste!); toast.success("Copiado!"); }}><Copy className="mr-2 h-4 w-4" />Pix copia e cola</Button>
            )}
            <p className="mt-4 text-sm">Autorize o Pix no app do seu banco para garantir o horário.</p>
            {result.warning && <p className="mt-3 text-xs text-muted-foreground">{result.warning}</p>}
          </div>
        ) : (<>
          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h2 className="font-semibold">1. Serviço</h2>
            <div className="mt-3 grid gap-2">
              {services.length === 0 && <p className="text-sm text-muted-foreground">Nenhum serviço disponível.</p>}
              {services.map((s) => (
                <button key={s.id} onClick={() => { setSvc(s); setSlot(null); }} className={`flex justify-between rounded-xl border p-3 text-left ${svc?.id === s.id ? "border-primary bg-secondary" : ""}`}>
                  <span><b>{s.name}</b><span className="block text-xs text-muted-foreground">{s.duration_minutes} min</span></span><span>{brl(s.price)}</span>
                </button>
              ))}
            </div>
          </section>
          {svc && <section className="rounded-2xl bg-card p-5 shadow-card">
            <h2 className="font-semibold">2. Dia e horário</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => (
                <button key={d.toISOString()} onClick={() => { setDay(d); setSlot(null); }} className={`min-w-16 rounded-xl border px-3 py-2 text-center text-sm ${day?.getTime() === d.getTime() ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                  <span className="block text-xs capitalize">{d.toLocaleDateString("pt-BR", { weekday: "short" })}</span><b>{d.getDate()}</b>
                </button>
              ))}
            </div>
            {day && <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Sem horários livres.</p>}
              {slots.map((s) => (
                <button key={s.toISOString()} onClick={() => setSlot(s)} className={`rounded-lg border py-2 text-sm ${slot?.getTime() === s.getTime() ? "border-primary bg-accent text-accent-foreground font-semibold" : ""}`}>
                  {s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
            </div>}
          </section>}
          {slot && svc && <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
            <h2 className="font-semibold">3. Seus dados</h2>
            <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="(11) 98765-4321" inputMode="tel" value={phone} onChange={(e) => setPhone(maskWhatsapp(e.target.value))} />
            <Input placeholder="CPF (exigido pelo Pix)" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} />
            <label className="flex gap-3 rounded-xl bg-muted p-3 text-sm">
              <Checkbox checked={ok} onCheckedChange={(v) => setOk(v === true)} className="mt-0.5" />
              <span>Autorizo cobrança de {brl(svc.deposit_value)} via Pix em caso de não comparecimento sem cancelamento com 4h de antecedência. Li os termos.</span>
            </label>
            <Button className="w-full" size="lg" disabled={!ok || name.length < 2 || phone.replace(/\D/g, "").length < 10 || cpf.length !== 11 || sending} onClick={confirm}>
              {sending ? "Confirmando…" : "Confirmar agendamento"}
            </Button>
          </section>}
        </>)}
      </main>
    </div>
  );
}
