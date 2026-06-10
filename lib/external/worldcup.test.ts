import { describe, expect, it, vi } from "vitest";
import {
  deriveStage,
  fetchFixture,
  parseFixture,
  parseLocalDate,
  type ParsedFixtureMatch,
} from "@/lib/external/worldcup";

describe("deriveStage", () => {
  it("grupos: letra en el campo group separado (type='group')", () => {
    expect(deriveStage("group", "B")).toEqual({
      phase: "group_b",
      macroRound: "group_stage",
    });
  });

  it("grupos: letra embebida en la etiqueta ('Group A')", () => {
    expect(deriveStage("Group A")).toEqual({
      phase: "group_a",
      macroRound: "group_stage",
    });
  });

  it("grupos: acepta hasta el grupo L (48 equipos / 12 grupos)", () => {
    expect(deriveStage("group", "L").phase).toBe("group_l");
  });

  it("knockout: mapea los códigos del proveedor (r32/r16/qf/sf/third/final)", () => {
    expect(deriveStage("r32")).toEqual({ phase: "round_32", macroRound: "round_32" });
    expect(deriveStage("r16")).toEqual({ phase: "round_16", macroRound: "round_16" });
    expect(deriveStage("qf")).toEqual({ phase: "quarter", macroRound: "quarter" });
    expect(deriveStage("sf")).toEqual({ phase: "semi", macroRound: "semi" });
    expect(deriveStage("final")).toEqual({ phase: "final", macroRound: "final" });
  });

  it("tercer puesto ('third') cae en la macro-ronda 'final'", () => {
    expect(deriveStage("third")).toEqual({ phase: "third_place", macroRound: "final" });
  });

  it("lanza si la fase es desconocida", () => {
    expect(() => deriveStage("group", "Z")).toThrow(/grupo sin letra/);
    expect(() => deriveStage("repechage")).toThrow(/fase desconocida/);
  });
});

describe("parseLocalDate", () => {
  it("convierte hora local del estadio a UTC según su zona horaria", () => {
    // Estadio Azteca (id 1, México UTC-6, sin DST): 13:00 → 19:00Z.
    expect(parseLocalDate("06/11/2026 13:00", "1")).toBe("2026-06-11T19:00:00.000Z");
    // MetLife (id 11, ET, julio = EDT UTC-4): 15:00 → 19:00Z.
    expect(parseLocalDate("07/19/2026 15:00", "11")).toBe("2026-07-19T19:00:00.000Z");
    // SoFi (id 16, PT, junio = PDT UTC-7): 12:00 → 19:00Z.
    expect(parseLocalDate("06/13/2026 12:00", "16")).toBe("2026-06-13T19:00:00.000Z");
  });

  it("lanza si el estadio no tiene zona horaria conocida", () => {
    expect(() => parseLocalDate("06/11/2026 13:00", "99")).toThrow(/zona horaria/);
  });

  it("lanza si el formato de fecha es inesperado", () => {
    expect(() => parseLocalDate("2026-06-11T13:00:00Z", "1")).toThrow(/formato inesperado/);
  });
});

describe("parseFixture", () => {
  const games = {
    games: [
      {
        id: "1",
        type: "group",
        group: "A",
        local_date: "06/11/2026 13:00",
        stadium_id: "1",
        home_team_id: "1",
        away_team_id: "2",
        home_team_name_en: "Mexico",
        away_team_name_en: "South Africa",
      },
      {
        id: "104",
        type: "final",
        group: "FINAL",
        local_date: "07/19/2026 15:00",
        stadium_id: "11",
        home_team_id: "0",
        away_team_id: "0",
        home_team_label: "Winner Match 101",
        away_team_label: "Winner Match 102",
      },
    ],
  };
  const teams = {
    teams: [
      { id: "1", flag: "https://flagcdn.com/w80/mx.png" },
      { id: "2", flag: "https://flagcdn.com/w80/za.png" },
    ],
  };

  it("une games + teams: nombres, banderas por id y kickoff en UTC", () => {
    const parsed = parseFixture(games, teams);
    expect(parsed).toHaveLength(2);

    expect(parsed[0]).toEqual<ParsedFixtureMatch>({
      external_ref: "1",
      home_team: "Mexico",
      away_team: "South Africa",
      home_flag: "https://flagcdn.com/w80/mx.png",
      away_flag: "https://flagcdn.com/w80/za.png",
      phase: "group_a",
      macro_round: "group_stage",
      kickoff_at: "2026-06-11T19:00:00.000Z",
    });
  });

  it("knockout: usa el label como nombre y deja las banderas en null (team_id '0')", () => {
    const parsed = parseFixture(games, teams);
    expect(parsed[1]).toMatchObject({
      external_ref: "104",
      home_team: "Winner Match 101",
      away_team: "Winner Match 102",
      home_flag: null,
      away_flag: null,
      phase: "final",
      macro_round: "final",
      kickoff_at: "2026-07-19T19:00:00.000Z",
    });
  });

  it("sin teams: banderas en null pero el resto se parsea igual", () => {
    const parsed = parseFixture(games);
    expect(parsed[0].home_flag).toBeNull();
    expect(parsed[0].home_team).toBe("Mexico");
  });

  it("lanza (ZodError) si falta un campo requerido", () => {
    const bad = { games: [{ id: "1", group: "A", local_date: "06/11/2026 13:00", stadium_id: "1" }] };
    expect(() => parseFixture(bad)).toThrow();
  });
});

describe("fetchFixture", () => {
  it("pide games + teams (deriva la URL de teams) y devuelve el fixture parseado", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const body = String(url).includes("/teams")
        ? { teams: [{ id: "5", flag: "https://flagcdn.com/w80/ca.png" }] }
        : {
            games: [
              {
                id: "3",
                type: "group",
                group: "B",
                local_date: "06/12/2026 15:00",
                stadium_id: "12",
                home_team_id: "5",
                away_team_id: "6",
                home_team_name_en: "Canada",
                away_team_name_en: "Bosnia and Herzegovina",
              },
            ],
          };
      return { ok: true, json: async () => body } as Response;
    });

    const result = await fetchFixture("https://worldcup26.ir/get/games", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("https://worldcup26.ir/get/games", {
      headers: { accept: "application/json" },
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://worldcup26.ir/get/teams", {
      headers: { accept: "application/json" },
    });
    expect(result[0].phase).toBe("group_b");
    expect(result[0].home_flag).toBe("https://flagcdn.com/w80/ca.png");
  });

  it("lanza si la respuesta HTTP no es ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    await expect(
      fetchFixture("https://worldcup26.ir/get/games", fetchImpl),
    ).rejects.toThrow(/503/);
  });
});
