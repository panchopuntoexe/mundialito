import { describe, expect, it } from "vitest";
import { createPredictionSchema } from "@/lib/validations/prediction";

describe("createPredictionSchema", () => {
  it("acepta un pronóstico válido", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 42,
      result_pred: "home",
      goals_range_pred: "2-3",
    });
    expect(parsed.success).toBe(true);
  });

  it("acepta pronóstico solo con resultado (goles omitidos)", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 42,
      result_pred: "home",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.goals_range_pred).toBeUndefined();
    }
  });

  it("acepta goals_range_pred null", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 42,
      result_pred: "away",
      goals_range_pred: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza un result_pred fuera del enum", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 1,
      result_pred: "tie",
      goals_range_pred: "0-1",
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza un goals_range_pred fuera del enum", () => {
    const parsed = createPredictionSchema.safeParse({
      match_id: 1,
      result_pred: "away",
      goals_range_pred: "7-8",
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza campos faltantes", () => {
    const parsed = createPredictionSchema.safeParse({ match_id: 1 });
    expect(parsed.success).toBe(false);
  });

  it("rechaza match_id no entero o no positivo", () => {
    expect(
      createPredictionSchema.safeParse({
        match_id: -3,
        result_pred: "home",
        goals_range_pred: "0-1",
      }).success,
    ).toBe(false);
    expect(
      createPredictionSchema.safeParse({
        match_id: 1.5,
        result_pred: "home",
        goals_range_pred: "0-1",
      }).success,
    ).toBe(false);
  });
});
