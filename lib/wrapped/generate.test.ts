import { describe, expect, it } from "vitest";
import {
  actualResult,
  communityCorrectPct,
  isMacroRoundComplete,
} from "@/lib/wrapped/generate";

describe("actualResult", () => {
  it("grupos: deriva del marcador", () => {
    expect(actualResult({ score_home: 2, score_away: 1, winner_team: null })).toBe("home");
    expect(actualResult({ score_home: 0, score_away: 0, winner_team: null })).toBe("draw");
    expect(actualResult({ score_home: 1, score_away: 3, winner_team: null })).toBe("away");
  });

  it("knockout: lo decide quién avanza, aunque el marcador empate", () => {
    expect(actualResult({ score_home: 1, score_away: 1, winner_team: "away" })).toBe("away");
  });
});

describe("communityCorrectPct", () => {
  it("redondea el % de aciertos del resultado", () => {
    // 2 de 3 acertaron 'home'.
    expect(communityCorrectPct(["home", "home", "away"], "home")).toBe(67);
  });

  it("sin pronósticos → 0", () => {
    expect(communityCorrectPct([], "draw")).toBe(0);
  });

  it("todos aciertan → 100", () => {
    expect(communityCorrectPct(["away", "away"], "away")).toBe(100);
  });
});

describe("isMacroRoundComplete", () => {
  it("completa si todos finalizados/cancelados", () => {
    expect(isMacroRoundComplete(["finished", "finished", "cancelled"])).toBe(true);
  });

  it("incompleta si queda alguno pendiente", () => {
    expect(isMacroRoundComplete(["finished", "live"])).toBe(false);
    expect(isMacroRoundComplete(["finished", "scheduled"])).toBe(false);
  });

  it("sin partidos → no completa", () => {
    expect(isMacroRoundComplete([])).toBe(false);
  });
});
