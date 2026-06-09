import { describe, expect, it } from "vitest";
import {
  buildWrappedStats,
  findEpicMiss,
  type WrappedPrediction,
} from "@/lib/scoring/wrappedStats";

/** Helper: pronóstico con defaults razonables, sobreescribibles. */
function pred(over: Partial<WrappedPrediction> = {}): WrappedPrediction {
  return {
    matchId: 1,
    matchLabel: "ARG vs MEX",
    pointsEarned: 0,
    resultCorrect: false,
    goalsCorrect: false,
    communityCorrectPct: 0,
    ...over,
  };
}

describe("findEpicMiss", () => {
  it("elige el partido fallado que más gente acertó", () => {
    const predictions = [
      pred({ matchId: 1, resultCorrect: false, communityCorrectPct: 30 }),
      pred({ matchId: 2, resultCorrect: false, communityCorrectPct: 80 }),
      pred({ matchId: 3, resultCorrect: false, communityCorrectPct: 55 }),
    ];
    expect(findEpicMiss(predictions)?.matchId).toBe(2);
  });

  it("ignora los pronósticos acertados aunque tengan mayor consenso", () => {
    const predictions = [
      pred({ matchId: 1, resultCorrect: true, communityCorrectPct: 95 }),
      pred({ matchId: 2, resultCorrect: false, communityCorrectPct: 40 }),
    ];
    expect(findEpicMiss(predictions)?.matchId).toBe(2);
  });

  it("desempata por menor matchId (determinista)", () => {
    const predictions = [
      pred({ matchId: 5, resultCorrect: false, communityCorrectPct: 70 }),
      pred({ matchId: 2, resultCorrect: false, communityCorrectPct: 70 }),
    ];
    expect(findEpicMiss(predictions)?.matchId).toBe(2);
  });

  it("sin fallos → null", () => {
    const predictions = [
      pred({ matchId: 1, resultCorrect: true }),
      pred({ matchId: 2, resultCorrect: true }),
    ];
    expect(findEpicMiss(predictions)).toBeNull();
  });

  it("sin pronósticos → null", () => {
    expect(findEpicMiss([])).toBeNull();
  });
});

describe("buildWrappedStats", () => {
  it("agrega aciertos, plenos, puntos, accuracy y arrastra racha/logros", () => {
    const stats = buildWrappedStats({
      phase: "group_stage",
      maxStreak: 6,
      achievements: ["first_win", "sharpshooter"],
      predictions: [
        // pleno
        pred({
          matchId: 1,
          pointsEarned: 25,
          resultCorrect: true,
          goalsCorrect: true,
          communityCorrectPct: 60,
        }),
        // solo resultado
        pred({
          matchId: 2,
          pointsEarned: 10,
          resultCorrect: true,
          goalsCorrect: false,
          communityCorrectPct: 50,
        }),
        // fallo grande
        pred({
          matchId: 3,
          pointsEarned: 0,
          resultCorrect: false,
          communityCorrectPct: 90,
        }),
      ],
    });

    expect(stats).toEqual({
      phase: "group_stage",
      totalPredictions: 3,
      correctPredictions: 2,
      perfectPredictions: 1,
      accuracy: 67, // round(2/3 * 100)
      totalPoints: 35,
      maxStreak: 6,
      epicMiss: { matchId: 3, matchLabel: "ARG vs MEX", communityCorrectPct: 90 },
      achievements: ["first_win", "sharpshooter"],
    });
  });

  it("sin pronósticos → ceros, accuracy 0 y sin fallo épico", () => {
    const stats = buildWrappedStats({
      phase: "full_tournament",
      maxStreak: 0,
      predictions: [],
    });

    expect(stats).toEqual({
      phase: "full_tournament",
      totalPredictions: 0,
      correctPredictions: 0,
      perfectPredictions: 0,
      accuracy: 0,
      totalPoints: 0,
      maxStreak: 0,
      epicMiss: null,
      achievements: [],
    });
  });
});
