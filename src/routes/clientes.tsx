import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { maskWhatsapp } from "@/lib/booking";
import { isValidEmail, isValidPhone, onlyDigits } from "@/lib/document";
import { usePlan } from "@/lib/usePlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — ConfirmaZap" }, { name: "description", content: "Cadastro e histórico dos seus clientes." }, { property: "og:title", content: "Clientes — ConfirmaZap" }, { property: "og:description", content: "Cadastro e histórico dos seus clientes." }] }),
  component: () => <AppShell><Clientes /></AppShell>,
});

type C = {
  id: string; name: string | null; whatsapp: string; cpf: string | null; email: string | null;
  sex: string | null; birth_date: string | null; address: string | null; notes: string | null; consent_at: string | null;
  extra?: Record<string, string> | null;
};
// Campos extras criados pelo profissional (ficam em businesses.settings.customer_fields; os valores em customers.extra).
type Field = { id: string; label: string; type: "text" | "number" | "date" };
const TYPE_LABEL: Record<Field["type"], string> = { text: "Texto", number: "Número", date: "Data" };
type Form = { name: string; whatsapp: string; cpf: string; email: string; sex: string; birth_date: string; address: string; notes: string };
const EMPTY: Form = { name: "", whatsapp: "", cpf: "", email: "", sex: "", birth_date: "", address: "", notes: "" };

// CPF só de pessoa física: 11 dígitos com dígitos verificadores corretos.
function cpfOk(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}
const maskCpf = (v: string) => onlyDigits(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const BASIC = "id,name,whatsapp,cpf,consent_at";
// Data "AAAA-MM-DD" do banco → dd/mm/aaaa, sem passar por fuso horário.
const fmtBirth = (d: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};
const FIELDS = "id,name,whatsapp,cpf,email,birth_date,address,notes,consent_at";
const SEX_OPTIONS = ["Feminino", "Masculino", "Outro", "Prefere não informar"];

function Clientes() {
  const { business, reload } = useBiz();
  const { info: plan } = usePlan();
  const customOk = !plan || plan.limits.customFields; // sem informação, não trava
  const fields: Field[] = ((business.settings ?? {}) as { customer_fields?: Field[] }).customer_fields ?? [];
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState<Field[]>([]);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<C[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    // Antes do SQL as colunas novas não existem: tenta da mais completa para a básica em vez de quebrar a tela.
    let data: unknown[] | null = null;
    for (const cols of [`${FIELDS},sex,extra`, FIELDS, BASIC]) {
      const r = await supabase.from("customers").select(cols).eq("business_id", business.id).order("name");
      if (!r.error) { data = r.data as unknown[]; break; }
    }
    setRows((data as C[]) ?? []);
  }, [business.id]);
  useEffect(() => { load(); }, [load]);

  const open = (c: C | null) => {
    setEditing(c ? c.id : "new");
    setExtra({ ...(c?.extra ?? {}) });
    setF(c ? { name: c.name ?? "", whatsapp: maskWhatsapp(c.whatsapp), cpf: maskCpf(c.cpf ?? ""), email: c.email ?? "", sex: c.sex ?? "", birth_date: c.birth_date ?? "", address: c.address ?? "", notes: c.notes ?? "" } : EMPTY);
  };

  const save = async () => {
    if (f.name.trim().length < 2) { toast.error("Informe o nome do cliente"); return; }
    if (!isValidPhone(f.whatsapp)) { toast.error("Informe o WhatsApp com DDD"); return; }
    if (f.cpf && !cpfOk(f.cpf)) { toast.error("CPF inválido. Confira os números."); return; }
    if (f.email && !isValidEmail(f.email)) { toast.error("E-mail inválido"); return; }
    const payload = {
      name: f.name.trim(), whatsapp: onlyDigits(f.whatsapp), cpf: onlyDigits(f.cpf) || null,
      email: f.email.trim() || null, sex: f.sex || null, birth_date: f.birth_date || null, address: f.address.trim() || null, notes: f.notes.trim() || null,
      // Só envia os extras se existem campos criados (mantém valores de campos já apagados, sem exibi-los).
      ...(fields.length > 0 ? { extra: { ...(rows.find((r) => r.id === editing)?.extra ?? {}), ...Object.fromEntries(fields.map((x) => [x.id, (extra[x.id] ?? "").trim()])) } } : {}),
    };
    setSaving(true);
    const { error } = editing === "new"
      ? await supabase.from("customers").insert({ ...payload, business_id: business.id })
      : await supabase.from("customers").update(payload).eq("id", editing!);
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        const cpfClash = /cpf/i.test(error.message);
        toast.error(cpfClash ? "Já existe um cliente com este CPF." : "Já existe um cliente com este WhatsApp.");
      } else toast.error(/column|schema cache/i.test(error.message) ? "O cadastro ainda não foi atualizado no Supabase. Rode o SQL de clientes e tente de novo." : error.message);
      return;
    }
    toast.success(editing === "new" ? "Cliente cadastrado" : "Cliente atualizado");
    setEditing(null);
    load();
  };

  const openManage = () => { setDraft(fields.map((x) => ({ ...x }))); setManage(true); };
  const saveFields = async () => {
    const labels = draft.map((x) => x.label.trim().toLowerCase());
    if (labels.some((l) => !l)) { toast.error("Dê um nome a todos os campos"); return; }
    if (new Set(labels).size !== labels.length) { toast.error("Há dois campos com o mesmo nome"); return; }
    const settings = { ...((business.settings ?? {}) as Record<string, unknown>), customer_fields: draft.map((x) => ({ ...x, label: x.label.trim() })) };
    const { error } = await supabase.from("businesses").update({ settings }).eq("id", business.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Campos salvos");
    setManage(false);
    reload();
  };

  const term = q.trim().toLowerCase();
  const digits = onlyDigits(q);
  const shown = rows.filter((r) => !term || (r.name ?? "").toLowerCase().includes(term) || (digits && r.whatsapp.includes(digits)) || (r.email ?? "").toLowerCase().includes(term));
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!customOk} title={customOk ? undefined : "Disponível no plano Pro"} onClick={openManage}><SlidersHorizontal className="mr-2 h-4 w-4" />Campos personalizados{!customOk && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">Pro</span>}</Button>
          <Button onClick={() => open(null)}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
        </div>
      </div>
      <Input className="mt-4 max-w-sm" placeholder="Buscar por nome, WhatsApp ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-4">Nome</th><th>WhatsApp</th><th>E-mail</th><th>Nascimento</th><th /></tr></thead>
          <tbody className="divide-y">
            {shown.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>{rows.length === 0 ? "Nenhum cliente ainda." : "Nenhum cliente encontrado."}</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="p-4 font-medium">{r.name || "—"}</td>
                <td>{maskWhatsapp(r.whatsapp)}</td>
                <td>{r.email || "—"}</td>
                <td>{fmtBirth(r.birth_date)}</td>
                <td className="pr-3 text-right"><Button size="icon" variant="ghost" aria-label="Editar cliente" onClick={() => open(r)}><Pencil className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "Novo cliente" : "Editar cliente"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">Nome<Input value={f.name} onChange={set("name")} /></label>
            <label className="text-sm">WhatsApp<Input inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: maskWhatsapp(e.target.value) })} /></label>
            <label className="text-sm">CPF<Input inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: maskCpf(e.target.value) })} /></label>
            <label className="text-sm">E-mail<Input type="email" value={f.email} onChange={set("email")} /></label>
            <label className="text-sm">Sexo
              <select className="mt-0 flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}>
                <option value="">Não informado</option>
                {SEX_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="text-sm">Data de nascimento<Input type="date" value={f.birth_date} onChange={set("birth_date")} /></label>
            <label className="text-sm sm:col-span-2">Endereço<Input value={f.address} onChange={set("address")} /></label>
            <label className="text-sm sm:col-span-2">Observações<Textarea rows={3} value={f.notes} onChange={set("notes")} placeholder="Preferências, alergias, histórico…" /></label>
            {fields.map((x) => (
              <label key={x.id} className="text-sm">{x.label}
                <Input type={x.type === "number" ? "number" : x.type === "date" ? "date" : "text"} value={extra[x.id] ?? ""} onChange={(e) => setExtra({ ...extra, [x.id]: e.target.value })} />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manage} onOpenChange={setManage}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Campos personalizados</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Crie os campos que fazem sentido para o seu negócio. Eles aparecem no cadastro de todos os clientes.</p>
          <div className="space-y-2">
            {draft.length === 0 && <p className="text-sm text-muted-foreground">Nenhum campo criado ainda.</p>}
            {draft.map((x, i) => (
              <div key={x.id} className="flex gap-2">
                <Input placeholder="Nome do campo (ex.: Alergias)" value={x.label} onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, label: e.target.value } : d)))} />
                <select className="rounded-md border bg-background px-2 text-sm" aria-label="Tipo do campo" value={x.type} onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, type: e.target.value as Field["type"] } : d)))}>
                  {(Object.keys(TYPE_LABEL) as Field["type"][]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
                <Button size="icon" variant="ghost" aria-label="Remover campo" onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setDraft([...draft, { id: `c_${Math.random().toString(36).slice(2, 8)}`, label: "", type: "text" }])}><Plus className="mr-2 h-4 w-4" />Adicionar campo</Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManage(false)}>Cancelar</Button>
            <Button onClick={saveFields}>Salvar campos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
