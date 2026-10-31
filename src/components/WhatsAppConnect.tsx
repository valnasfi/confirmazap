import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { whatsappConnect, whatsappDisconnect, whatsappSendTest, whatsappStatus } from "@/lib/whatsapp.functions";
import { maskWhatsapp } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type St = { state: "disconnected" | "connecting" | "connected"; qrcode: string | null; paircode: string | null; phone: string | null; profileName: string | null };
const EMPTY: St = { state: "disconnected", qrcode: null, paircode: null, phone: null, profileName: null };

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sessão expirada. Entre de novo.");
  return data.session.access_token;
}

export function WhatsAppConnect() {
  const [st, setSt] = useState<St>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    try {
      const s = await whatsappStatus({ data: { accessToken: await token() } });
      setSt(s);
    } catch (e) { if (!quiet) toast.error((e as Error).message); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Enquanto espera a leitura do QR, consulta o estado a cada 3 segundos.
  useEffect(() => {
    if (st.state !== "connecting") return;
    const id = setInterval(() => refresh(true), 3000);
    return () => clearInterval(id);
  }, [st.state, refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const connect = () => run(async () => setSt(await whatsappConnect({ data: { accessToken: await token() } })));
  const disconnect = () => run(async () => {
    if (!window.confirm("Desconectar o WhatsApp deste negócio?")) return;
    await whatsappDisconnect({ data: { accessToken: await token() } });
    setSt(EMPTY);
    toast.success("WhatsApp desconectado");
  });
  const sendTest = () => run(async () => {
    const r = await whatsappSendTest({ data: { accessToken: await token(), number: test || undefined } });
    toast.success(`Mensagem enviada para ${r.number}`);
  });

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageCircle className="h-5 w-5" />WhatsApp</h2>
      <p className="mt-1 text-sm text-muted-foreground">Conecte o número do seu negócio. É ele que vai enviar os lembretes aos seus clientes.</p>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Verificando…</p>
      ) : st.state === "connected" ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-xl bg-muted p-3 text-sm">
            <b>Conectado</b>{st.profileName ? ` · ${st.profileName}` : ""}{st.phone ? ` · +${st.phone}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-56" placeholder="Número para teste (opcional)" inputMode="tel" value={test} onChange={(e) => setTest(maskWhatsapp(e.target.value))} />
            <Button variant="secondary" disabled={busy} onClick={sendTest}>Enviar mensagem de teste</Button>
            <Button variant="ghost" disabled={busy} onClick={disconnect}>Desconectar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Sem número, a mensagem de teste vai para o próprio WhatsApp conectado.</p>
        </div>
      ) : st.state === "connecting" && (st.qrcode || st.paircode) ? (
        <div className="mt-4 space-y-3">
          {st.qrcode && <img src={st.qrcode} alt="QR Code do WhatsApp" className="h-56 w-56 rounded-xl border bg-white" />}
          <p className="text-sm">No celular: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e leia o QR Code. A tela atualiza sozinha quando conectar.</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={connect}>Gerar novo QR Code</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button disabled={busy} onClick={connect}>{busy ? "Preparando…" : "Conectar WhatsApp"}</Button>
        </div>
      )}
    </section>
  );
}
