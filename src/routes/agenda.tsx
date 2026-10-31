import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, useBiz, statusMeta } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { chargeNoShow } from "@/lib/asaas.functions";
import { activeHoldFilter } from "@/lib/booking";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const AgendaCalendar = lazy(() => import("@/components/AgendaCalendar"));

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — ConfirmaZap" }, { name: "description", content: "Agenda do dia e da semana." }, { property: "og:title", content: "Agenda — ConfirmaZap" }, { property: "og:description", content: "Agenda do dia e da semana." }] }),
  component: () => <AppShell><Agenda /></AppShell>,
});

type Appt = { id: string; start_at: string; end_at: string; status: string; customers: { name: string; whatsapp: string } | null; services: { name: string; deposit_value: number } | null };

function Agenda() {
  const { business, session } = useBiz();
  const [items, setItems] = useState<Appt[]>([]);
  const [sel, setSel] = useState<Appt | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("appointments").select("id,start_at,end_at,status,customers(name,whatsapp),services(name,deposit_value)").eq("business_id", business.id).or(activeHoldFilter());
    setItems((data as unknown as Appt[]) ?? []);
  };
  useEffect(() => { load(); }, [business.id]);

  const setStatus = async (status: string) => {
    if (!sel) return;
    const { error } = await supabase.from("appointments").update({ status }).eq("id", sel.id);
    if (error) toast.error(error.message); else { toast.success("Atualizado"); setSel(null); load(); }
  };
  const noShow = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await chargeNoShow({ data: { appointmentId: sel.id, accessToken: session.access_token } });
      r.ok ? toast.success(r.message) : toast.warning(r.message);
      setSel(null); load();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const events = items.map((a) => ({
    id: a.id, start: a.start_at, end: a.end_at,
    title: `${a.customers?.name ?? ""} · ${a.services?.name ?? ""}`,
    backgroundColor: statusMeta[a.status]?.color, borderColor: statusMeta[a.status]?.color,
  }));
  const wa = sel?.customers?.whatsapp ? `https://wa.me/55${sel.customers.whatsapp}?text=${encodeURIComponent(`Olá ${sel.customers.name}! Lembrete do seu horário em ${business.name}: ${new Date(sel.start_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`)}` : "#";

  return (
    <div>
      <h1 className="text-3xl font-bold">Agenda</h1>
      <div className="mt-6 rounded-2xl bg-card p-4 shadow-card">
        <ClientOnly fallback={<p className="p-6 text-muted-foreground">Carregando agenda…</p>}>
          <Suspense fallback={<p className="p-6 text-muted-foreground">Carregando agenda…</p>}>
            <AgendaCalendar events={events} onClick={(id) => setSel(items.find((i) => i.id === id) ?? null)} />
          </Suspense>
        </ClientOnly>
      </div>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sel?.customers?.name}</DialogTitle></DialogHeader>
          {sel && <div className="space-y-1 text-sm">
            <p>{sel.services?.name}</p>
            <p>{new Date(sel.start_at).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}</p>
            <p>Status: <b>{statusMeta[sel.status]?.label}</b></p>
          </div>}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setStatus("showed")}>Compareceu</Button>
            <Button variant="destructive" disabled={busy} onClick={noShow}>Marcar falta</Button>
            <Button variant="secondary" onClick={() => setStatus("canceled")}>Cancelar</Button>
            <a href={wa} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full">WhatsApp</Button></a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
