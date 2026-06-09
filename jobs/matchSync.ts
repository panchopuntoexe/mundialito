/**
 * Cron — Match Sync (tarea 5.4, ARCHITECTURE §4.2).
 *
 * Cada minuto: si hay partidos en la ventana activa (en vivo o por arrancar),
 * trae los live scores de API-Football, actualiza la DB y la caché. Si no hay
 * nada activo, NO pega a la API (ahorra cuota — ARCHITECTURE §6).
 *
 * Reglas de arquitectura 1 y 2: solo este job (server-side) llama a API-Football;
 * escribe el score en vivo en Redis (`match:live:{id}`, TTL 60s) e invalida el
 * snapshot de fixtures del día para que `/api/matches` refleje los nuevos scores.
 *
 * La lógica de decisión y el join viven puras en `lib/matches/sync.ts` (testeadas);
 * acá solo el cableado con env, Supabase y Redis.
 */
import { fetchLiveFixtures } from "@/lib/external/apiFootball";
import {
  buildSyncUpdates,
  isInSyncWindow,
  LIVE_SCORE_TTL_SECONDS,
  type SyncCandidate,
} from "@/lib/matches/sync";
import { serverEnv } from "@/lib/env";
import { del, redis } from "@/lib/redis/client";
import { toTournamentDay } from "@/lib/scoring/streaks";
import { createAdminClient } from "@/lib/supabase/server";

export interface MatchSyncSummary {
  /** true si no había partidos activos y se evitó pegarle a la API. */
  skipped: boolean;
  /** Filas en la ventana activa consideradas. */
  candidates: number;
  /** Filas efectivamente actualizadas. */
  updated: number;
}

/** Partidos candidatos a sync: en ventana de tiempo y no terminados/cancelados. */
async function loadCandidates(
  admin: ReturnType<typeof createAdminClient>,
  now: Date,
): Promise<SyncCandidate[]> {
  // El filtro fino lo hace `isInSyncWindow`; en la DB acotamos por status y un
  // rango de kickoff amplio para no traer los 104 partidos del torneo.
  const lowerBound = new Date(now.getTime() - 4 * 60 * 60_000).toISOString();
  const upperBound = new Date(now.getTime() + 5 * 60_000).toISOString();

  const { data, error } = await admin
    .from("matches")
    .select("id, api_football_id, kickoff_at, status")
    .in("status", ["live", "scheduled"])
    .gte("kickoff_at", lowerBound)
    .lte("kickoff_at", upperBound);

  if (error) {
    throw new Error(`[matchSync] error leyendo candidatos: ${error.message}`);
  }
  return (data ?? []).filter((m) => isInSyncWindow(m, now));
}

export async function runMatchSync(now: Date = new Date()): Promise<MatchSyncSummary> {
  const admin = createAdminClient();
  const candidates = await loadCandidates(admin, now);

  if (candidates.length === 0) {
    console.info("[matchSync] sin partidos activos; se omite la llamada a API-Football.");
    return { skipped: true, candidates: 0, updated: 0 };
  }

  const liveScores = await fetchLiveFixtures({ apiKey: serverEnv.API_FOOTBALL_KEY });
  const updates = buildSyncUpdates(candidates, liveScores);
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  let updated = 0;
  const daysToInvalidate = new Set<string>();

  for (const u of updates) {
    const { error } = await admin
      .from("matches")
      .update({
        status: u.status,
        score_home: u.score_home,
        score_away: u.score_away,
        winner_team: u.winner_team,
      })
      .eq("id", u.id);
    if (error) {
      console.error(`[matchSync] error actualizando match ${u.id}:`, error);
      continue;
    }
    updated += 1;

    // Score en vivo cacheado (ARCHITECTURE §5). Un partido que pasó a 'finished'
    // lo levanta el cron de resultados (5.5), que poletea finished+unprocessed.
    await redis.set(
      `match:live:${u.id}`,
      {
        status: u.status,
        score_home: u.score_home,
        score_away: u.score_away,
        winner_team: u.winner_team,
      },
      { ex: LIVE_SCORE_TTL_SECONDS },
    );

    const candidate = candidateById.get(u.id);
    if (candidate) daysToInvalidate.add(toTournamentDay(new Date(candidate.kickoff_at)));
  }

  // Invalida el snapshot del día para que /api/matches sirva los scores frescos.
  await del(...[...daysToInvalidate].map((d) => `fixtures:${d}`));

  console.info(
    `[matchSync] ${updated}/${candidates.length} partidos actualizados desde ${liveScores.length} live scores.`,
  );
  return { skipped: false, candidates: candidates.length, updated };
}
