import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  type AchievementStats,
} from "@/lib/scoring/achievements";

function stats(over: Partial<AchievementStats> = {}): AchievementStats {
  return {
    totalPredictions: 0,
    correctPredictions: 0,
    perfectPredictions: 0,
    maxStreak: 0,
    totalPoints: 0,
    ...over,
  };
}

describe("evaluateAchievements", () => {
  it("sin actividad → ningún logro", () => {
    expect(evaluateAchievements(stats())).toEqual([]);
  });

  it("first_prediction al primer pronóstico", () => {
    expect(evaluateAchievements(stats({ totalPredictions: 1 }))).toContain(
      "first_prediction",
    );
  });

  it("first_win al primer acierto", () => {
    expect(
      evaluateAchievements(
        stats({ totalPredictions: 1, correctPredictions: 1 }),
      ),
    ).toContain("first_win");
  });

  it("sharpshooter con un pleno", () => {
    expect(evaluateAchievements(stats({ perfectPredictions: 1 }))).toContain(
      "sharpshooter",
    );
  });

  it("streak_3 con racha 3, pero no streak_legend", () => {
    const r = evaluateAchievements(stats({ maxStreak: 3 }));
    expect(r).toContain("streak_3");
    expect(r).not.toContain("streak_legend");
  });

  it("streak_legend con racha 10 (incluye también streak_3)", () => {
    const r = evaluateAchievements(stats({ maxStreak: 10 }));
    expect(r).toContain("streak_legend");
    expect(r).toContain("streak_3");
  });

  it("centurion con 100+ puntos", () => {
    expect(evaluateAchievements(stats({ totalPoints: 100 }))).toContain(
      "centurion",
    );
  });

  it("idempotente: no re-otorga los ya ganados", () => {
    const s = stats({ totalPredictions: 1, correctPredictions: 1 });
    const newly = evaluateAchievements(s, ["first_prediction"]);
    expect(newly).not.toContain("first_prediction");
    expect(newly).toContain("first_win");
  });

  it("devuelve vacío si ya tenía todos los que cumple", () => {
    const s = stats({ totalPredictions: 5, correctPredictions: 3 });
    const newly = evaluateAchievements(s, ["first_prediction", "first_win"]);
    expect(newly).toEqual([]);
  });
});
