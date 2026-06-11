import { describe, expect, it } from "vitest";
import {
  calculatePoints,
  deriveGoalsRange,
  deriveResult,
  GOALS_BONUS_POINTS,
  RESULT_POINTS,
} from "@/lib/scoring/calculate";

describe("deriveResult", () => {
  it("local / empate / visitante", () => {
    expect(deriveResult(2, 0)).toBe("home");
    expect(deriveResult(1, 1)).toBe("draw");
    expect(deriveResult(0, 3)).toBe("away");
  });
});

describe("deriveGoalsRange", () => {
  it("mapea cada bucket", () => {
    expect(deriveGoalsRange(0)).toBe("0-1");
    expect(deriveGoalsRange(1)).toBe("0-1");
    expect(deriveGoalsRange(2)).toBe("2-3");
    expect(deriveGoalsRange(3)).toBe("2-3");
    expect(deriveGoalsRange(4)).toBe("4-5");
    expect(deriveGoalsRange(5)).toBe("4-5");
    expect(deriveGoalsRange(6)).toBe("6+");
    expect(deriveGoalsRange(11)).toBe("6+");
  });
});

describe("calculatePoints", () => {
  const groupMatch = { score_home: 2, score_away: 1, winner_team: null };

  it("acierto de resultado sin bonus de goles = 10", () => {
    // 2-1 → home, 3 goles → '2-3'. Acierta resultado, falla goles.
    const r = calculatePoints(
      { result_pred: "home", goals_range_pred: "4-5" },
      groupMatch,
    );
    expect(r).toEqual({
      points: RESULT_POINTS,
      resultCorrect: true,
      goalsCorrect: false,
    });
  });

  it("sin pronóstico de goles: acierto de resultado = 10, sin bonus", () => {
    const r = calculatePoints(
      { result_pred: "home", goals_range_pred: null },
      groupMatch,
    );
    expect(r).toEqual({
      points: RESULT_POINTS,
      resultCorrect: true,
      goalsCorrect: false,
    });
  });

  it("acierto de resultado + goles = 25 (bonus)", () => {
    const r = calculatePoints(
      { result_pred: "home", goals_range_pred: "2-3" },
      groupMatch,
    );
    expect(r).toEqual({
      points: RESULT_POINTS + GOALS_BONUS_POINTS,
      resultCorrect: true,
      goalsCorrect: true,
    });
  });

  it("fallo de resultado = 0 aunque el rango de goles coincida", () => {
    // El bonus exige acertar el resultado.
    const r = calculatePoints(
      { result_pred: "draw", goals_range_pred: "2-3" },
      groupMatch,
    );
    expect(r).toEqual({ points: 0, resultCorrect: false, goalsCorrect: true });
  });

  it("knockout: el resultado sale de winner_team, no del marcador empatado", () => {
    // 1-1 que se define por penales; avanza el local.
    const knockout = {
      score_home: 1,
      score_away: 1,
      winner_team: "home" as const,
    };
    const r = calculatePoints(
      { result_pred: "home", goals_range_pred: "2-3" },
      knockout,
    );
    // 1+1 = 2 goles → '2-3'. Resultado 'home' por winner_team. Pleno.
    expect(r).toEqual({
      points: RESULT_POINTS + GOALS_BONUS_POINTS,
      resultCorrect: true,
      goalsCorrect: true,
    });
  });

  it("knockout: predecir 'draw' nunca acierta (no hay empate)", () => {
    const knockout = {
      score_home: 0,
      score_away: 0,
      winner_team: "away" as const,
    };
    const r = calculatePoints(
      { result_pred: "draw", goals_range_pred: "0-1" },
      knockout,
    );
    expect(r.resultCorrect).toBe(false);
    expect(r.points).toBe(0);
  });

  it("knockout: la tanda de penales NO cuenta en el rango de goles", () => {
    // 1-1 en 120', definido 5-4 en penales. total_goals = 2 (no 11).
    const knockout = {
      score_home: 1,
      score_away: 1,
      winner_team: "away" as const,
    };
    const r = calculatePoints(
      { result_pred: "away", goals_range_pred: "2-3" },
      knockout,
    );
    expect(r.goalsCorrect).toBe(true); // '2-3', no '6+'
    expect(r.points).toBe(RESULT_POINTS + GOALS_BONUS_POINTS);
  });
});
