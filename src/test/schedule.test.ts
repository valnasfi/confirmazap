import { describe, expect, it } from "vitest";
import { generateSlotsFor, isDayOpen, readSchedule, slotAllowed } from "@/lib/schedule";

// 02/11/2026 é segunda-feira. 11:00Z = 08:00 em Brasília.
const mon8 = Date.UTC(2026, 10, 2, 11, 0);

describe("horário de funcionamento", () => {
  it("padrão: segunda a sábado, 8h às 19h; domingo fechado", () => {
    const s = readSchedule(null);
    expect(slotAllowed(mon8, 60, s)).toBe(true);
    expect(slotAllowed(Date.UTC(2026, 10, 1, 14, 0), 60, s)).toBe(false); // domingo
    expect(slotAllowed(Date.UTC(2026, 10, 2, 21, 30), 60, s)).toBe(false); // 18:30 + 1h passa das 19h
    expect(generateSlotsFor(new Date(2026, 10, 2), 60, [], s)).toHaveLength(11);
  });
  it("respeita o horário definido pela empresa", () => {
    const hours = readSchedule(null).hours.map((h, d) => (d === 1 ? { open: true, from: "10:00", to: "12:00" } : h));
    const s = readSchedule({ hours });
    expect(generateSlotsFor(new Date(2026, 10, 2), 60, [], s)).toHaveLength(2);
    expect(slotAllowed(mon8, 60, s)).toBe(false);
  });
  it("fechamento de dia inteiro, de intervalo e agenda pausada", () => {
    const day = readSchedule({ blocks: [{ id: "a", start: "2026-11-02", end: "2026-11-02" }] });
    expect(isDayOpen(new Date(2026, 10, 2), day)).toBe(false);
    expect(slotAllowed(mon8, 60, day)).toBe(false);
    const lunch = readSchedule({ blocks: [{ id: "b", start: "2026-11-02", end: "2026-11-02", from: "12:00", to: "14:00" }] });
    expect(slotAllowed(Date.UTC(2026, 10, 2, 15, 0), 60, lunch)).toBe(false); // 12:00
    expect(slotAllowed(Date.UTC(2026, 10, 2, 14, 0), 60, lunch)).toBe(true); // 11:00
    expect(generateSlotsFor(new Date(2026, 10, 2), 60, [], lunch)).toHaveLength(9);
    expect(slotAllowed(mon8, 60, readSchedule({ paused: true }))).toBe(false);
  });
});
