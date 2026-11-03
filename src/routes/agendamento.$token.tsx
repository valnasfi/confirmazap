import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { minAdvanceMs } from "@/lib/booking";
import { generateSlotsFor, isDayOpen, readSchedule, type Schedule } from "@/lib/schedule";
import { getSchedule } from "@/lib/schedule.functions";
import { getBusySlots } from "@/lib/asaas.functions";
import { cancelByToken, confirmByToken, getManage, rescheduleByToken } from "@/lib/manage.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/agendamento/$token")({
  head: () => ({ meta: [{ title: "Seu agendamento — ReservaPix" }, { name: "robots", content: "noindex" }, { name: "description", content: "Veja, cancele ou remarque o seu horário." }] }),
  component: Manage,
});

type Info = Awaited<ReturnType<typeof getManage>>;
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });

function Manage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [sch, setSch] = useState<Schedule>(readSchedule(null));
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"view" | "cancel" | "reschedule" | "done">("view");
  const [doneMsg, setDoneMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptLate, setAcceptLate] = useState(false);
  const [day, setDay] = useState<Date | null>(null);
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<Date | null>(null);

  const load = () => getManage({ data: { token } }).then(setInfo).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, [token]);
  useEffect(() => { if (info?.businessId) getSchedule({ data: { businessId: info.businessId } }).then((x) => setSch(x as Schedule)).catch(() => {}); }, [info?.businessId]);

  const days = useMemo(() => {
    const out: Date[] = []; const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; out.length < 12 && i < 120; i++) { if (isDayOpen(d, sch)) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  }, [sch]);

  useEffect(() => {
    if (!info || !day) return;
    const to = new Date(day); to.setDate(to.getDate() + 1);
    getBusySlots({ data: { businessId: info.businessId, from: day.toISOString(), to: to.toISOString(), professionalId: info.professionalId } }).then(setBusySlots).catch(() => setBusySlots([]));
  }, [info, day]);

  const slots = useMemo(() => (day && info ? generateSlotsFor(day, info.durationMinutes, busySlots, sch).filter((s) => s.getTime() > Date.now() + minAdvanceMs()) : []), [day, info, busySlots]);

  const doConfirm = async () => {
    setBusy(true);
    try {
      await confirmByToken({ data: { token } });
      toast.success("Presença confirmada. Te esperamos!");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      const r = await cancelByToken({ data: { token, acceptLate } });
      if (!r.ok) { toast.error("Marque a opção para confirmar o cancelamento."); setBusy(false); return; }
      setDoneMsg(r.refund ? "Agendamento cancelado. O estabelecimento fará a devolução do sinal." : "Agendamento cancelado.");
      setMode("done");
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const doReschedule = async () => {
    if (!slot) return;
    setBusy(true);
    try {
      const r = await rescheduleByToken({ data: { token, newStartAt: slot.toISOString() } });
      setDoneMsg(`Remarcado para ${fmt(r.startAt)}.`);
      setMode("done");
      load();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const card = "rounded-2xl bg-card p-6 shadow-card";
  const talk = info?.businessWhatsapp ? `https://wa.me/55${info.businessWhatsapp.replace(/\D/g, "")}` : null;

  return (
    <div className="min-h-screen">
      <header className="bg-hero px-6 pb-14 pt-6 text-ink-foreground">
        <div className="mx-auto max-w-2xl">
          <Logo light />
          <div className="mt-8 flex items-center gap-4">
            {info?.logoUrl && <img src={info.logoUrl} alt={`Logo de ${info.businessName}`} className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover shadow-card" />}
            <div><h1 className="text-2xl font-bold">{info?.businessName ?? "Seu agendamento"}</h1><p className="opacity-75">Seu agendamento</p></div>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-8 max-w-2xl space-y-4 px-4 pb-16">
        {error ? (
          <div className={`${card} text-center`}><p>{error}</p></div>
        ) : !info ? (
          <div className={`${card} text-center text-muted-foreground`}>Carregando…</div>
        ) : mode === "done" ? (
          <div className={`${card} text-center`}>
            <h2 className="text-xl font-bold">Pronto!</h2>
            <p className="mt-2 text-sm">{doneMsg}</p>
            <Button className="mt-5" variant="secondary" onClick={() => { setMode("view"); setSlot(null); setDay(null); }}>Ver meu agendamento</Button>
          </div>
        ) : (
          <>
            <section className={card}>
              <p className="text-sm text-muted-foreground">{info.serviceName}</p>
              <p className="mt-1 text-lg font-semibold capitalize">{fmt(info.startAt)}</p>
              <p className="mt-3 text-sm">
                Situação:{" "}
                <b>{info.status === "confirmed" ? "Confirmado" : info.status === "canceled" ? "Cancelado" : info.status === "pending" ? "Aguardando o pagamento do sinal" : info.status === "showed" ? "Concluído" : info.status === "no_show" ? "Falta registrada" : info.status}</b>
              </p>
              {info.status === "canceled" && info.businessSlug && (
                <a className="mt-4 inline-block text-sm font-medium underline" href={`/agendar/${info.businessSlug}`}>Marcar um novo horário</a>
              )}
            </section>

            {info.canChange && mode === "view" && (
              <section className={`${card} space-y-3`}>
                {info.confirmedByCustomer ? (
                  <p className="rounded-xl bg-secondary p-3 text-center text-sm font-semibold">✔ Presença confirmada. Te esperamos!</p>
                ) : (
                  <Button className="w-full" disabled={busy} onClick={doConfirm}>Confirmar minha presença</Button>
                )}
                {info.freeWindow ? (
                  <Button className="w-full" variant="secondary" onClick={() => setMode("reschedule")}>Remarcar meu horário</Button>
                ) : (
                  <p className="rounded-xl bg-muted p-3 text-sm">Faltam menos de {info.cancelHours}h para o horário, então não dá para remarcar por aqui.{talk && <> <a className="font-medium underline" href={talk}>Falar com {info.businessName}</a></>}</p>
                )}
                <Button className="w-full" variant="outline" onClick={() => { setAcceptLate(false); setMode("cancel"); }}>Cancelar agendamento</Button>
              </section>
            )}

            {mode === "cancel" && (
              <section className={`${card} space-y-3`}>
                <h2 className="font-semibold">Cancelar este horário?</h2>
                {info.freeWindow ? (
                  <p className="text-sm text-muted-foreground">{info.depositPaid ? "Como você está dentro do prazo, o sinal será devolvido pelo estabelecimento." : "O horário será liberado."}</p>
                ) : (
                  <label className="flex gap-3 rounded-xl bg-muted p-3 text-sm">
                    <Checkbox checked={acceptLate} onCheckedChange={(v) => setAcceptLate(v === true)} className="mt-0.5" />
                    <span>Faltam menos de {info.cancelHours}h. Entendo que, cancelando agora, <b>o sinal não é devolvido</b>.</span>
                  </label>
                )}
                <div className="flex gap-2">
                  <Button variant="destructive" disabled={busy || (!info.freeWindow && !acceptLate)} onClick={doCancel}>{busy ? "Cancelando…" : "Sim, cancelar"}</Button>
                  <Button variant="ghost" onClick={() => setMode("view")}>Voltar</Button>
                </div>
              </section>
            )}

            {mode === "reschedule" && (
              <section className={card}>
                <h2 className="font-semibold">Escolha o novo dia e horário</h2>
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
                <div className="mt-4 flex gap-2">
                  <Button disabled={!slot || busy} onClick={doReschedule}>{busy ? "Remarcando…" : "Confirmar novo horário"}</Button>
                  <Button variant="ghost" onClick={() => setMode("view")}>Voltar</Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">O sinal que você já pagou continua valendo para o novo horário.</p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
