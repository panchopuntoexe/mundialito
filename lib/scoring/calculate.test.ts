import { describe, expect, it } from "vitest";
import {
  calculatePoints,
  deriveResult,
  EXACT_SCORE_BONUS,
  GOAL_PROXIMITY_POINTS,
  MAX_SCORE_BONUS,
  RESULT_POINTS,
} from "@/lib/scoring/calculate";

const [P0, P1, P2] = GOAL_PROXIMITY_POINTS;

describe("deriveResult", () => {
  it("local / empate / visitante", () => {
    expect(deriveResult(2, 0)).toBe("home");
    expect(deriveResult(1, 1)).toBe("draw");
    expect(deriveResult(0, 3)).toBe("away");
  });
});

describe("calculatePoints — marcador exacto + cercanía", () => {
  // Resultado real 2-1 (grupos → resultado 'home').
  const groupMatch = { score_home: 2, score_away: 1, winner_team: null };

  it("marcador exacto = tope (resultado 10 + bonus 15 = 25)", () => {
    const r = calculatePoints(
      { result_pred: "home", home_goals_pred: 2, away_goals_pred: 1 },
      groupMatch,
    );
    expect(r).toEqual({
      points: RESULT_POINTS + MAX_SCORE_BONUS,
      resultCorrect: true,
      goalsCorrect: true,
    });
    expect(r.points).toBe(25);
  });

  it("cercano por 1 en un equipo (3-1): resultado + exacto + por1", () => {
    // dHome=1 → P1, dAway=0 → P0. Sin exacto-ambos.
    const r = calculatePoints(
      { result_pred: "home", home_goals_pred: 3, away_goals_pred: 1 },
      groupMatch,
    );
    expect(r.points).toBe(RESULT_POINTS + P1 + P0);
    expect(r.goalsCorrect).toBe(false);
  });

  it("ambos por 1 (1-0): resultado + P1 + P1", () => {
    const r = calculatePoints(
      { result_pred: "home", home_goals_pred: 1, away_goals_pred: 0 },
      groupMatch,
    );
    expect(r.points).toBe(RESULT_POINTS + P1 + P1);
  });

  it("cercanía ≥3 no suma (0 puntos de proximidad)", () => {
    // home 2→9 (dif 7 → 0), away 1→8 (dif 7 → 0). Resultado 'home' igual acierta.
    const r = calculatePoints(
      { result_pred: "home", home_goals_pred: 9, away_goals_pred: 8 },
      groupMatch,
    );
    expect(r.points).toBe(RESULT_POINTS);
  });

  it("la cercanía se cuenta aunque falle el resultado (independiente)", () => {
    // Predice empate 1-1: resultado 'draw' falla (real 'home'), pero away exacto
    // (dAway=0 → P0) y home por 1 (dHome=1 → P1).
    const r = calculatePoints(
      { result_pred: "draw", home_goals_pred: 1, away_goals_pred: 1 },
      groupMatch,
    );
    expect(r.resultCorrect).toBe(false);
    expect(r.points).toBe(P1 + P0);
  });

  it("sin marcador: solo el resultado (10) o 0", () => {
    expect(
      calculatePoints(
        { result_pred: "home", home_goals_pred: null, away_goals_pred: null },
        groupMatch,
      ),
    ).toEqual({ points: RESULT_POINTS, resultCorrect: true, goalsCorrect: false });

    expect(
      calculatePoints(
        { result_pred: "away", home_goals_pred: null, away_goals_pred: null },
        groupMatch,
      ),
    ).toEqual({ points: 0, resultCorrect: false, goalsCorrect: false });
  });

  it("knockout: el resultado sale de winner_team, no del marcador empatado", () => {
    // 1-1 definido por penales; avanza el local. Predice 'home' + marcador exacto.
    const knockout = {
      score_home: 1,
      score_away: 1,
      winner_team: "home" as const,
    };
    const r = calculatePoints(
      { result_pred: "home", home_goals_pred: 1, away_goals_pred: 1 },
      knockout,
    );
    expect(r).toEqual({
      points: RESULT_POINTS + MAX_SCORE_BONUS,
      resultCorrect: true,
      goalsCorrect: true,
    });
  });

  it("knockout: predecir 'draw' nunca acierta el resultado", () => {
    const knockout = {
      score_home: 0,
      score_away: 0,
      winner_team: "away" as const,
    };
    const r = calculatePoints(
      { result_pred: "draw", home_goals_pred: 0, away_goals_pred: 0 },
      knockout,
    );
    expect(r.resultCorrect).toBe(false);
    // 0-0 exacto: cercanía igual suma (P0 + P0 + bonus exacto).
    expect(r.points).toBe(P0 + P0 + EXACT_SCORE_BONUS);
    expect(r.goalsCorrect).toBe(true);
  });

  it("knockout: la tanda de penales NO cuenta en la cercanía del marcador", () => {
    // 1-1 en 120', definido 5-4 en penales. Se puntúa contra 1-1, no 5-4.
    const knockout = {
      score_home: 1,
      score_away: 1,
      winner_team: "away" as const,
    };
    const r = calculatePoints(
      { result_pred: "away", home_goals_pred: 1, away_goals_pred: 1 },
      knockout,
    );
    expect(r.goalsCorrect).toBe(true);
    expect(r.points).toBe(RESULT_POINTS + MAX_SCORE_BONUS);
  });

  it(`P2 aplica a diferencia de 2 (constantes: ${P0}/${P1}/${P2})`, () => {
    // home 2→0 (dif 2 → P2), away 1→1 (exacto → P0). Resultado 'away' falla.
    const r = calculatePoints(
      { result_pred: "away", home_goals_pred: 0, away_goals_pred: 1 },
      groupMatch,
    );
    expect(r.points).toBe(P2 + P0);
  });
});
