import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_NOSHOW_MESSAGE, renderBirthday, type NoShowSettings as Cfg } from "@/lib/birthday";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function NoShowSettings() {
  const { business, reload } = useBiz();
  const settings = (business.settings ?? {}) as Record<string, unknown>;
  const cfg = (settings["noshow"] ?? {}) as Cfg;
  const [enabled, setEnabled] = useState(cfg.enabled !== false);
  const [message, setMessage] = useState(cfg.message || DEFAULT_NOSHOW_MESSAGE);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (enabled && !message.trim()) { toast.error("Escreva a mensagem"); return; }
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ settings: { ...settings, noshow: { enabled, message: message.trim() } } }).eq("id", business.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    reload();
  };

  const link = `/agendar/${business.slug}`;
  const preview = renderBirthday(message || DEFAULT_NOSHOW_MESSAGE, "joão silva", business.name).replace(/\{link\}/gi, link);

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5" />Mensagem após falta</h2>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enviar mensagem após falta" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Quando você marca <b>Falta</b> na agenda, o cliente recebe pelo WhatsApp um convite para remarcar. Precisa do WhatsApp conectado.</p>
      <label className="mt-4 block text-sm">Mensagem
        <Textarea className="mt-1" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Use {"{nome}"}, {"{negocio}"} e {"{link}"} (página de agendamento).</p>
      <p className="mt-3 whitespace-pre-line rounded-xl bg-muted p-3 text-sm"><b>Como o cliente vai ler:</b> {preview}</p>
      <Button className="mt-4" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>
    </section>
  );
}
