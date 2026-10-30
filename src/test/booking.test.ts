import { describe, it, expect } from "vitest";
import { generateSlots, maskWhatsapp } from "@/lib/booking";

describe("agenda", () => {
  it("domingo não tem horários", () => {
    expect(generateSlots(new Date(2026, 10, 1), 60, [])).toHaveLength(0);
  });
  it("segunda 8h-19h com 60min gera 11 horários", () => {
    expect(generateSlots(new Date(2026, 10, 2), 60, [])).toHaveLength(11);
  });
  it("horário ocupado é removido", () => {
    const busy = new Date(2026, 10, 2, 9, 0).toISOString();
    const s = generateSlots(new Date(2026, 10, 2), 60, [busy]);
    expect(s.map((d) => d.getHours())).not.toContain(9);
  });
  it("máscara de WhatsApp BR", () => {
    expect(maskWhatsapp("11987654321")).toBe("(11) 98765-4321");
  });
});
