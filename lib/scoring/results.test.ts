import { describe, expect, it } from "vitest";
import { MAX_SCORE_BONUS, RESULT_POINTS } from "@/lib/scoring/calculate";
import {
  aggregateAchievementStats,
  buildMatchResults,
  type PredictionToScore,
} from "@/lib/scoring/results";

describe("buildMatchResults", () => {
  it("puntúa cada pronóstico y conserva su identidad (claves para la RPC)", () => {
    const match = { score_home: 2, score_away: 1, winner_team: null };
    const predictions: PredictionToScore[] = [
      // Pleno: home + marcador exacto 2-1.
      { id: "p1", user_id: "u1", result_pred: "home", home_goals_pred: 2, away_goals_pred: 1 },
      // Solo resultado: home, sin marcador.
      { id: "p2", user_id: "u2", result_pred: "home", home_goals_pred: null, away_goals_pred: null },
      // Fallo total: resultado errado y sin marcador.
      { id: "p3", user_id: "u3", result_pred: "away", home_goals_pred: null, away_goals_pred: null },
    ];

    expect(buildMatchResults(predictions, match)).toEqual([
      {
        prediction_id: "p1",
        user_id: "u1",
        points: RESULT_POINTS + MAX_SCORE_BONUS,
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
        { match_id: 1, kickoff_at: "2026-06-11T18:00:00Z", result_correct: true, goals_correct: true }, // pleno
        { match_id: 2, kickoff_at: "2026-06-12T18:00:00Z", result_correct: true, goals_correct: false }, // solo resultado
        { match_id: 3, kickoff_at: "2026-06-13T18:00:00Z", result_correct: false, goals_correct: true }, // no cuenta (resultado errado)
        { match_id: 4, kickoff_at: "2026-06-14T18:00:00Z", result_correct: null, goals_correct: null }, // sin procesar
      ],
      maxStreak: 7,
      totalPoints: 120,
      openerMatchId: 99,
    });

    expect(stats).toEqual({
      totalPredictions: 4,
      correctPredictions: 2,
      perfectPredictions: 1,
      maxStreak: 7,
      totalPoints: 120,
      predictedTournamentOpener: false,
      maxCorrectStreak: 2, // partidos 1 y 2 seguidos antes del fallo en el 3
    });
  });

  it("detecta tournament_opener cuando pronosticó el primer partido", () => {
    const stats = aggregateAchievementStats({
      predictions: [
        { match_id: 5, kickoff_at: "2026-06-11T18:00:00Z", result_correct: true, goals_correct: false },
      ],
      maxStreak: 0,
      totalPoints: 0,
      openerMatchId: 5,
    });
    expect(stats.predictedTournamentOpener).toBe(true);
  });

  it("maxCorrectStreak ordena por kickoff, no por orden de inserción", () => {
    const stats = aggregateAchievementStats({
      predictions: [
        // Llegan desordenadas; por kickoff la racha real es 4 (días 11→14).
        { match_id: 3, kickoff_at: "2026-06-13T18:00:00Z", result_correct: true, goals_correct: false },
        { match_id: 1, kickoff_at: "2026-06-11T18:00:00Z", result_correct: true, goals_correct: false },
        { match_id: 4, kickoff_at: "2026-06-14T18:00:00Z", result_correct: true, goals_correct: false },
        { match_id: 0, kickoff_at: "2026-06-10T18:00:00Z", result_correct: false, goals_correct: false },
        { match_id: 2, kickoff_at: "2026-06-12T18:00:00Z", result_correct: true, goals_correct: false },
      ],
      maxStreak: 0,
      totalPoints: 0,
      openerMatchId: null,
    });
    expect(stats.maxCorrectStreak).toBe(4);
  });
});
