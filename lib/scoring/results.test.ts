import { describe, expect, it } from "vitest";
import { GOALS_BONUS_POINTS, RESULT_POINTS } from "@/lib/scoring/calculate";
import {
  aggregateAchievementStats,
  buildMatchResults,
  type PredictionToScore,
} from "@/lib/scoring/results";

describe("buildMatchResults", () => {
  it("puntúa cada pronóstico y conserva su identidad (claves para la RPC)", () => {
    const match = { score_home: 2, score_away: 1, winner_team: null };
    const predictions: PredictionToScore[] = [
      // Pleno: home + '2-3' (3 goles).
      { id: "p1", user_id: "u1", result_pred: "home", goals_range_pred: "2-3" },
      // Solo resultado: home + rango errado.
      { id: "p2", user_id: "u2", result_pred: "home", goals_range_pred: "6+" },
      // Fallo total.
      { id: "p3", user_id: "u3", result_pred: "away", goals_range_pred: "0-1" },
    ];

    expect(buildMatchResults(predictions, match)).toEqual([
      {
        prediction_id: "p1",
        user_id: "u1",
        points: RESULT_POINTS + GOALS_BONUS_POINTS,
        result_correct: true,
        goals_correct: true,
      },
      {
        prediction_id: "p2",
        user_id: "u2",
        points: RESULT_POINTS,
        result_correct: true,
        goals_correct: false,
      },
      {
        prediction_id: "p3",
        user_id: "u3",
        points: 0,
        result_correct: false,
        goals_correct: false,
      },
    ]);
  });

  it("sin pronósticos → arreglo vacío", () => {
    expect(buildMatchResults([], { score_home: 0, score_away: 0, winner_team: null })).toEqual(
      [],
    );
  });
});

describe("aggregateAchievementStats", () => {
  it("cuenta aciertos de resultado y plenos, y arrastra streak/puntos", () => {
    const stats = aggregateAchievementStats({
      predictions: [
        { result_correct: true, goals_correct: true }, // pleno
        { result_correct: true, goals_correct: false }, // solo resultado
        { result_correct: false, goals_correct: true }, // no cuenta (resultado errado)
        { result_correct: null, goals_correct: null }, // sin procesar
      ],
      maxStreak: 7,
      totalPoints: 120,
    });

    expect(stats).toEqual({
      totalPredictions: 4,
      correctPredictions: 2,
      perfectPredictions: 1,
      maxStreak: 7,
      totalPoints: 120,
    });
  });
});
