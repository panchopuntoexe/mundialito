import { describe, expect, it, vi } from "vitest";
import {
  fetchSeasonFixtures,
  mapFixture,
  mapStatus,
  parseFixturesResponse,
  WORLD_CUP_LEAGUE_ID,
  WORLD_CUP_SEASON,
} from "@/lib/external/apiFootball";

describe("mapStatus", () => {
  it("agrupa cada short de API-Football en nuestro enum", () => {
    expect(mapStatus("NS")).toBe("scheduled");
    expect(mapStatus("PST")).toBe("scheduled");
    expect(mapStatus("1H")).toBe("live");
    expect(mapStatus("ET")).toBe("live");
    expect(mapStatus("P")).toBe("live");
    expect(mapStatus("FT")).toBe("finished");
    expect(mapStatus("AET")).toBe("finished");
    expect(mapStatus("PEN")).toBe("finished");
    expect(mapStatus("CANC")).toBe("cancelled");
    expect(mapStatus("WO")).toBe("cancelled");
  });

  it("desconocido → scheduled con warning, sin romper", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(mapStatus("ZZZ")).toBe("scheduled");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("mapFixture", () => {
  const base = {
    fixture: { id: 555, date: "2026-06-11T20:00:00+00:00", status: { short: "FT" } },
    goals: { home: 1, away: 1 },
  };

  it("knockout empatado: el resultado sale de teams.winner, no del marcador", () => {
    // 1-1 que se define por penales; avanza el local.
    const ls = mapFixture({
      ...base,
      teams: { home: { name: "A", winner: true }, away: { name: "B", winner: false } },
    });
    expect(ls).toEqual({
      api_football_id: 555,
      status: "finished",
      score_home: 1,
      score_away: 1,
      winner_team: "home",
      kickoff_at: "2026-06-11T20:00:00.000Z",
      home_name: "A",
      away_name: "B",
    });
  });

  it("grupos / sin ganador definido → winner_team null", () => {
    const ls = mapFixture({
      ...base,
      teams: { home: { name: "A", winner: null }, away: { name: "B", winner: null } },
    });
    expect(ls.winner_team).toBeNull();
  });

  it("partido no empezado: goals null se propagan", () => {
    const ls = mapFixture({
      fixture: { id: 7, date: "2026-06-12T18:00:00+00:00", status: { short: "NS" } },
      goals: { home: null, away: null },
      teams: { home: { name: "A" }, away: { name: "B" } },
    });
    expect(ls.status).toBe("scheduled");
    expect(ls.score_home).toBeNull();
    expect(ls.winner_team).toBeNull();
  });
});

describe("parseFixturesResponse", () => {
  it("mapea response[] y ignora campos extra", () => {
    const raw = {
      get: "fixtures",
      results: 1,
      errors: [],
      response: [
        {
          fixture: { id: 9, date: "2026-06-11T20:00:00+00:00", status: { short: "2H" }, timezone: "UTC" },
          league: { id: 1, season: 2026 },
          teams: { home: { name: "A", winner: null }, away: { name: "B", winner: null } },
          goals: { home: 2, away: 0 },
          score: { penalty: { home: null, away: null } },
        },
      ],
    };
    const out = parseFixturesResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("live");
    expect(out[0].score_home).toBe(2);
  });

  it("lanza si API-Football reporta errores", () => {
    const raw = { errors: { token: "invalid api key" }, response: [] };
    expect(() => parseFixturesResponse(raw)).toThrow(/reportó errores/);
  });
});

describe("fetchSeasonFixtures", () => {
  it("pega a /fixtures con league/season y la api key en el header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [], response: [] }),
    } as Response);

    await fetchSeasonFixtures(
      { apiKey: "secret-key", baseUrl: "https://api.test", fetchImpl },
      { date: "2026-06-11" },
    );

    const [calledUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(calledUrl as string);
    expect(url.pathname).toBe("/fixtures");
    expect(url.searchParams.get("league")).toBe(String(WORLD_CUP_LEAGUE_ID));
    expect(url.searchParams.get("season")).toBe(String(WORLD_CUP_SEASON));
    expect(url.searchParams.get("date")).toBe("2026-06-11");
    expect((init as RequestInit).headers).toEqual({ "x-apisports-key": "secret-key" });
  });

  it("lanza si la respuesta HTTP no es ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    } as Response);

    await expect(
      fetchSeasonFixtures({ apiKey: "k", baseUrl: "https://api.test", fetchImpl }),
    ).rejects.toThrow(/429/);
  });
});
