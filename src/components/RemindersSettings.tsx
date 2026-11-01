import { useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { usePlan } from "@/lib/usePlan";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

type Cfg = { enabled?: boolean; h24?: boolean; h2?: boolean };

export function RemindersSettings() {
  const { business, reload } = useBiz();
  const settings = (business.settings ?? {}) as Record<string, unknown>;
  const cfg = (settings["reminders"] ?? {}) as Cfg;
  // Ligado por padrão: o profissional só precisa conectar o WhatsApp.
  const [enabled, setEnabled] = useState(cfg.enabled !== false);
  const [h24, setH24] = useState(cfg.h24 !== false);
  const [h2, setH2] = useState(cfg.h2 !== false);
  const [saving, setSaving] = useState(false);
  const { info: plan } = usePlan();
  const no2h = Boolean(plan) && !plan!.limits.reminder2h;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ settings: { ...settings, reminders: { enabled, h24, h2 } } }).eq("id", business.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lembretes salvos");
    reload();
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><BellRing className="h-5 w-5" />Lembretes e confirmação</h2>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar lembretes" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">O cliente recebe o lembrete pelo seu WhatsApp e responde <b>1</b> para confirmar ou <b>2</b> para cancelar. A mensagem também leva um link para remarcar. Envios entre 7h e 21h, e só com o WhatsApp conectado.</p>
      <div className={`mt-4 space-y-3 text-sm ${enabled ? "" : "pointer-events-none opacity-50"}`}>
        <label className="flex items-center gap-3"><Checkbox checked={h24} onCheckedChange={(v) => setH24(v === true)} />Lembrete 24 horas antes</label>
        <label className="flex items-center gap-3"><Checkbox disabled={no2h} checked={h2 && !no2h} onCheckedChange={(v) => setH2(v === true)} />Lembrete 2 horas antes{no2h && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">Pro</span>}</label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Cancelamentos feitos pelo cliente seguem a regra "Cancelamento grátis até (horas antes)" acima: dentro do prazo o sinal é devolvido; fora dele, o sinal fica com você.</p>
      <Button className="mt-4" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>
    </section>
  );
}
