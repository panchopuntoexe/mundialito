import { describe, expect, it } from "vitest";
import {
  createPredictionSchema,
  MAX_GOALS_PER_TEAM,
} from "@/lib/validations/prediction";

describe("createPredictionSchema", () => {
  it("acepta un pronóstico válido con marcador exacto", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 42,
      result_pred: "home",
      home_goals_pred: 2,
      away_goals_pred: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it("acepta pronóstico solo con resultado (marcador omitido)", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 42,
      result_pred: "home",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.home_goals_pred).toBeUndefined();
      expect(parsed.data.away_goals_pred).toBeUndefined();
    }
  });

  it("acepta marcador null en ambos lados", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 42,
      result_pred: "away",
      home_goals_pred: null,
      away_goals_pred: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza un marcador a medias (un lado sin el otro)", () => {
    expect(
      createPredictionSchema.safeParse({
        match_id: 42,
        result_pred: "home",
        home_goals_pred: 2,
      }).success,
    ).toBe(false);
    expect(
      createPredictionSchema.safeParse({
        match_id: 42,
        result_pred: "home",
        home_goals_pred: 2,
        away_goals_pred: null,
      }).success,
    ).toBe(false);
  });

  it("rechaza un result_pred fuera del enum", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 1,
      result_pred: "tie",
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza goles negativos, no enteros o sobre el tope", () => {
    const base = { match_id: 1, result_pred: "home" as const };
    expect(
      createPredictionSchema.safeParse({ ...base, home_goals_pred: -1, away_goals_pred: 0 })
        .success,
    ).toBe(false);
    expect(
      createPredictionSchema.safeParse({ ...base, home_goals_pred: 1.5, away_goals_pred: 0 })
        .success,
    ).toBe(false);
    expect(
      createPredictionSchema.safeParse({
        ...base,
        home_goals_pred: MAX_GOALS_PER_TEAM + 1,
        away_goals_pred: 0,
      }).success,
    ).toBe(false);
  });

  it("rechaza campos faltantes", () => {
    const parsed = createPredictionSchema.safeParse({ match_id: 1 });
    expect(parsed.success).toBe(false);
  });

  it("rechaza match_id no entero o no positivo", () => {
    expect(
      createPredictionSchema.safeParse({ match_id: -3, result_pred: "home" }).success,
    ).toBe(false);
    expect(
      createPredictionSchema.safeParse({ match_id: 1.5, result_pred: "home" }).success,
    ).toBe(false);
  });
});
