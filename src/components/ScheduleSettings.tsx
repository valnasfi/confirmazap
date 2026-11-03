import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, Clock, Trash2 } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { WEEKDAYS, readSchedule, toMin, type Block, type DayHours } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmtDate = (k: string) => k.split("-").reverse().join("/");

// Lê e grava funcionamento, fechamentos e "agenda fechada" em businesses.settings.
function useScheduleStore() {
  const { business, reload } = useBiz();
  const settings = (business.settings ?? {}) as Record<string, unknown>;
  const sch = readSchedule(settings);
  const save = async (patch: Partial<{ hours: DayHours[]; blocks: Block[]; paused: boolean; pausedPros: string[] }>) => {
    const { error } = await supabase.from("businesses").update({ settings: { ...settings, ...patch } }).eq("id", business.id);
    if (error) { toast.error(error.message); return false; }
    await reload();
    return true;
  };
  return { business, sch, save };
}

type Pro = { id: string; name: string };

// Profissionais ativos do negócio (vazio quando a tabela ainda não existe).
function usePros() {
  const { business } = useBiz();
  const [pros, setPros] = useState<Pro[]>([]);
  useEffect(() => {
    supabase.from("professionals").select("id,name").eq("business_id", business.id).eq("active", true).order("created_at")
      .then(({ data, error }) => setPros(error ? [] : ((data ?? []) as Pro[])));
  }, [business.id]);
  return pros;
}

// Quantos agendamentos já existem no período que será fechado (eles não são cancelados sozinhos).
async function countExisting(businessId: string, start: string, end: string, proIds: string[]) {
  const next = new Date(`${end}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  let q = supabase.from("appointments").select("id", { count: "exact", head: true })
    .eq("business_id", businessId).neq("status", "canceled")
    .gte("start_at", `${start}T03:00:00`).lt("start_at", `${next.toISOString().slice(0, 10)}T03:00:00`);
  if (proIds.length) q = q.in("professional_id", proIds);
  const { count } = await q;
  return count ?? 0;
}

function BlockForm({ onDone }: { onDone: () => void }) {
  const { business, sch, save } = useScheduleStore();
  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState("12:00");
  const [to, setTo] = useState("14:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pros = usePros();
  const [who, setWho] = useState<"all" | "some">("all");
  const [picked, setPicked] = useState<string[]>([]);

  const add = async () => {
    if (!start || !end || end < start) { toast.error("Confira as datas: o fim não pode ser antes do início."); return; }
    if (!allDay && !(toMin(from) < toMin(to))) { toast.error("O horário final precisa ser depois do inicial."); return; }
    if (who === "some" && picked.length === 0) { toast.error("Marque pelo menos um profissional."); return; }
    setBusy(true);
    const ids = who === "some" ? picked : [];
    const b: Block = { id: Date.now().toString(36), start, end, ...(allDay ? {} : { from, to }), ...(reason.trim() ? { reason: reason.trim() } : {}), ...(ids.length ? { professionalIds: ids } : {}) };
    const n = await countExisting(business.id, start, end, ids);
    const ok = await save({ blocks: [...sch.blocks, b] });
    setBusy(false);
    if (!ok) return;
    toast.success(n > 0 ? `Agenda fechada. Atenção: já existem ${n} agendamento(s) nesse período, e eles não foram cancelados.` : "Agenda fechada nesse período.");
    onDone();
  };

  return (
    <div className="space-y-3">
      {pros.length > 1 && (
        <div className="text-sm">
          <p className="mb-1">Quem fecha</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="radio" checked={who === "all"} onChange={() => setWho("all")} />Agenda toda (todos)</label>
            <label className="flex items-center gap-2"><input type="radio" checked={who === "some"} onChange={() => setWho("some")} />Só alguns profissionais</label>
          </div>
          {who === "some" && (
            <div className="mt-2 flex flex-wrap gap-3">
              {pros.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} />{p.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">De<Input type="date" min={today} value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} /></label>
        <label className="text-sm">Até<Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={allDay} onCheckedChange={setAllDay} />Dia inteiro</label>
      {!allDay && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Das<Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm">Às<Input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}
      <label className="block text-sm">Motivo (só você vê)<Input placeholder="Feriado, férias, almoço…" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <Button disabled={busy} onClick={add}>{busy ? "Salvando…" : "Fechar agenda"}</Button>
    </div>
  );
}

// Botão da Agenda: fecha um dia, um período ou um intervalo do dia sem sair da tela.
export function CloseAgendaDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><CalendarOff className="mr-2 h-4 w-4" />Fechar agenda</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar agenda</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Os clientes não conseguem agendar nesse período. Agendamentos que já existem continuam e precisam ser cancelados por você.</p>
          {open && <BlockForm onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ScheduleSettings() {
  const { sch, save } = useScheduleStore();
  const pros = usePros();
  const nameOf = (id: string) => pros.find((p) => p.id === id)?.name ?? "profissional";
  const [hours, setHours] = useState<DayHours[]>(sch.hours);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const setDay = (d: number, patch: Partial<DayHours>) => setHours(hours.map((h, i) => (i === d ? { ...h, ...patch } : h)));
  const saveHours = async () => {
    for (let d = 0; d < 7; d++) {
      const h = hours[d]!;
      if (h.open && !(toMin(h.from) < toMin(h.to))) { toast.error(`${WEEKDAYS[d]}: o fechamento precisa ser depois da abertura.`); return; }
    }
    setSaving(true);
    if (await save({ hours })) toast.success("Horário de funcionamento salvo");
    setSaving(false);
  };

  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const blocks = [...sch.blocks].filter((b) => b.end >= today).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarOff className="h-5 w-5" />Agenda fechada</h2>
            <p className="mt-1 text-sm text-muted-foreground">Liga para parar todos os agendamentos online agora, até você desligar. Os horários já marcados continuam.</p>
          </div>
          <Switch checked={sch.paused} onCheckedChange={(v) => save({ paused: v }).then((ok) => ok && toast.success(v ? "Agenda fechada para novos agendamentos" : "Agenda aberta"))} aria-label="Fechar agenda" />
        </div>
      </section>

      {pros.length > 1 && (
        <section className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Agenda por profissional</h2>
          <p className="mt-1 text-sm text-muted-foreground">Feche a agenda de um profissional (férias, atestado, saída) sem mexer na dos outros. Os horários já marcados continuam.</p>
          <div className="mt-4 divide-y">
            {pros.map((p) => {
              const closed = sch.pausedPros.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{closed ? "Agenda fechada" : "Agenda aberta"}</span>
                  <Switch checked={closed} onCheckedChange={(v) => save({ pausedPros: v ? [...sch.pausedPros, p.id] : sch.pausedPros.filter((x) => x !== p.id) }).then((ok) => ok && toast.success(v ? `Agenda de ${p.name} fechada` : `Agenda de ${p.name} aberta`))} aria-label={`Fechar agenda de ${p.name}`} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-card p-6 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Clock className="h-5 w-5" />Horário de funcionamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">Define os dias e horários em que seus clientes podem agendar. Horários de Brasília.</p>
        <div className="mt-4 divide-y">
          {hours.map((h, d) => (
            <div key={d} className="flex flex-wrap items-center gap-3 py-3">
              <Switch checked={h.open} onCheckedChange={(v) => setDay(d, { open: v })} aria-label={`${WEEKDAYS[d]} aberto`} />
              <span className="w-24 font-medium">{WEEKDAYS[d]}</span>
              {h.open ? (
                <>
                  <Input className="w-32" type="time" value={h.from} onChange={(e) => setDay(d, { from: e.target.value })} aria-label="Abre às" />
                  <span className="text-sm text-muted-foreground">até</span>
                  <Input className="w-32" type="time" value={h.to} onChange={(e) => setDay(d, { to: e.target.value })} aria-label="Fecha às" />
                </>
              ) : <span className="text-sm text-muted-foreground">Fechado</span>}
            </div>
          ))}
        </div>
        <Button className="mt-4" disabled={saving} onClick={saveHours}>{saving ? "Salvando…" : "Salvar horários"}</Button>
      </section>

      <section className="rounded-2xl bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold">Dias e períodos fechados</h2>
        <p className="mt-1 text-sm text-muted-foreground">Feriados, férias, folgas ou um intervalo no meio do dia (como almoço).</p>
        {blocks.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nenhum fechamento programado.</p>}
        <div className="mt-4 divide-y">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-3 text-sm">
              <span className="flex-1">
                <b>{b.start === b.end ? fmtDate(b.start) : `${fmtDate(b.start)} a ${fmtDate(b.end)}`}</b>
                {b.from && b.to ? `, das ${b.from} às ${b.to}` : ", dia inteiro"}
                <span className="text-muted-foreground"> · {b.professionalIds?.length ? b.professionalIds.map(nameOf).join(", ") : "agenda toda"}</span>
                {b.reason ? <span className="text-muted-foreground"> · {b.reason}</span> : null}
              </span>
              <Button size="icon" variant="ghost" aria-label="Remover fechamento" onClick={() => save({ blocks: sch.blocks.filter((x) => x.id !== b.id) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        {showForm ? <div className="mt-4 rounded-xl bg-muted p-4"><BlockForm onDone={() => setShowForm(false)} /></div> : <Button className="mt-4" variant="outline" onClick={() => setShowForm(true)}>Fechar um dia ou período</Button>}
      </section>
    </div>
  );
}
