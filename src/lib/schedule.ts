// Horário de funcionamento e fechamentos da agenda de cada negócio (guardados em businesses.settings).
// Tudo é lido no horário de Brasília (UTC-3), o mesmo usado nos lembretes e no servidor.
import { CLOSE_HOUR, OPEN_HOUR } from "./booking";

export type DayHours = { open: boolean; from: string; to: string }; // "HH:MM"
export type Block = { id: string; start: string; end: string; from?: string; to?: string; reason?: string }; // datas "AAAA-MM-DD" (inclusivas)
export type Schedule = { hours: DayHours[]; blocks: Block[]; paused: boolean };

const BRT_OFFSET_MS = 3 * 3_600_000;
export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const pad = (n: number) => String(n).padStart(2, "0");
export const toHHMM = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

// Padrão antigo: segunda a sábado, 8h às 19h; domingo fechado.
export function defaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, d) => ({ open: d !== 0, from: toHHMM(OPEN_HOUR * 60), to: toHHMM(CLOSE_HOUR * 60) }));
}

export function readSchedule(settings: unknown): Schedule {
  const s = (settings ?? {}) as { hours?: unknown; blocks?: unknown; paused?: unknown };
  const base = defaultHours();
  const hours = base.map((def, d) => {
    const h = Array.isArray(s.hours) ? (s.hours[d] as Partial<DayHours> | undefined) : undefined;
    if (!h) return def;
    const from = Number.isFinite(toMin(String(h.from))) ? String(h.from) : def.from;
    const to = Number.isFinite(toMin(String(h.to))) ? String(h.to) : def.to;
    return { open: h.open !== false && (h.open === true || def.open), from, to } as DayHours;
  });
  const blocks = (Array.isArray(s.blocks) ? s.blocks : [])
    .filter((b): b is Block => Boolean(b) && typeof (b as Block).start === "string" && typeof (b as Block).end === "string")
    .map((b) => ({ id: String(b.id ?? `${b.start}-${b.end}`), start: b.start, end: b.end, from: b.from, to: b.to, reason: b.reason }));
  return { hours, blocks, paused: s.paused === true };
}

// Instante (ms) → partes no horário de Brasília.
export function brtParts(ms: number) {
  const d = new Date(ms - BRT_OFFSET_MS);
  return { key: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, dow: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// Dia do calendário escolhido na tela (data local do navegador) → "AAAA-MM-DD" e dia da semana.
export function dayInfo(day: Date) {
  return { key: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`, dow: day.getDay() };
}

const blockCoversDay = (b: Block, key: string) => key >= b.start && key <= b.end;
const blockIsWholeDay = (b: Block) => !b.from || !b.to || !Number.isFinite(toMin(b.from)) || !Number.isFinite(toMin(b.to));

export function isDayOpen(day: Date, sch: Schedule) {
  if (sch.paused) return false;
  const { key, dow } = dayInfo(day);
  if (!sch.hours[dow]?.open) return false;
  return !sch.blocks.some((b) => blockCoversDay(b, key) && blockIsWholeDay(b));
}

// O atendimento (início + duração) cabe no horário do dia e não toca em nenhum fechamento?
export function slotAllowed(startMs: number, durationMin: number, sch: Schedule) {
  if (sch.paused) return false;
  const { key, dow, minutes } = brtParts(startMs);
  const h = sch.hours[dow];
  if (!h?.open) return false;
  const end = minutes + durationMin;
  if (minutes < toMin(h.from) || end > toMin(h.to)) return false;
  for (const b of sch.blocks) {
    if (!blockCoversDay(b, key)) continue;
    if (blockIsWholeDay(b)) return false;
    if (minutes < toMin(b.to!) && end > toMin(b.from!)) return false;
  }
  return true;
}

// Horários livres do dia, no horário de Brasília, respeitando funcionamento e fechamentos.
export function generateSlotsFor(day: Date, durationMin: number, busyStarts: string[], sch: Schedule): Date[] {
  if (durationMin <= 0 || !isDayOpen(day, sch)) return [];
  const { dow } = dayInfo(day);
  const h = sch.hours[dow]!;
  const busy = new Set(busyStarts.map((s) => new Date(s).getTime()));
  const out: Date[] = [];
  const y = day.getFullYear(), m = day.getMonth(), d = day.getDate();
  for (let t = toMin(h.from); t + durationMin <= toMin(h.to); t += durationMin) {
    const ms = Date.UTC(y, m, d, 0, t) + BRT_OFFSET_MS;
    if (!busy.has(ms) && slotAllowed(ms, durationMin, sch)) out.push(new Date(ms));
  }
  return out;
}
