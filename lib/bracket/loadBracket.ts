/**
 * Carga del cuadro de eliminación (read-only).
 *
 * Trae los partidos de knockout (cacheados en Redis: cambian poco) y les
 * superpone los pronósticos PROPIOS del usuario (sin cachear: son por-usuario).
 * El armado (`assembleBracket`) es PURO y testeable sin Redis ni Supabase, igual
 * que `lib/matches/sync.ts` / `backfill.ts`.
 *
 * Regla de arquitectura 2: la lista de partidos pasa por la caché; el fetcher lee
 * la DB, nunca la API externa. La invalidación la disparan el sync (5.4) y el
 * backfill al tocar un resultado (clave `BRACKET_CACHE_KEY`).
 */
import type { MatchCardPrediction } from "@/components/MatchCard";
import { assembleBracket } from "@/lib/bracket/assemble";
import { cached } from "@/lib/redis/client";
import { createClient } from "@/lib/supabase/server";
import {
  BRACKET_CACHE_KEY,
  type BracketColumn,
  type KnockoutMatchRow,
} from "@/lib/bracket/types";

/** TTL de la lista de partidos de knockout (1h; se invalida antes si cambia un score). */
const BRACKET_TTL_SECONDS = 3600;

/** Columnas del partido que necesita el cuadro (incluye external_ref para ordenar). */
const KNOCKOUT_COLUMNS =
  "id, external_ref, home_team, away_team, home_flag, away_flag, phase, macro_round, kickoff_at, status, score_home, score_away, winner_team, penalty_home, penalty_away";

/** Lee de la DB todos los partidos de eliminación directa (knockout). */
async function fetchKnockoutMatches(): Promise<KnockoutMatchRow[]> {
  console.info("[bracket] cache miss → leyendo partidos de knockout de la DB");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(KNOCKOUT_COLUMNS)
    .neq("macro_round", "group_stage");

  if (error) {
    console.error("[bracket] error leyendo knockout:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

/** Pronósticos propios para los partidos dados → mapa por match_id (RLS: propios). */
async function loadUserPredictions(
  userId: string,
  matchIds: readonly number[],
): Promise<Map<number, MatchCardPrediction>> {
  const map = new Map<number, MatchCardPrediction>();
  if (matchIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("predictions")
    .select(
      "match_id, result_pred, home_goals_pred, away_goals_pred, result_correct, goals_correct, points_earned",
    )
    .eq("user_id", userId)
    .in("match_id", matchIds as number[]);

  for (const p of data ?? []) {
    map.set(p.match_id, {
      result_pred: p.result_pred,
      home_goals_pred: p.home_goals_pred,
      away_goals_pred: p.away_goals_pred,
      result_correct: p.result_correct,
      goals_correct: p.goals_correct,
      points_earned: p.points_earned,
    });
  }
  return map;
}

/**
 * Carga el cuadro listo para renderizar: partidos de knockout (cacheados) con los
 * pronósticos propios superpuestos. `userId` null (invitado sin sesión) → cuadro
 * sin marcas de pronóstico.
 */
export async function loadBracket(userId: string | null): Promise<BracketColumn[]> {
  const rows = await cached(BRACKET_CACHE_KEY, BRACKET_TTL_SECONDS, fetchKnockoutMatches);
  const preds =
    userId !== null
      ? await loadUserPredictions(
          userId,
          rows.map((r) => r.id),
        )
      : new Map<number, MatchCardPrediction>();
  return assembleBracket(rows, preds);
}
