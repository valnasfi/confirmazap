import { useState } from "react";
import { toast } from "sonner";
import { HeartHandshake } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_REACTIVATION_MESSAGE, renderReactivation, type ReactivationSettings as Cfg } from "@/lib/birthday";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function ReactivationSettings() {
  const { business, reload } = useBiz();
  const settings = (business.settings ?? {}) as Record<string, unknown>;
  const cfg = (settings["reactivation"] ?? {}) as Cfg;
  const [enabled, setEnabled] = useState(Boolean(cfg.enabled));
  const [days, setDays] = useState(String(cfg.days ?? 60));
  const [message, setMessage] = useState(cfg.message || DEFAULT_REACTIVATION_MESSAGE);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 15 || n > 365) { toast.error("Use entre 15 e 365 dias"); return; }
    if (enabled && !message.trim()) { toast.error("Escreva a mensagem"); return; }
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ settings: { ...settings, reactivation: { enabled, days: n, message: message.trim() } } }).eq("id", business.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(enabled ? "Reativação ativada" : "Reativação desativada");
    reload();
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><HeartHandshake className="h-5 w-5" />Reativar clientes sumidos</h2>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar reativação de clientes" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Quem foi atendido, está há muito tempo sem voltar e não tem horário marcado recebe um convite para agendar. No máximo uma mensagem a cada 90 dias, entre 10h e 19h. Quem responder <b>SAIR</b> deixa de receber mensagens promocionais.</p>
      <label className="mt-4 block text-sm">Considerar sumido depois de (dias sem vir)
        <Input className="mt-1 max-w-32" type="number" min={15} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
      </label>
      <label className="mt-4 block text-sm">Mensagem
        <Textarea className="mt-1" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Use {"{nome}"}, {"{negocio}"} e {"{link}"} (página de agendamento). A frase sobre SAIR é adicionada sozinha.</p>
      <p className="mt-3 whitespace-pre-line rounded-xl bg-muted p-3 text-sm"><b>Como o cliente vai ler:</b> {renderReactivation(message || DEFAULT_REACTIVATION_MESSAGE, "joão silva", business.name, `/agendar/${business.slug}`)}</p>
      <Button className="mt-4" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>
    </section>
  );
}
