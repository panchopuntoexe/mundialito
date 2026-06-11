import { describe, expect, it } from "vitest";
import type { LiveScore } from "@/lib/external/apiFootball";
import {
  buildBackfillPlan,
  matchRowsToFixtures,
  type BackfillRow,
} from "@/lib/matches/backfill";

function row(overrides: Partial<BackfillRow> & { id: number }): BackfillRow {
  return {
    api_football_id: null,
    home_team: "Mexico",
    away_team: "South Africa",
    kickoff_at: "2026-06-11T19:00:00.000Z",
    status: "scheduled",
    score_home: null,
    score_away: null,
    winner_team: null,
    ...overrides,
  };
}

function fixture(overrides: Partial<LiveScore> & { api_football_id: number }): LiveScore {
  return {
    status: "finished",
    score_home: 2,
    score_away: 0,
    winner_team: null,
    kickoff_at: "2026-06-11T19:00:00.000Z",
    home_name: "Mexico",
    away_name: "South Africa",
    ...overrides,
  };
}

describe("matchRowsToFixtures", () => {
  it("kickoff único: matchea sin mirar nombres (cubre knockout con labels TBD)", () => {
    const rows = [row({ id: 1, home_team: "Por definir", away_team: "Por definir" })];
    const fixtures = [fixture({ api_football_id: 900, home_name: "Winner 73", away_name: "Winner 74" })];

    const { pairs, warnings } = matchRowsToFixtures(rows, fixtures);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].fixture.api_football_id).toBe(900);
    expect(warnings).toHaveLength(0);
  });

  it("kickoffs simultáneos: desambigua por nombres, con alias de federación", () => {
    // 3.ª fecha de grupos: dos partidos al mismo instante. API-Football dice
    // "Korea Republic"; nuestra fila (worldcup26.ir) dice "South Korea".
    const rows = [
      row({ id: 1, home_team: "South Korea", away_team: "Portugal" }),
      row({ id: 2, home_team: "Uruguay", away_team: "Ghana" }),
    ];
    const fixtures = [
      fixture({ api_football_id: 11, home_name: "Uruguay", away_name: "Ghana" }),
      fixture({ api_football_id: 10, home_name: "Korea Republic", away_name: "Portugal" }),
    ];

    const { pairs, unmatchedRows } = matchRowsToFixtures(rows, fixtures);
    const byRow = new Map(pairs.map((p) => [p.row.id, p.fixture.api_football_id]));
    expect(byRow.get(1)).toBe(10);
    expect(byRow.get(2)).toBe(11);
    expect(unmatchedRows).toHaveLength(0);
  });

  it("simultáneos y ambiguos: no adivina — deja sin par y avisa", () => {
    const rows = [row({ id: 1, home_team: "Por definir", away_team: "Por definir" })];
    const fixtures = [
      fixture({ api_football_id: 10, home_name: "TBD", away_name: "TBD" }),
      fixture({ api_football_id: 11, home_name: "TBD", away_name: "TBD" }),
    ];

    const { pairs, unmatchedRows, warnings } = matchRowsToFixtures(rows, fixtures);
    expect(pairs).toHaveLength(0);
    expect(unmatchedRows).toHaveLength(1);
    expect(warnings.some((w) => w.includes("ambiguos"))).toBe(true);
  });

  it("fila ya mapeada: par directo por api_football_id", () => {
    const rows = [row({ id: 1, api_football_id: 77, kickoff_at: "2026-07-01T00:00:00.000Z" })];
    const fixtures = [fixture({ api_football_id: 77 })];

    const { pairs } = matchRowsToFixtures(rows, fixtures);
    expect(pairs).toHaveLength(1);
  });

  it("fila sin fixture en su kickoff ni rescate por nombres: warning", () => {
    const rows = [row({ id: 1, kickoff_at: "2026-06-20T19:00:00.000Z" })];
    const fixtures = [
      fixture({ api_football_id: 10, home_name: "Germany", away_name: "Ivory Coast" }),
    ];

    const { pairs, unmatchedRows, unmatchedFixtures, warnings } = matchRowsToFixtures(rows, fixtures);
    expect(pairs).toHaveLength(0);
    expect(unmatchedRows).toHaveLength(1);
    expect(unmatchedFixtures).toHaveLength(1);
    expect(warnings.some((w) => w.includes("ningún fixture"))).toBe(true);
  });

  it("rescate: kickoffs discrepantes pero par de nombres único → matchea", () => {
    // Caso real Brazil–Haiti: worldcup26.ir 01:00Z, API-Football 00:30Z.
    const rows = [
      row({ id: 29, home_team: "Brazil", away_team: "Haiti", kickoff_at: "2026-06-20T01:00:00.000Z" }),
    ];
    const fixtures = [
      fixture({
        api_football_id: 1489389,
        home_name: "Brazil",
        away_name: "Haiti",
        kickoff_at: "2026-06-20T00:30:00.000Z",
      }),
    ];

    const { pairs, unmatchedRows, warnings } = matchRowsToFixtures(rows, fixtures);
    expect(pairs).toHaveLength(1);
    expect(unmatchedRows).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("rescate: drift de kickoff mayor a 24h no matchea y avisa", () => {
    const rows = [
      row({ id: 1, home_team: "Brazil", away_team: "Haiti", kickoff_at: "2026-06-25T01:00:00.000Z" }),
    ];
    const fixtures = [
      fixture({
        api_football_id: 10,
        home_name: "Brazil",
        away_name: "Haiti",
        kickoff_at: "2026-06-20T00:30:00.000Z",
      }),
    ];

    const { pairs, unmatchedRows, warnings } = matchRowsToFixtures(rows, fixtures);
    expect(pairs).toHaveLength(0);
    expect(unmatchedRows).toHaveLength(1);
    expect(warnings.some((w) => w.includes("difiere demasiado"))).toBe(true);
  });
});

describe("buildBackfillPlan", () => {
  it("fila sin mapear + partido terminado durante la caída: repone id y resultado", () => {
    const plan = buildBackfillPlan([row({ id: 1 })], [fixture({ api_football_id: 900 })]);

    expect(plan.updates).toEqual([
      {
        id: 1,
        kickoff_at: "2026-06-11T19:00:00.000Z",
        fields: {
          api_football_id: 900,
          status: "finished",
          score_home: 2,
          score_away: 0,
          winner_team: null,
        },
      },
    ]);
  });

  it("fixture aún no empezado: solo mapea el id, sin tocar el resultado", () => {
    const plan = buildBackfillPlan(
      [row({ id: 1 })],
      [fixture({ api_football_id: 900, status: "scheduled", score_home: null, score_away: null })],
    );

    expect(plan.updates).toEqual([
      { id: 1, kickoff_at: "2026-06-11T19:00:00.000Z", fields: { api_football_id: 900 } },
    ]);
  });

  it("fila terminal: nunca pisa el resultado (los puntos ya pudieron procesarse)", () => {
    const plan = buildBackfillPlan(
      [row({ id: 1, api_football_id: 900, status: "finished", score_home: 1, score_away: 1 })],
      [fixture({ api_football_id: 900, score_home: 5, score_away: 5 })],
    );
    expect(plan.updates).toHaveLength(0);
  });

  it("idempotente: DB ya backfilleada → cero updates", () => {
    const plan = buildBackfillPlan(
      [row({ id: 1, api_football_id: 900, status: "finished", score_home: 2, score_away: 0 })],
      [fixture({ api_football_id: 900 })],
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.matched).toBe(1);
  });

  it("conflicto de api_football_id: avisa y no pisa", () => {
    const plan = buildBackfillPlan(
      [row({ id: 1, api_football_id: 111, status: "finished", score_home: 2, score_away: 0 })],
      [fixture({ api_football_id: 900 })],
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.warnings.some((w) => w.includes("difiere"))).toBe(true);
  });

  it("kickoff discrepante en fila no terminal: corrige con el de API-Football", () => {
    const plan = buildBackfillPlan(
      [row({ id: 29, home_team: "Brazil", away_team: "Haiti", kickoff_at: "2026-06-20T01:00:00.000Z" })],
      [
        fixture({
          api_football_id: 1489389,
          status: "scheduled",
          score_home: null,
          score_away: null,
          home_name: "Brazil",
          away_name: "Haiti",
          kickoff_at: "2026-06-20T00:30:00.000Z",
        }),
      ],
    );

    expect(plan.updates).toEqual([
      {
        id: 29,
        kickoff_at: "2026-06-20T01:00:00.000Z",
        fields: { api_football_id: 1489389, kickoff_at: "2026-06-20T00:30:00.000Z" },
      },
    ]);
    expect(plan.warnings.some((w) => w.includes("kickoff corregido"))).toBe(true);
  });

  it("kickoff discrepante en fila terminal: no se toca", () => {
    const plan = buildBackfillPlan(
      [
        row({
          id: 1,
          api_football_id: 900,
          status: "finished",
          score_home: 2,
          score_away: 0,
          kickoff_at: "2026-06-11T19:30:00.000Z",
        }),
      ],
      [fixture({ api_football_id: 900 })],
    );
    expect(plan.updates).toHaveLength(0);
  });
});
