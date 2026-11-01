import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { maskWhatsapp } from "@/lib/booking";
import { isValidEmail, isValidPhone, onlyDigits } from "@/lib/document";
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
  birth_date: string | null; address: string | null; notes: string | null; consent_at: string | null;
};
type Form = { name: string; whatsapp: string; cpf: string; email: string; birth_date: string; address: string; notes: string };
const EMPTY: Form = { name: "", whatsapp: "", cpf: "", email: "", birth_date: "", address: "", notes: "" };

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

const FIELDS = "id,name,whatsapp,cpf,email,birth_date,address,notes,consent_at";

function Clientes() {
  const { business } = useBiz();
  const [rows, setRows] = useState<C[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    let { data, error } = await supabase.from("customers").select(FIELDS).eq("business_id", business.id).order("name");
    // Antes do SQL do cadastro as colunas novas não existem: cai na lista básica em vez de quebrar a tela.
    if (error) ({ data } = await supabase.from("customers").select("id,name,whatsapp,cpf,consent_at").eq("business_id", business.id).order("name"));
    setRows((data as C[]) ?? []);
  }, [business.id]);
  useEffect(() => { load(); }, [load]);

  const open = (c: C | null) => {
    setEditing(c ? c.id : "new");
    setF(c ? { name: c.name ?? "", whatsapp: maskWhatsapp(c.whatsapp), cpf: maskCpf(c.cpf ?? ""), email: c.email ?? "", birth_date: c.birth_date ?? "", address: c.address ?? "", notes: c.notes ?? "" } : EMPTY);
  };

  const save = async () => {
    if (f.name.trim().length < 2) { toast.error("Informe o nome do cliente"); return; }
    if (!isValidPhone(f.whatsapp)) { toast.error("Informe o WhatsApp com DDD"); return; }
    if (f.cpf && !cpfOk(f.cpf)) { toast.error("CPF inválido. Confira os números."); return; }
    if (f.email && !isValidEmail(f.email)) { toast.error("E-mail inválido"); return; }
    const payload = {
      name: f.name.trim(), whatsapp: onlyDigits(f.whatsapp), cpf: onlyDigits(f.cpf) || null,
      email: f.email.trim() || null, birth_date: f.birth_date || null, address: f.address.trim() || null, notes: f.notes.trim() || null,
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

  const term = q.trim().toLowerCase();
  const digits = onlyDigits(q);
  const shown = rows.filter((r) => !term || (r.name ?? "").toLowerCase().includes(term) || (digits && (r.whatsapp.includes(digits) || (r.cpf ?? "").includes(digits))) || (r.email ?? "").toLowerCase().includes(term));
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <Button onClick={() => open(null)}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
      </div>
      <Input className="mt-4 max-w-sm" placeholder="Buscar por nome, WhatsApp, CPF ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-4">Nome</th><th>WhatsApp</th><th>E-mail</th><th>CPF</th><th /></tr></thead>
          <tbody className="divide-y">
            {shown.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>{rows.length === 0 ? "Nenhum cliente ainda." : "Nenhum cliente encontrado."}</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="p-4 font-medium">{r.name || "—"}</td>
                <td>{maskWhatsapp(r.whatsapp)}</td>
                <td>{r.email || "—"}</td>
                <td>{r.cpf ? maskCpf(r.cpf) : "—"}</td>
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
            <label className="text-sm">Data de nascimento<Input type="date" value={f.birth_date} onChange={set("birth_date")} /></label>
            <label className="text-sm sm:col-span-2">Endereço<Input value={f.address} onChange={set("address")} /></label>
            <label className="text-sm sm:col-span-2">Observações<Textarea rows={3} value={f.notes} onChange={set("notes")} placeholder="Preferências, alergias, histórico…" /></label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
