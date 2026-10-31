import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { brl } from "@/lib/booking";

export const Route = createFileRoute("/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças — ConfirmaZap" }, { name: "description", content: "Cobranças de não comparecimento." }, { property: "og:title", content: "Cobranças — ConfirmaZap" }, { property: "og:description", content: "Cobranças de não comparecimento." }] }),
  component: () => <AppShell><Cobrancas /></AppShell>,
});

type P = { id: string; created_at: string; value: number; status: string; asaas_payment_id: string | null; customers: { name: string } | null };
const label: Record<string, string> = { pending: "Aguardando", paid: "Pago", failed: "Falhou", canceled: "Cancelado", refund_needed: "Devolver sinal" };

function Cobrancas() {
  const { business } = useBiz();
  const [rows, setRows] = useState<P[]>([]);
  useEffect(() => { supabase.from("payments").select("id,created_at,value,status,asaas_payment_id,customers(name)").eq("business_id", business.id).order("created_at", { ascending: false }).then(({ data }) => setRows((data as unknown as P[]) ?? [])); }, [business.id]);
  return (
    <div>
      <h1 className="text-3xl font-bold">Cobranças</h1>
      <div className="mt-6 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-4">Data</th><th>Cliente</th><th>Valor</th><th>Status</th><th>ID Asaas</th></tr></thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Nenhuma cobrança ainda.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}><td className="p-4">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td><td>{r.customers?.name}</td><td className="font-semibold">{brl(r.value)}</td>
                <td><span className={`rounded-full px-2 py-1 text-xs ${r.status === "paid" ? "bg-st-confirmed/20" : r.status === "failed" || r.status === "refund_needed" ? "bg-st-noshow/20" : "bg-st-pending/20"}`}>{label[r.status] ?? r.status}</span></td>
                <td className="font-mono text-xs text-muted-foreground">{r.asaas_payment_id ?? "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
