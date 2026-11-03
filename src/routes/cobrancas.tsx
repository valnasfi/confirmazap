import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { brl } from "@/lib/booking";
import { refundDeposit } from "@/lib/refund.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças — ReservaPix" }, { name: "description", content: "Cobranças de não comparecimento." }, { property: "og:title", content: "Cobranças — ReservaPix" }, { property: "og:description", content: "Cobranças de não comparecimento." }] }),
  component: () => <AppShell><Cobrancas /></AppShell>,
});

type P = { id: string; created_at: string; value: number; status: string; asaas_payment_id: string | null; customers: { name: string } | null };
const label: Record<string, string> = { pending: "Aguardando", paid: "Pago", failed: "Falhou", canceled: "Cancelado", refund_needed: "Devolver sinal", refunded: "Devolvido" };

function Cobrancas() {
  const { business } = useBiz();
  const [rows, setRows] = useState<P[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(() => supabase.from("payments").select("id,created_at,value,status,asaas_payment_id,customers(name)").eq("business_id", business.id).order("created_at", { ascending: false }).then(({ data }) => setRows((data as unknown as P[]) ?? [])), [business.id]);
  useEffect(() => { load(); }, [load]);

  const refund = async (r: P) => {
    if (!window.confirm(`Devolver ${brl(r.value)} para ${r.customers?.name ?? "o cliente"} por Pix? A taxa do Asaas não é devolvida e a conta precisa ter saldo.`)) return;
    setBusyId(r.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("Sessão expirada. Entre de novo.");
      const res = await refundDeposit({ data: { accessToken: sess.session.access_token, paymentId: r.id } });
      toast.success(res.notified ? "Sinal devolvido e cliente avisado no WhatsApp." : "Sinal devolvido. Não foi possível avisar o cliente pelo WhatsApp.");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    setBusyId(null);
  };
  const pendingRefunds = rows.filter((r) => r.status === "refund_needed").length;
  return (
    <div>
      <h1 className="text-3xl font-bold">Cobranças</h1>
      {pendingRefunds > 0 && <p className="mt-3 rounded-xl bg-st-noshow/20 p-3 text-sm">Você tem <b>{pendingRefunds}</b> {pendingRefunds === 1 ? "sinal" : "sinais"} para devolver. Clique em "Devolver sinal" na linha do cliente.</p>}
      <div className="mt-6 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-4">Data</th><th>Cliente</th><th>Valor</th><th>Status</th><th>ID Asaas</th><th></th></tr></thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={6}>Nenhuma cobrança ainda.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}><td className="p-4">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td><td>{r.customers?.name}</td><td className="font-semibold">{brl(r.value)}</td>
                <td><span className={`rounded-full px-2 py-1 text-xs ${r.status === "paid" ? "bg-st-confirmed/20" : r.status === "failed" || r.status === "refund_needed" ? "bg-st-noshow/20" : "bg-st-pending/20"}`}>{label[r.status] ?? r.status}</span></td>
                <td className="font-mono text-xs text-muted-foreground">{r.asaas_payment_id ?? "—"}</td>
                <td className="pr-4 text-right">{r.status === "refund_needed" && <Button size="sm" disabled={busyId === r.id} onClick={() => refund(r)}>{busyId === r.id ? "Devolvendo…" : "Devolver sinal"}</Button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
