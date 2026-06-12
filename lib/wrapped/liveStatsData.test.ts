import { describe, expect, it } from "vitest";
import {
  toLiveStatsCardData,
  type LiveStatsRows,
} from "@/lib/wrapped/liveStatsData";

function rows(overrides: Partial<LiveStatsRows> = {}): LiveStatsRows {
  return {
    username: "franchu",
    totalPoints: 145,
    accuracy: { accuracy: 67, total_predictions: 12, correct_predictions: 8 },
    currentStreak: 4,
    higherCount: 13,
    positiveCount: 230,
    ...overrides,
  };
}

describe("toLiveStatsCardData", () => {
  it("ensambla la tarjeta con rank y nivel derivados", () => {
    expect(toLiveStatsCardData(rows())).toEqual({
      username: "franchu",
      totalPoints: 145,
      levelKey: "leyenda", // 145 pts: Crack (50) sin llegar a Campeón (150).
      accuracy: 67,
      correctPredictions: 8,
      totalPredictions: 12,
      currentStreak: 4,
      rank: 14,
      rankTotal: 230,
    });
  });

  it("usuario nuevo: sin filas de accuracy/streak → defaults en 0", () => {
    const data = toLiveStatsCardData(
      rows({
        totalPoints: 0,
        accuracy: null,
        currentStreak: null,
        higherCount: 230,
        positiveCount: 230,
      }),
    );
    expect(data).toMatchObject({
      levelKey: "suplente",
      accuracy: 0,
      correctPredictions: 0,
      totalPredictions: 0,
      currentStreak: 0,
      rank: 231,
      rankTotal: 231, // 0 pts queda fuera del universo: nunca "#231 de 230".
    });
  });

  it("deriva el nivel de los puntos totales (100 → Leyenda)", () => {
    expect(toLiveStatsCardData(rows({ totalPoints: 100 })).levelKey).toBe(
      "leyenda",
    );
  });
});
