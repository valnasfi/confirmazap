import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase, type Service } from "@/lib/supabaseClient";
import { brl, maskWhatsapp } from "@/lib/booking";
import { isValidDocument, isValidEmail, isValidPhone, maskDocument, onlyDigits } from "@/lib/document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BrandImages } from "@/components/BrandImages";
import { WhatsAppConnect } from "@/components/WhatsAppConnect";
import { BirthdaySettings } from "@/components/BirthdaySettings";
import { RemindersSettings } from "@/components/RemindersSettings";
import { ReactivationSettings } from "@/components/ReactivationSettings";
import { PlanBilling } from "@/components/PlanBilling";
import { addService } from "@/lib/services.functions";
import { ProfessionalsManager } from "@/components/ProfessionalsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [biz, setBiz] = useState({ name: business.name, whatsapp: business.whatsapp ?? "", cancel: String(s0.cancel_hours ?? 4), email: business.email ?? "", phone: maskWhatsapp(business.phone ?? ""), doc: maskDocument(business.document ?? "") });

  const [pros, setPros] = useState<Array<{ id: string; name: string }>>([]);
  const [links, setLinks] = useState<Record<string, string[]>>({});
  const [edPros, setEdPros] = useState<string[]>([]);
  const loadPros = async () => {
    const { data, error } = await supabase.from("professionals").select("id,name").eq("business_id", business.id).eq("active", true).order("created_at");
    if (error) return;
    setPros((data as Array<{ id: string; name: string }>) ?? []);
    const { data: ln, error: lErr } = await supabase.from("professional_services").select("professional_id,service_id");
    if (lErr) return;
    const m: Record<string, string[]> = {};
    for (const r of (ln ?? []) as Array<{ professional_id: string; service_id: string }>) (m[r.service_id] ??= []).push(r.professional_id);
    setLinks(m);
  };
  useEffect(() => { loadPros(); }, [business.id]);
  const prosLabel = (id: string) => {
    const ids = links[id];
    if (!ids || !ids.length) return "Todos os profissionais";
    return pros.filter((p) => ids.includes(p.id)).map((p) => p.name).join(", ") || "Todos os profissionais";
  };

  const load = () => supabase.from("services").select("*").eq("business_id", business.id).order("name").then(({ data }) => setServices((data as Service[]) ?? []));
  useEffect(() => { load(); }, [business.id]);

  const add = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("Sessão expirada. Entre de novo.");
      await addService({ data: { accessToken: sess.session.access_token, name: n.name, duration: Number(n.duration), price: Number(n.price), deposit: Number(n.deposit) } });
    } catch (e) { toast.error((e as Error).message); return; }
    setN({ name: "", duration: "60", price: "", deposit: "30" }); load();
  };
  const upd = async (id: string, patch: Partial<Service>) => { await supabase.from("services").update(patch).eq("id", id); load(); };
  const del = async (id: string) => { const { error } = await supabase.from("services").delete().eq("id", id); if (error) toast.error("Serviço tem agendamentos; desative-o."); load(); };

  const startEdit = (s: Service) => {
    setEditId(s.id);
    setEd({ name: s.name, duration: String(s.duration_minutes), price: String(s.price), deposit: String(s.deposit_value ?? 0) });
    const cur = links[s.id];
    setEdPros(cur && cur.length ? cur : pros.map((p) => p.id));
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
    if (pros.length > 0) {
      // Todos marcados = sem vínculo (vale para todos, inclusive quem for adicionado depois).
      const chosen = edPros.filter((id) => pros.some((p) => p.id === id));
      if (chosen.length === 0) { toast.error("Marque pelo menos um profissional que faz este serviço"); return; }
      const all = chosen.length === pros.length;
      const { error: dErr } = await supabase.from("professional_services").delete().eq("service_id", editId);
      if (dErr) { toast.error(/relation|schema cache|does not exist/i.test(dErr.message) ? "Rode o SQL de serviço por profissional no Supabase." : dErr.message); return; }
      if (!all) {
        const { error: iErr } = await supabase.from("professional_services").insert(chosen.map((pid) => ({ professional_id: pid, service_id: editId })));
        if (iErr) { toast.error(iErr.message); return; }
      }
    }
    toast.success("Serviço atualizado");
    setEditId(null);
    load();
    loadPros();
  };

  const saveBiz = async () => {
    if (!biz.name.trim()) { toast.error("Informe o nome do estabelecimento"); return; }
    if (!isValidEmail(biz.email)) { toast.error("Informe um e-mail válido"); return; }
    if (!isValidPhone(biz.phone)) { toast.error("Informe o telefone com DDD"); return; }
    if (!isValidDocument(biz.doc)) { toast.error("CPF ou CNPJ inválido. Confira os números."); return; }
    const settings = { ...s0, cancel_hours: Number(biz.cancel) };
    const { error } = await supabase.from("businesses").update({ name: biz.name.trim(), email: biz.email.trim(), phone: onlyDigits(biz.phone), document: onlyDigits(biz.doc), whatsapp: biz.whatsapp, settings }).eq("id", business.id);
    if (error) toast.error(error.message); else { toast.success("Salvo"); reload(); }
  };

  const card = "rounded-2xl bg-card p-6 shadow-card";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <Tabs defaultValue="negocio">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="negocio">Negócio e regras</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
          <TabsTrigger value="identidade">Identidade visual</TabsTrigger>
          <TabsTrigger value="plano">Plano (financeiro)</TabsTrigger>
        </TabsList>

        <TabsContent value="negocio" className="mt-6 space-y-6">
      <section className={`${card} grid gap-3 sm:grid-cols-2`}>
        <h2 className="text-lg font-semibold sm:col-span-2">Negócio e regras</h2>
        <label className="text-sm">Nome<Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></label>
        <label className="text-sm">E-mail<Input type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} /></label>
        <label className="text-sm">Telefone<Input inputMode="tel" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: maskWhatsapp(e.target.value) })} /></label>
        <label className="text-sm">CPF ou CNPJ<Input inputMode="numeric" value={biz.doc} onChange={(e) => setBiz({ ...biz, doc: maskDocument(e.target.value) })} /></label>
        <label className="text-sm">WhatsApp<Input value={biz.whatsapp} onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })} /></label>
        <label className="text-sm">Cancelamento grátis até (horas antes)<Input type="number" value={biz.cancel} onChange={(e) => setBiz({ ...biz, cancel: e.target.value })} /></label>
      </section>

          <WhatsAppConnect />

          <RemindersSettings />

          <BirthdaySettings />

          <ReactivationSettings />

          <Button size="lg" onClick={saveBiz}>Salvar configurações</Button>
        </TabsContent>

        <TabsContent value="servicos" className="mt-6 space-y-6">
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
              {pros.length > 1 && (
                <div className="sm:col-span-5">
                  <p className="text-xs text-muted-foreground">Quem faz este serviço</p>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {pros.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={edPros.includes(p.id)} onChange={(e) => setEdPros(e.target.checked ? [...edPros, p.id] : edPros.filter((x) => x !== p.id))} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 sm:col-span-5">
                <Button onClick={saveEdit}>Salvar</Button>
                <Button variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">{s.duration_minutes} min · {brl(s.price)} · sinal {brl(s.deposit_value)}</span>
              {pros.length > 1 && <span className="w-full text-xs text-muted-foreground sm:w-auto">👤 {prosLabel(s.id)}</span>}
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
        </TabsContent>

        <TabsContent value="profissionais" className="mt-6">
          <ProfessionalsManager />
        </TabsContent>

        <TabsContent value="identidade" className="mt-6">
          <BrandImages />
        </TabsContent>

        <TabsContent value="plano" className="mt-6">
          <PlanBilling />
        </TabsContent>
      </Tabs>
    </div>
  );
}
