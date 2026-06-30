import { describe, expect, it } from "vitest";
import type { MatchCardPrediction } from "@/components/MatchCard";
import { assembleBracket } from "@/lib/bracket/assemble";
import type { KnockoutMatchRow } from "@/lib/bracket/types";

function knockoutRow(
  over: Partial<KnockoutMatchRow> & { id: number },
): KnockoutMatchRow {
  return {
    external_ref: String(over.id),
    home_team: "A",
    away_team: "B",
    home_flag: null,
    away_flag: null,
    phase: "round_32",
    macro_round: "round_32",
    kickoff_at: "2026-06-29T18:00:00.000Z",
    status: "scheduled",
    score_home: null,
    score_away: null,
    winner_team: null,
    penalty_home: null,
    penalty_away: null,
    ...over,
  };
}

const noPreds = new Map<number, MatchCardPrediction>();

describe("assembleBracket", () => {
  it("ordena las columnas por ronda (PHASE_ORDER) y omite fases vacías", () => {
    const rows = [
      knockoutRow({ id: 1, phase: "final", external_ref: "104" }),
      knockoutRow({ id: 2, phase: "round_32", external_ref: "73" }),
      knockoutRow({ id: 3, phase: "quarter", external_ref: "97" }),
    ];
    const cols = assembleBracket(rows, noPreds);
    expect(cols.map((c) => c.phase)).toEqual(["round_32", "quarter", "final"]);
  });

  it("ordena dentro de la ronda por external_ref NUMÉRICO (no lexicográfico)", () => {
    // Como text, "100" < "73"; debe ganar el orden numérico 97 < 98 < 99 < 100.
    const rows = [
      knockoutRow({ id: 100, phase: "quarter", external_ref: "100" }),
      knockoutRow({ id: 97, phase: "quarter", external_ref: "97" }),
      knockoutRow({ id: 99, phase: "quarter", external_ref: "99" }),
      knockoutRow({ id: 98, phase: "quarter", external_ref: "98" }),
    ];
    const [quarter] = assembleBracket(rows, noPreds);
    expect(quarter.matches.map((m) => m.external_ref)).toEqual([
      "97",
      "98",
      "99",
      "100",
    ]);
  });

  it("superpone el pronóstico propio por match_id; null si no hay", () => {
    const rows = [
      knockoutRow({ id: 10, phase: "round_32", external_ref: "73" }),
      knockoutRow({ id: 11, phase: "round_32", external_ref: "74" }),
    ];
    const preds = new Map<number, MatchCardPrediction>([
      [
        10,
        {
          result_pred: "home",
          home_goals_pred: null,
          away_goals_pred: null,
          result_correct: true,
          goals_correct: null,
          points_earned: 10,
        },
      ],
    ]);
    const [col] = assembleBracket(rows, preds);
    const byId = new Map(col.matches.map((m) => [m.id, m.prediction]));
    expect(byId.get(10)?.result_correct).toBe(true);
    expect(byId.get(11)).toBeNull();
  });

  it("el tercer puesto va al final, después de la final", () => {
    const rows = [
      knockoutRow({ id: 103, phase: "third_place", external_ref: "103" }),
      knockoutRow({ id: 104, phase: "final", external_ref: "104" }),
    ];
    const cols = assembleBracket(rows, noPreds);
    expect(cols.map((c) => c.phase)).toEqual(["final", "third_place"]);
  });

  it("sin filas → sin columnas", () => {
    expect(assembleBracket([], noPreds)).toEqual([]);
  });
});
