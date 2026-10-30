import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase, type Service } from "@/lib/supabaseClient";
import { brl } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/config")({
  head: () => ({ meta: [{ title: "Configurações — ConfirmaZap" }, { name: "description", content: "Serviços, regras e integrações." }, { property: "og:title", content: "Configurações — ConfirmaZap" }, { property: "og:description", content: "Serviços, regras e integrações." }] }),
  component: () => <AppShell><Config /></AppShell>,
});

type Settings = { cancel_hours?: number; evolution_url?: string; evolution_key?: string; evolution_instance?: string };

function Config() {
  const { business, reload } = useBiz();
  const [services, setServices] = useState<Service[]>([]);
  const [n, setN] = useState({ name: "", duration: "60", price: "", deposit: "30" });
  const s0 = (business.settings ?? {}) as Settings;
  const [biz, setBiz] = useState({ name: business.name, whatsapp: business.whatsapp ?? "", asaas: business.asaas_api_key ?? "", cancel: String(s0.cancel_hours ?? 4), evoUrl: s0.evolution_url ?? "", evoKey: s0.evolution_key ?? "", evoInst: s0.evolution_instance ?? "" });
  const [qr, setQr] = useState<string | null>(null);

  const load = () => supabase.from("services").select("*").eq("business_id", business.id).order("name").then(({ data }) => setServices((data as Service[]) ?? []));
  useEffect(() => { load(); }, [business.id]);

  const add = async () => {
    const { error } = await supabase.from("services").insert({ business_id: business.id, name: n.name, duration_minutes: Number(n.duration), price: Number(n.price), deposit_value: Number(n.deposit) });
    if (error) return toast.error(error.message);
    setN({ name: "", duration: "60", price: "", deposit: "30" }); load();
  };
  const upd = async (id: string, patch: Partial<Service>) => { await supabase.from("services").update(patch).eq("id", id); load(); };
  const del = async (id: string) => { const { error } = await supabase.from("services").delete().eq("id", id); if (error) toast.error("Serviço tem agendamentos; desative-o."); load(); };

  const saveBiz = async () => {
    const settings = { ...s0, cancel_hours: Number(biz.cancel), evolution_url: biz.evoUrl, evolution_key: biz.evoKey, evolution_instance: biz.evoInst };
    const { error } = await supabase.from("businesses").update({ name: biz.name, whatsapp: biz.whatsapp, asaas_api_key: biz.asaas || null, settings }).eq("id", business.id);
    if (error) toast.error(error.message); else { toast.success("Salvo"); reload(); }
  };

  const connectWa = async () => {
    if (!biz.evoUrl || !biz.evoKey || !biz.evoInst) return toast.error("Preencha URL, chave e instância da Evolution API");
    try {
      const r = await fetch(`${biz.evoUrl.replace(/\/$/, "")}/instance/connect/${biz.evoInst}`, { headers: { apikey: biz.evoKey } });
      const j = await r.json();
      const code = j.base64 ?? j.qrcode?.base64;
      if (code) setQr(code.startsWith("data:") ? code : `data:image/png;base64,${code}`);
      else toast.message(j.instance?.state === "open" ? "WhatsApp já conectado" : "Sem QR Code retornado");
    } catch { toast.error("Não foi possível falar com a Evolution API"); }
  };

  const card = "rounded-2xl bg-card p-6 shadow-card";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <section className={card}>
        <h2 className="text-lg font-semibold">Serviços</h2>
        <div className="mt-4 divide-y">
          {services.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">{s.duration_minutes} min · {brl(s.price)} · taxa {brl(s.deposit_value)}</span>
              <Switch checked={s.active} onCheckedChange={(v) => upd(s.id, { active: v })} />
              <Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <Input className="sm:col-span-2" placeholder="Nome do serviço" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
          <Input type="number" placeholder="Minutos" value={n.duration} onChange={(e) => setN({ ...n, duration: e.target.value })} />
          <Input type="number" placeholder="Preço" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
          <Input type="number" placeholder="Taxa falta" value={n.deposit} onChange={(e) => setN({ ...n, deposit: e.target.value })} />
        </div>
        <Button className="mt-3" disabled={!n.name || !n.price} onClick={add}>Adicionar serviço</Button>
      </section>

      <section className={`${card} grid gap-3 sm:grid-cols-2`}>
        <h2 className="text-lg font-semibold sm:col-span-2">Negócio e regras</h2>
        <label className="text-sm">Nome<Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></label>
        <label className="text-sm">WhatsApp<Input value={biz.whatsapp} onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })} /></label>
        <label className="text-sm">Cancelamento grátis até (horas antes)<Input type="number" value={biz.cancel} onChange={(e) => setBiz({ ...biz, cancel: e.target.value })} /></label>
        <label className="text-sm">Chave de API do Asaas<Input type="password" value={biz.asaas} onChange={(e) => setBiz({ ...biz, asaas: e.target.value })} /></label>
      </section>

      <section className={`${card} grid gap-3 sm:grid-cols-3`}>
        <h2 className="text-lg font-semibold sm:col-span-3">WhatsApp (Evolution API)</h2>
        <Input placeholder="URL da Evolution API" value={biz.evoUrl} onChange={(e) => setBiz({ ...biz, evoUrl: e.target.value })} />
        <Input placeholder="API key" type="password" value={biz.evoKey} onChange={(e) => setBiz({ ...biz, evoKey: e.target.value })} />
        <Input placeholder="Instância" value={biz.evoInst} onChange={(e) => setBiz({ ...biz, evoInst: e.target.value })} />
        <div className="sm:col-span-3"><Button variant="secondary" onClick={connectWa}>Mostrar QR Code</Button></div>
        {qr && <img src={qr} alt="QR Code WhatsApp" className="h-56 w-56" />}
      </section>

      <Button size="lg" onClick={saveBiz}>Salvar configurações</Button>
    </div>
  );
}
