import { useState } from "react";
import { toast } from "sonner";
import { Cake } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_BIRTHDAY_MESSAGE, renderBirthday, type BirthdaySettings as Cfg } from "@/lib/birthday";
import { usePlan } from "@/lib/usePlan";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export function BirthdaySettings() {
  const { business, reload } = useBiz();
  const settings = (business.settings ?? {}) as Record<string, unknown>;
  const cfg = (settings["birthday"] ?? {}) as Cfg;
  const [enabled, setEnabled] = useState(Boolean(cfg.enabled));
  const [message, setMessage] = useState(cfg.message || DEFAULT_BIRTHDAY_MESSAGE);
  const [discount, setDiscount] = useState(String(cfg.discountPercent ?? ""));
  const [saving, setSaving] = useState(false);
  const { info: plan } = usePlan();
  const locked = Boolean(plan) && !plan!.limits.birthday;

  const save = async () => {
    if (enabled && !message.trim()) { toast.error("Escreva a mensagem de aniversário"); return; }
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ settings: { ...settings, birthday: { enabled, message: message.trim(), discountPercent: Math.min(50, Math.max(0, Math.round(Number(discount) || 0))) } } }).eq("id", business.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(enabled ? "Aniversários ativados" : "Aniversários desativados");
    reload();
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Cake className="h-5 w-5" />Feliz aniversário automático</h2>
        <Switch disabled={locked} checked={enabled && !locked} onCheckedChange={setEnabled} aria-label="Ativar mensagem de aniversário" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">No dia do aniversário, o cliente recebe a mensagem pelo seu WhatsApp, a partir das 9h. Só recebe quem tem a data de nascimento no cadastro, e cada cliente recebe uma vez por ano. Precisa do WhatsApp conectado.</p>
      {locked && <p className="mt-3 rounded-xl bg-muted p-3 text-sm">Este recurso é do <b>plano Pro</b>. Veja as opções em Configurações &gt; Plano.</p>}
      <label className="mt-4 block text-sm">Mensagem
        <Textarea className="mt-1" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Use {"{nome}"} para o primeiro nome do cliente e {"{negocio}"} para o nome do seu negócio.</p>
      <label className="mt-4 block text-sm">Desconto de aniversário (%) <span className="text-muted-foreground">— opcional, máx. 50</span>
        <Input className="mt-1 max-w-[140px]" type="number" min={0} max={50} placeholder="Ex.: 15" value={discount} onChange={(e) => setDiscount(e.target.value)} />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Vale por 7 dias, contando do dia do aniversário, para quem tem a data de nascimento no cadastro. O cliente vê o preço com desconto ao agendar e a agenda marca 🎂. O desconto é dado no atendimento; o sinal do Pix não muda. Deixe vazio para não dar desconto.</p>
      <p className="mt-3 rounded-xl bg-muted p-3 text-sm"><b>Como o cliente vai ler:</b> {renderBirthday(message || DEFAULT_BIRTHDAY_MESSAGE, "maria souza", business.name)}</p>
      <Button className="mt-4" disabled={saving || locked} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button>
    </section>
  );
}
