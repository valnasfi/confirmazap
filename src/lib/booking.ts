// Regras puras de agenda: Seg–Sáb, 8h às 19h.
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 19;

// Tempo que o horário fica guardado esperando o pagamento do sinal.
export const HOLD_MINUTES = 30;
export const holdCutoff = () => new Date(Date.now() - HOLD_MINUTES * 60_000).toISOString();
// Filtro PostgREST (.or): reserva válida = já paga/confirmada ou ainda dentro do prazo de pagamento.
export const activeHoldFilter = () => `status.neq.pending,created_at.gte.${holdCutoff()}`;

export function isOpenDay(d: Date) {
  return d.getDay() !== 0; // domingo fechado
}

export function generateSlots(day: Date, durationMinutes: number, busyStarts: string[]): Date[] {
  if (!isOpenDay(day) || durationMinutes <= 0) return [];
  const busy = new Set(busyStarts.map((s) => new Date(s).getTime()));
  const slots: Date[] = [];
  const t = new Date(day);
  t.setHours(OPEN_HOUR, 0, 0, 0);
  const end = new Date(day);
  end.setHours(CLOSE_HOUR, 0, 0, 0);
  while (t.getTime() + durationMinutes * 60000 <= end.getTime()) {
    if (!busy.has(t.getTime())) slots.push(new Date(t));
    t.setMinutes(t.getMinutes() + durationMinutes);
  }
  return slots;
}

export function maskWhatsapp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const brl = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
