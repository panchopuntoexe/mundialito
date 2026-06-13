import { describe, expect, it } from "vitest";
import { localKickoffLabel } from "@/lib/matches/local-kickoff";

// EE.UU. vs Paraguay: 2026-06-13T01:00Z = vie 21:00 ET (día del torneo 2026-06-12).
const USA_PAR = "2026-06-13T01:00:00Z";
// Turquía vs Paraguay: 2026-06-20T03:00Z = vie 23:00 ET (día del torneo 2026-06-19).
const TUR_PAR = "2026-06-20T03:00:00Z";

describe("localKickoffLabel", () => {
  it("usuario en UTC-5 (Ecuador): hora local, mismo día que el torneo", () => {
    expect(localKickoffLabel(USA_PAR, "America/Guayaquil")).toBe("20:00");
  });

  it("usuario en la TZ del torneo: misma hora que antes del fix", () => {
    expect(localKickoffLabel(USA_PAR, "America/New_York")).toBe("21:00");
  });

  it("la fecha local cruza al día siguiente → antepone el día corto", () => {
    // 23:00 ET del viernes = 00:00 del sábado en UTC-3.
    expect(localKickoffLabel(TUR_PAR, "America/Argentina/Buenos_Aires")).toBe(
      "sáb 00:00",
    );
    // Y de madrugada en Europa (UTC+2).
    expect(localKickoffLabel(USA_PAR, "Europe/Madrid")).toBe("sáb 03:00");
  });
});
