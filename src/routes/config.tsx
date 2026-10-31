import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase, type Service } from "@/lib/supabaseClient";
import { brl } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BrandImages } from "@/components/BrandImages";
import { WhatsAppConnect } from "@/components/WhatsAppConnect";

export const Route = createFileRoute("/config")({
  head: () => ({ meta: [{ title: "Configurações — ConfirmaZap" }, { name: "description", content: "Serviços, regras e integrações." }, { property: "og:title", content: "Configurações — ConfirmaZap" }, { property: "og:description", content: "Serviços, regras e integrações." }] }),
  component: () => <AppShell><Config /></AppShell>,
});

type Settings = { cancel_hours?: number };

function Config() {
  const { business, reload } = useBiz();
  const [services, setServices] = useState<Service[]>([]);
  const [n, setN] = useState({ name: "", duration: "60", price: "", deposit: "30" });
  const [editId, setEditId] = useState<string | null>(null);
  const [ed, setEd] = useState({ name: "", duration: "", price: "", deposit: "" });
  const s0 = (business.settings ?? {}) as Settings;
  const [biz, setBiz] = useState({ name: business.name, whatsapp: business.whatsapp ?? "", asaas: business.asaas_api_key ?? "", cancel: String(s0.cancel_hours ?? 4) });

  const load = () => supabase.from("services").select("*").eq("business_id", business.id).order("name").then(({ data }) => setServices((data as Service[]) ?? []));
  useEffect(() => { load(); }, [business.id]);

  const add = async () => {
    const { error } = await supabase.from("services").insert({ business_id: business.id, name: n.name, duration_minutes: Number(n.duration), price: Number(n.price), deposit_value: Number(n.deposit) });
    if (error) { toast.error(error.message); return; }
    setN({ name: "", duration: "60", price: "", deposit: "30" }); load();
  };
  const upd = async (id: string, patch: Partial<Service>) => { await supabase.from("services").update(patch).eq("id", id); load(); };
  const del = async (id: string) => { const { error } = await supabase.from("services").delete().eq("id", id); if (error) toast.error("Serviço tem agendamentos; desative-o."); load(); };

  const startEdit = (s: Service) => {
    setEditId(s.id);
    setEd({ name: s.name, duration: String(s.duration_minutes), price: String(s.price), deposit: String(s.deposit_value ?? 0) });
  };
  const saveEdit = async () => {
    if (!editId) return;
    const duration = Number(ed.duration);
    const price = Number(ed.price);
    const deposit = Number(ed.deposit);
    if (!ed.name.trim()) { toast.error("Informe o nome do serviço"); return; }
    if (!Number.isInteger(duration) || duration <= 0) { toast.error("A duração precisa ser um número inteiro de minutos, maior que zero"); return; }
    if (ed.price === "" || !Number.isFinite(price) || price < 0) { toast.error("Informe um preço válido"); return; }
    if (ed.deposit === "" || !Number.isFinite(deposit) || deposit < 0) { toast.error("Informe o sinal (use 0 para não cobrar sinal)"); return; }
    const { error } = await supabase.from("services").update({ name: ed.name.trim(), duration_minutes: duration, price, deposit_value: deposit }).eq("id", editId);
    if (error) { toast.error(error.message); return; }
    toast.success("Serviço atualizado");
    setEditId(null);
    load();
  };

  const saveBiz = async () => {
    const settings = { ...s0, cancel_hours: Number(biz.cancel) };
    const { error } = await supabase.from("businesses").update({ name: biz.name, whatsapp: biz.whatsapp, asaas_api_key: biz.asaas || null, settings }).eq("id", business.id);
    if (error) toast.error(error.message); else { toast.success("Salvo"); reload(); }
  };

  const card = "rounded-2xl bg-card p-6 shadow-card";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <section className={card}>
        <h2 className="text-lg font-semibold">Serviços</h2>
        <p className="mt-1 text-sm text-muted-foreground">O sinal é o valor que o cliente paga por Pix na hora de agendar para confirmar o horário. Mudanças valem para as próximas reservas.</p>
        <div className="mt-4 divide-y">
          {services.map((s) => editId === s.id ? (
            <div key={s.id} className="grid gap-2 py-3 sm:grid-cols-5">
              <label className="text-xs text-muted-foreground sm:col-span-2">Nome<Input className="mt-1 text-foreground" value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground">Minutos<Input className="mt-1 text-foreground" type="number" value={ed.duration} onChange={(e) => setEd({ ...ed, duration: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground">Preço (R$)<Input className="mt-1 text-foreground" type="number" step="0.01" value={ed.price} onChange={(e) => setEd({ ...ed, price: e.target.value })} /></label>
              <label className="text-xs text-muted-foreground">Sinal (R$)<Input className="mt-1 text-foreground" type="number" step="0.01" value={ed.deposit} onChange={(e) => setEd({ ...ed, deposit: e.target.value })} /></label>
              <div className="flex gap-2 sm:col-span-5">
                <Button onClick={saveEdit}>Salvar</Button>
                <Button variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">{s.duration_minutes} min · {brl(s.price)} · sinal {brl(s.deposit_value)}</span>
              <Switch checked={s.active} onCheckedChange={(v) => upd(s.id, { active: v })} />
              <Button size="icon" variant="ghost" aria-label="Editar serviço" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Apagar serviço" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <Input className="sm:col-span-2" placeholder="Nome do serviço" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
          <Input type="number" placeholder="Minutos" value={n.duration} onChange={(e) => setN({ ...n, duration: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Preço (R$)" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Sinal (R$)" value={n.deposit} onChange={(e) => setN({ ...n, deposit: e.target.value })} />
        </div>
        <Button className="mt-3" disabled={!n.name || !n.price} onClick={add}>Adicionar serviço</Button>
      </section>

      <BrandImages />

      <section className={`${card} grid gap-3 sm:grid-cols-2`}>
        <h2 className="text-lg font-semibold sm:col-span-2">Negócio e regras</h2>
        <label className="text-sm">Nome<Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></label>
        <label className="text-sm">WhatsApp<Input value={biz.whatsapp} onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })} /></label>
        <label className="text-sm">Cancelamento grátis até (horas antes)<Input type="number" value={biz.cancel} onChange={(e) => setBiz({ ...biz, cancel: e.target.value })} /></label>
        <label className="text-sm">Chave de API do Asaas<Input type="password" value={biz.asaas} onChange={(e) => setBiz({ ...biz, asaas: e.target.value })} /></label>
      </section>

      <WhatsAppConnect />

      <Button size="lg" onClick={saveBiz}>Salvar configurações</Button>
    </div>
  );
}
