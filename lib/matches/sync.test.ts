import { describe, expect, it } from "vitest";
import type { LiveScore } from "@/lib/external/apiFootball";
import {
  buildSyncUpdates,
  isInSyncWindow,
  SYNC_LOOKAHEAD_MS,
  SYNC_LOOKBEHIND_MS,
} from "@/lib/matches/sync";

const NOW = new Date("2026-06-11T20:00:00.000Z");

describe("isInSyncWindow", () => {
  it("'live' siempre entra, sin importar el kickoff", () => {
    const old = new Date(NOW.getTime() - 10 * 60 * 60_000).toISOString();
    expect(isInSyncWindow({ status: "live", kickoff_at: old }, NOW)).toBe(true);
  });

  it("'scheduled' entra si el kickoff es inminente (dentro del lookahead)", () => {
    const soon = new Date(NOW.getTime() + SYNC_LOOKAHEAD_MS - 1).toISOString();
    expect(isInSyncWindow({ status: "scheduled", kickoff_at: soon }, NOW)).toBe(true);
  });

  it("'scheduled' lejano (fuera del lookahead) no entra", () => {
    const later = new Date(NOW.getTime() + SYNC_LOOKAHEAD_MS + 60_000).toISOString();
    expect(isInSyncWindow({ status: "scheduled", kickoff_at: later }, NOW)).toBe(false);
  });

  it("'scheduled' recién empezado (dentro del lookbehind) sigue entrando", () => {
    const justStarted = new Date(NOW.getTime() - 90 * 60_000).toISOString();
    expect(isInSyncWindow({ status: "scheduled", kickoff_at: justStarted }, NOW)).toBe(
      true,
    );
  });

  it("'scheduled' muy viejo (fuera del lookbehind) no entra", () => {
    const tooOld = new Date(NOW.getTime() - SYNC_LOOKBEHIND_MS - 60_000).toISOString();
    expect(isInSyncWindow({ status: "scheduled", kickoff_at: tooOld }, NOW)).toBe(false);
  });

  it("'finished'/'cancelled' nunca entran", () => {
    const k = NOW.toISOString();
    expect(isInSyncWindow({ status: "finished", kickoff_at: k }, NOW)).toBe(false);
    expect(isInSyncWindow({ status: "cancelled", kickoff_at: k }, NOW)).toBe(false);
  });
});

describe("buildSyncUpdates", () => {
  const live = (over: Partial<LiveScore> & { api_football_id: number }): LiveScore => ({
    status: "live",
    score_home: 1,
    score_away: 0,
    winner_team: null,
    kickoff_at: NOW.toISOString(),
    ...over,
  });

  it("une por api_football_id y devuelve los cambios", () => {
    const rows = [
      { id: 10, api_football_id: 555 },
      { id: 11, api_football_id: 777 },
    ];
    const scores = [live({ api_football_id: 555, status: "finished", score_home: 2, score_away: 1 })];

    expect(buildSyncUpdates(rows, scores)).toEqual([
      { id: 10, status: "finished", score_home: 2, score_away: 1, winner_team: null },
    ]);
  });

  it("propaga winner_team del knockout", () => {
    const rows = [{ id: 20, api_football_id: 9 }];
    const scores = [
      live({ api_football_id: 9, status: "finished", score_home: 1, score_away: 1, winner_team: "away" }),
    ];
    expect(buildSyncUpdates(rows, scores)[0].winner_team).toBe("away");
  });

  it("omite filas sin api_football_id (aún no mapeadas)", () => {
    const rows = [{ id: 30, api_football_id: null }];
    const scores = [live({ api_football_id: 9 })];
    expect(buildSyncUpdates(rows, scores)).toEqual([]);
  });

  it("omite filas sin live score correspondiente (no pisa con datos vacíos)", () => {
    const rows = [{ id: 40, api_football_id: 123 }];
    expect(buildSyncUpdates(rows, [])).toEqual([]);
  });
});
