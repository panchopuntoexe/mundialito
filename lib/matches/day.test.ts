import { describe, expect, it } from "vitest";
import { tournamentDayRangeUtc, tournamentToday } from "@/lib/matches/day";

describe("tournamentDayRangeUtc", () => {
  it("America/New_York en verano (EDT, UTC-4): el día va 04:00Z → 04:00Z", () => {
    // Durante el Mundial (jun-jul) NY está en horario de verano (UTC-4).
    expect(tournamentDayRangeUtc("2026-06-15")).toEqual({
      startUtc: "2026-06-15T04:00:00.000Z",
      endUtc: "2026-06-16T04:00:00.000Z",
    });
  });

  it("cruza fin de mes correctamente", () => {
    const { startUtc, endUtc } = tournamentDayRangeUtc("2026-06-30");
    expect(startUtc).toBe("2026-06-30T04:00:00.000Z");
    expect(endUtc).toBe("2026-07-01T04:00:00.000Z");
  });

  it("el rango dura 24h y end = start del día siguiente", () => {
    const d1 = tournamentDayRangeUtc("2026-07-19");
    const d2 = tournamentDayRangeUtc("2026-07-20");
    expect(d1.endUtc).toBe(d2.startUtc);
    const ms = new Date(d1.endUtc).getTime() - new Date(d1.startUtc).getTime();
    expect(ms).toBe(24 * 60 * 60 * 1000);
  });

  it("acepta una TZ explícita (UTC)", () => {
    expect(tournamentDayRangeUtc("2026-06-15", "UTC")).toEqual({
      startUtc: "2026-06-15T00:00:00.000Z",
      endUtc: "2026-06-16T00:00:00.000Z",
    });
  });
});

describe("tournamentToday", () => {
  it("convierte un instante a su día en la TZ del torneo", () => {
    // 02:00 UTC del 16-jun es aún 22:00 EDT del 15-jun en Nueva York.
    expect(tournamentToday(new Date("2026-06-16T02:00:00Z"))).toBe("2026-06-15");
    // 12:00 UTC cae claramente dentro del 16-jun en NY.
    expect(tournamentToday(new Date("2026-06-16T12:00:00Z"))).toBe("2026-06-16");
  });
});
