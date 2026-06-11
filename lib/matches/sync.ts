/**
 * Match Sync — lógica pura (tarea 5.4, ARCHITECTURE §4.2).
 *
 * El cron (jobs/matchSync.ts) decide PRIMERO si hay algo que sincronizar para no
 * quemar cuota de API-Football: solo pega a la API si hay partidos en la ventana
 * activa (en vivo o por arrancar). Acá vive esa decisión (`isInSyncWindow`) y el
 * join puro de los live scores a nuestras filas (`buildSyncUpdates`).
 *
 * El join es por `api_football_id` (ADR 0002): es la columna de lookup contra
 * API-Football. Las filas sin `api_football_id` aún no están mapeadas y se omiten;
 * el mapeo lo puebla `scripts/backfill-api-football.ts` (matchea el fixture de la
 * temporada por kickoff + nombres de equipo y, de paso, repone resultados que el
 * sync se haya perdido — p. ej. partidos terminados durante una caída).
 *
 * Sin imports de env/red/DB para que sea testeable sin Redis ni Supabase.
 */
import type { LiveScore } from "@/lib/external/apiFootball";
import type { MatchStatus, WinnerTeam } from "@/types/domain";

/** TTL del score en vivo en Redis (`match:live:{id}`), ARCHITECTURE §5. */
export const LIVE_SCORE_TTL_SECONDS = 60;

/** Cuánto antes del kickoff un partido entra en la ventana de sync (5 min). */
export const SYNC_LOOKAHEAD_MS = 5 * 60_000;

/**
 * Margen hacia atrás para seguir sincronizando un partido ya empezado pero que en
 * la DB sigue 'scheduled' (un partido dura ~2h; 4h da holgura ante demoras/alargue).
 */
export const SYNC_LOOKBEHIND_MS = 4 * 60 * 60_000;

/** Fila mínima de `matches` que el cron evalúa/actualiza. */
export interface SyncCandidate {
  id: number;
  api_football_id: number | null;
  kickoff_at: string;
  status: MatchStatus;
}

/**
 * ¿El partido está en la ventana activa de sync? 'live' siempre; 'scheduled' solo
 * si su kickoff cae en `[now - LOOKBEHIND, now + LOOKAHEAD]`. 'finished'/'cancelled'
 * nunca (ya no cambian). Define si vale la pena pegarle a la API.
 */
export function isInSyncWindow(
  match: { status: MatchStatus; kickoff_at: string },
  now: Date,
): boolean {
  if (match.status === "live") return true;
  if (match.status !== "scheduled") return false;

  const kickoff = new Date(match.kickoff_at).getTime();
  const t = now.getTime();
  return kickoff <= t + SYNC_LOOKAHEAD_MS && kickoff >= t - SYNC_LOOKBEHIND_MS;
}

/** Cambios a aplicar a una fila de `matches` desde su live score. */
export interface SyncUpdate {
  id: number;
  status: MatchStatus;
  /** Marcador reg + alargue, PRE-tanda. null si aún no empezó. */
  score_home: number | null;
  score_away: number | null;
  /** Equipo que avanza (knockout); null en grupos o sin definir. */
  winner_team: WinnerTeam;
}

/**
 * Une nuestras filas a los live scores por `api_football_id` y devuelve los
 * cambios a persistir. Omite filas sin mapeo (`api_football_id` null) y filas sin
 * live score correspondiente (p. ej. un 'scheduled' que todavía no arrancó: el
 * endpoint live=all no lo devuelve, así que no se pisa con datos vacíos).
 */
export function buildSyncUpdates(
  rows: readonly { id: number; api_football_id: number | null }[],
  liveScores: readonly LiveScore[],
): SyncUpdate[] {
  const byApiId = new Map<number, LiveScore>();
  for (const ls of liveScores) byApiId.set(ls.api_football_id, ls);

  const updates: SyncUpdate[] = [];
  for (const row of rows) {
    if (row.api_football_id === null) continue;
    const ls = byApiId.get(row.api_football_id);
    if (!ls) continue;
    updates.push({
      id: row.id,
      status: ls.status,
      score_home: ls.score_home,
      score_away: ls.score_away,
      winner_team: ls.winner_team,
    });
  }
  return updates;
}
