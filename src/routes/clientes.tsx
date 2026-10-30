import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { maskWhatsapp } from "@/lib/booking";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — ConfirmaZap" }, { name: "description", content: "Clientes e status da autorização Pix." }, { property: "og:title", content: "Clientes — ConfirmaZap" }, { property: "og:description", content: "Clientes e status da autorização Pix." }] }),
  component: () => <AppShell><Clientes /></AppShell>,
});

type C = { id: string; name: string; whatsapp: string; auth_status: string; consent_at: string | null };
const authLabel: Record<string, string> = { pending: "Pendente", active: "Ativa", canceled: "Cancelada", refused: "Recusada" };

function Clientes() {
  const { business } = useBiz();
  const [rows, setRows] = useState<C[]>([]);
  useEffect(() => { supabase.from("customers").select("id,name,whatsapp,auth_status,consent_at").eq("business_id", business.id).order("name").then(({ data }) => setRows((data as C[]) ?? [])); }, [business.id]);
  return (
    <div>
      <h1 className="text-3xl font-bold">Clientes</h1>
      <div className="mt-6 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-4">Nome</th><th>WhatsApp</th><th>Autorização Pix</th><th>Consentimento</th></tr></thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={4}>Nenhum cliente ainda.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}><td className="p-4 font-medium">{r.name}</td><td>{maskWhatsapp(r.whatsapp)}</td>
                <td><span className={`rounded-full px-2 py-1 text-xs ${r.auth_status === "active" ? "bg-st-confirmed/20" : "bg-st-pending/20"}`}>{authLabel[r.auth_status] ?? r.auth_status}</span></td>
                <td>{r.consent_at ? new Date(r.consent_at).toLocaleDateString("pt-BR") : "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
