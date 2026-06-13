/**
 * Cliente de API-Football v3 — live scores del Mundial 2026 (tarea 3.2).
 *
 * Fuente de los marcadores en vivo y el estado de cada partido. Lo consume el
 * cron Match Sync (5.4), que matchea por `api_football_id` (ADR 0002).
 *
 * Reglas de arquitectura 1 y 2: el frontend NUNCA llama acá; solo jobs
 * server-side. La lógica de mapeo (`mapStatus`, `mapFixture`) es PURA y testeable
 * sin red ni env; `fetchSeasonFixtures`/`fetchLiveFixtures` reciben la config
 * (apiKey, baseUrl, fetch) inyectada — el cron la arma desde `serverEnv`.
 *
 * Marcador: API-Football `goals` ya es reglamentario + alargue SIN la tanda de
 * penales (la tanda vive en `score.penalty`), que es justo lo que guardamos en
 * `score_home`/`score_away` (CONTEXT.md "Goles totales"). El equipo que avanza
 * sale del flag `teams.{home,away}.winner`.
 */
import { z } from "zod";
import type { MatchStatus, WinnerTeam } from "@/types/domain";

/** League id del Mundial en API-Football. */
export const WORLD_CUP_LEAGUE_ID = 1;
/** Temporada del Mundial 2026. */
export const WORLD_CUP_SEASON = 2026;

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

export interface ApiFootballConfig {
  /** `API_FOOTBALL_KEY` (server-only). */
  apiKey: string;
  /** Override del host (default API-Sports directo). */
  baseUrl?: string;
  /** Inyectable en tests. */
  fetchImpl?: typeof fetch;
}

/** Marcador/estado de un partido, normalizado a nuestro dominio. */
export interface LiveScore {
  /** Lookup contra `matches.api_football_id`. */
  api_football_id: number;
  status: MatchStatus;
  /** Marcador reg + alargue, PRE-tanda. null si no empezó. */
  score_home: number | null;
  score_away: number | null;
  /** Equipo que avanza (knockout); null si aún no hay ganador definido. */
  winner_team: WinnerTeam;
  /** Kickoff en ISO 8601 UTC. */
  kickoff_at: string;
  /** Nombres según API-Football — para matchear filas aún sin `api_football_id`. */
  home_name: string;
  away_name: string;
}

// ── Shape (parcial) de la respuesta de API-Football v3 ─────────────
// Solo declaramos lo que usamos; el resto se ignora.
const teamSchema = z.object({
  name: z.string(),
  winner: z.boolean().nullable().optional(),
});

const fixtureItemSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    status: z.object({ short: z.string() }),
  }),
  teams: z.object({ home: teamSchema, away: teamSchema }),
  goals: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
  }),
});

const responseSchema = z.object({
  // API-Football: `[]` cuando ok; objeto/array con detalles cuando hay error.
  errors: z.unknown().optional(),
  response: z.array(fixtureItemSchema),
});

/**
 * Mapea el `status.short` de API-Football a nuestro enum `match_status`.
 * Desconocido → 'scheduled' con warning (no rompe un batch de 60s por un código
 * nuevo, pero tampoco lo traga en silencio — CLAUDE.md).
 */
export function mapStatus(short: string): MatchStatus {
  switch (short) {
    case "NS":
    case "TBD":
    case "PST": // postergado: sigue pendiente de jugarse
      return "scheduled";
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P": // tanda de penales en curso
    case "SUSP":
    case "INT":
    case "LIVE":
      return "live";
    case "FT":
    case "AET":
    case "PEN":
      return "finished";
    case "CANC":
    case "ABD":
    case "AWD":
    case "WO":
      return "cancelled";
    default:
      console.warn(`[apiFootball] status.short desconocido: "${short}" → scheduled`);
      return "scheduled";
  }
}

type FixtureItem = z.infer<typeof fixtureItemSchema>;

/** Mapea un fixture crudo de API-Football a nuestro `LiveScore`. Puro. */
export function mapFixture(item: FixtureItem): LiveScore {
  const winnerTeam: WinnerTeam = item.teams.home.winner
    ? "home"
    : item.teams.away.winner
      ? "away"
      : null;

  return {
    api_football_id: item.fixture.id,
    status: mapStatus(item.fixture.status.short),
    score_home: item.goals.home,
    score_away: item.goals.away,
    winner_team: winnerTeam,
    kickoff_at: new Date(item.fixture.date).toISOString(),
    home_name: item.teams.home.name,
    away_name: item.teams.away.name,
  };
}

/**
 * Valida la respuesta cruda y la mapea a `LiveScore[]`. Lanza si API-Football
 * reporta errores o el shape no coincide.
 */
export function parseFixturesResponse(raw: unknown): LiveScore[] {
  const data = responseSchema.parse(raw);

  // `errors` es `[]` (ok) o un contenedor no vacío (error de la API).
  const { errors } = data;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors != null && typeof errors === "object" && Object.keys(errors).length > 0;
  if (hasErrors) {
    throw new Error(`API-Football reportó errores: ${JSON.stringify(errors)}`);
  }

  return data.response.map(mapFixture);
}

async function getFixtures(
  config: ApiFootballConfig,
  params: Record<string, string | number>,
): Promise<LiveScore[]> {
  const { apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch } = config;
  const url = new URL("/fixtures", baseUrl);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetchImpl(url.toString(), {
    headers: { "x-apisports-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(
      `API-Football respondió ${res.status} ${res.statusText} (${url.pathname}${url.search})`,
    );
  }
  const json: unknown = await res.json();
  return parseFixturesResponse(json);
}

/**
 * Fixtures del Mundial para la temporada (opcionalmente filtrados por día).
 * `GET /fixtures?league=1&season=2026[&date=YYYY-MM-DD]`.
 */
export function fetchSeasonFixtures(
  config: ApiFootballConfig,
  opts: { date?: string } = {},
): Promise<LiveScore[]> {
  const params: Record<string, string | number> = {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  };
  if (opts.date) params.date = opts.date;
  return getFixtures(config, params);
}

/**
 * Partidos del Mundial en vivo ahora mismo.
 * `GET /fixtures?league=1&season=2026&live=all`.
 */
export function fetchLiveFixtures(
  config: ApiFootballConfig,
): Promise<LiveScore[]> {
  return getFixtures(config, {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
    live: "all",
  });
}

/** Tope de ids por request de `/fixtures?ids=` (límite de API-Football v3). */
export const MAX_FIXTURE_IDS_PER_REQUEST = 20;

/**
 * Fixtures puntuales por id, en CUALQUIER estado (incluido FT/finished).
 * `GET /fixtures?ids=1-2-3`.
 *
 * Resuelve el hueco de `fetchLiveFixtures`: `live=all` deja de devolver un
 * partido apenas termina, así que el sync (5.4) nunca veía la transición
 * live→finished y el partido quedaba atascado en 'live' (sólo el backfill manual
 * lo rescataba). Acá pedimos el estado FINAL de esos ids concretos. Trocea en
 * lotes de 20 (límite de la API) y concatena.
 */
export async function fetchFixturesByIds(
  config: ApiFootballConfig,
  ids: readonly number[],
): Promise<LiveScore[]> {
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id));
  const out: LiveScore[] = [];
  for (let i = 0; i < unique.length; i += MAX_FIXTURE_IDS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_FIXTURE_IDS_PER_REQUEST);
    out.push(...(await getFixtures(config, { ids: chunk.join("-") })));
  }
  return out;
}
