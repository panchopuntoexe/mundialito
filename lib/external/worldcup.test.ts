import { describe, expect, it, vi } from "vitest";
import {
  deriveStage,
  fetchFixture,
  parseFixture,
  type ParsedFixtureMatch,
} from "@/lib/external/worldcup";

describe("deriveStage", () => {
  it("grupos: letra embebida en stage ('Group A')", () => {
    expect(deriveStage("Group A")).toEqual({
      phase: "group_a",
      macroRound: "group_stage",
    });
  });

  it("grupos: letra en el campo group separado", () => {
    expect(deriveStage("group", "B")).toEqual({
      phase: "group_b",
      macroRound: "group_stage",
    });
  });

  it("grupos: acepta hasta el grupo L (48 equipos / 12 grupos)", () => {
    expect(deriveStage("Group L").phase).toBe("group_l");
  });

  it("knockout: mapea cada fase y su macro-ronda", () => {
    expect(deriveStage("Round of 32")).toEqual({
      phase: "round_32",
      macroRound: "round_32",
    });
    expect(deriveStage("Round of 16")).toEqual({
      phase: "round_16",
      macroRound: "round_16",
    });
    expect(deriveStage("Quarter-finals")).toEqual({
      phase: "quarter",
      macroRound: "quarter",
    });
    expect(deriveStage("Semi-finals")).toEqual({
      phase: "semi",
      macroRound: "semi",
    });
    expect(deriveStage("Final")).toEqual({
      phase: "final",
      macroRound: "final",
    });
  });

  it("tercer puesto cae en la macro-ronda 'final'", () => {
    expect(deriveStage("Third place")).toEqual({
      phase: "third_place",
      macroRound: "final",
    });
  });

  it("lanza si la fase es desconocida", () => {
    expect(() => deriveStage("Group of death")).toThrow(/grupo sin letra/);
    expect(() => deriveStage("Repechage")).toThrow(/fase desconocida/);
  });

  it("lanza si un partido de grupo no trae letra válida", () => {
    expect(() => deriveStage("group", "Z")).toThrow(/grupo sin letra/);
    expect(() => deriveStage("group")).toThrow(/grupo sin letra/);
  });
});

describe("parseFixture", () => {
  const raw = {
    matches: [
      {
        id: 101,
        home: { name: "Mexico", flag: "https://flags/mx.png" },
        away: { name: "Canada", flag: "https://flags/ca.png" },
        group: "A",
        stage: "group",
        kickoff: "2026-06-11T20:00:00Z",
      },
      {
        id: "F1",
        home: { name: "Brazil" },
        away: { name: "France" },
        stage: "Final",
        kickoff: "2026-07-19T19:00:00+00:00",
      },
    ],
  };

  it("mapea al shape del seed con phase + macro_round y flags opcionales", () => {
    const parsed = parseFixture(raw);
    expect(parsed).toHaveLength(2);

    expect(parsed[0]).toEqual<ParsedFixtureMatch>({
      external_ref: "101",
      home_team: "Mexico",
      away_team: "Canada",
      home_flag: "https://flags/mx.png",
      away_flag: "https://flags/ca.png",
      phase: "group_a",
      macro_round: "group_stage",
      kickoff_at: "2026-06-11T20:00:00.000Z",
    });

    // Sin bandera → null; id numérico → external_ref string; kickoff normalizado.
    expect(parsed[1].external_ref).toBe("F1");
    expect(parsed[1].home_flag).toBeNull();
    expect(parsed[1].phase).toBe("final");
    expect(parsed[1].kickoff_at).toBe("2026-07-19T19:00:00.000Z");
  });

  it("lanza (ZodError) si falta un campo requerido", () => {
    const bad = { matches: [{ id: 1, home: { name: "X" }, stage: "Final", kickoff: "2026-07-19T19:00:00Z" }] };
    expect(() => parseFixture(bad)).toThrow();
  });

  it("lanza si el kickoff no es una fecha parseable", () => {
    const bad = {
      matches: [
        {
          id: 1,
          home: { name: "X" },
          away: { name: "Y" },
          stage: "Final",
          kickoff: "no-es-fecha",
        },
      ],
    };
    expect(() => parseFixture(bad)).toThrow(/kickoff inválido/);
  });
});

describe("fetchFixture", () => {
  it("GET a la URL y devuelve el fixture parseado", async () => {
    const body = {
      matches: [
        {
          id: 1,
          home: { name: "A" },
          away: { name: "B" },
          group: "C",
          stage: "group",
          kickoff: "2026-06-12T18:00:00Z",
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    } as Response);

    const result = await fetchFixture("https://worldcup26.test/fixtures", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("https://worldcup26.test/fixtures", {
      headers: { accept: "application/json" },
    });
    expect(result[0].phase).toBe("group_c");
  });

  it("lanza si la respuesta HTTP no es ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    await expect(
      fetchFixture("https://worldcup26.test/fixtures", fetchImpl),
    ).rejects.toThrow(/503/);
  });
});
