import { useState } from "react";
import { toast } from "sonner";
import { Cake } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_BIRTHDAY_MESSAGE, renderBirthday, type BirthdaySettings as Cfg } from "@/lib/birthday";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function BirthdaySettings() {
  const { business, reload } = useBiz();
  const settings = (business.settings ?? {}) as Record<string, unknown>;
  const cfg = (settings["birthday"] ?? {}) as Cfg;
  const [enabled, setEnabled] = useState(Boolean(cfg.enabled));
  const [message, setMessage] = useState(cfg.message || DEFAULT_BIRTHDAY_MESSAGE);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (enabled && !message.trim()) { toast.error("Escreva a mensagem de aniversário"); return; }
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ settings: { ...settings, birthday: { enabled, message: message.trim() } } }).eq("id", business.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(enabled ? "Aniversários ativados" : "Aniversários desativados");
    reload();
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Cake className="h-5 w-5" />Feliz aniversário automático</h2>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar mensagem de aniversário" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">No dia do aniversário, o cliente recebe a mensagem pelo seu WhatsApp, a partir das 9h. Só recebe quem tem a data de nascimento no cadastro, e cada cliente recebe uma vez por ano. Precisa do WhatsApp conectado.</p>
      <label className="mt-4 block text-sm">Mensagem
        <Textarea className="mt-1" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Use {"{nome}"} para o primeiro nome do cliente e {"{negocio}"} para o nome do seu negócio.</p>
      <p className="mt-3 rounded-xl bg-muted p-3 text-sm"><b>Como o cliente vai ler:</b> {renderBirthday(message || DEFAULT_BIRTHDAY_MESSAGE, "maria souza", business.name)}</p>
      <Button className="mt-4" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>
    </section>
  );
}
