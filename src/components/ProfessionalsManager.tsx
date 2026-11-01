import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { addProfessional, setProfessionalActive } from "@/lib/professionals.functions";
import { getPlanInfo } from "@/lib/plans.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Pro = { id: string; name: string; active: boolean };

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sessão expirada. Entre de novo.");
  return data.session.access_token;
}

export function ProfessionalsManager() {
  const { business } = useBiz();
  const [rows, setRows] = useState<Pro[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [max, setMax] = useState<number | null>(null);
  const [planName, setPlanName] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("professionals").select("id,name,active").eq("business_id", business.id).order("created_at");
    if (error) { setMissing(true); setRows([]); return; }
    setMissing(false);
    setRows((data as Pro[]) ?? []);
    try {
      const info = await getPlanInfo({ data: { accessToken: await token() } });
      setMax(info.limits.maxProfessionals);
      setPlanName(info.limits.name);
    } catch { /* o limite é conferido de novo no servidor */ }
  }, [business.id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const add = () => run(async () => {
    await addProfessional({ data: { accessToken: await token(), name } });
    setName("");
    toast.success("Profissional adicionado");
  });
  const toggle = (p: Pro, active: boolean) => run(async () => { await setProfessionalActive({ data: { accessToken: await token(), id: p.id, active } }); });
  const rename = async (p: Pro, value: string) => {
    const v = value.trim();
    if (v === p.name) return;
    if (v.length < 2) { toast.error("Informe o nome do profissional"); load(); return; }
    const { error } = await supabase.from("professionals").update({ name: v }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Nome atualizado"); load(); }
  };

  const active = (rows ?? []).filter((r) => r.active).length;

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><UserRound className="h-5 w-5" />Profissionais</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cada profissional tem a própria agenda. Com mais de um, o cliente escolhe com quem agendar (ou fica sem preferência) e a agenda ganha um filtro por profissional.</p>
      {missing ? (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm">O cadastro de profissionais ainda não foi ativado no Supabase. Rode o SQL dos profissionais e recarregue esta página.</p>
      ) : rows === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="mt-4 divide-y">
            {rows.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <Input className="max-w-xs" defaultValue={p.name} aria-label="Nome do profissional" onBlur={(e) => rename(p, e.target.value)} />
                <span className="text-xs text-muted-foreground">{p.active ? "Ativo" : "Inativo"}</span>
                <Switch checked={p.active} disabled={busy} onCheckedChange={(v) => toggle(p, v)} aria-label="Profissional ativo" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Nome do novo profissional" value={name} onChange={(e) => setName(e.target.value)} />
            <Button disabled={busy || name.trim().length < 2} onClick={add}>Adicionar</Button>
          </div>
          {max !== null && <p className="mt-3 text-xs text-muted-foreground">{active} de {max} {max === 1 ? "profissional ativo" : "profissionais ativos"} no plano {planName}.</p>}
        </>
      )}
    </section>
  );
}
