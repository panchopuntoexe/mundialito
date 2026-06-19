import { cache } from "react";
import {
  ACHIEVEMENT_BY_TYPE,
  type AchievementType,
} from "@/lib/scoring/achievements";
import { createAdminClient } from "@/lib/supabase/server";
import type { MatchStatus, ResultPred } from "@/types/domain";

/**
 * Carga del perfil público de un usuario por username. Server-only.
 *
 * Usa el cliente ADMIN: la RLS de `users`/`user_accuracy`/`streaks`/
 * `achievements` solo deja ver la fila propia, y el perfil muestra datos de
 * OTRO usuario. Nunca importar este módulo desde un client component (mismo
 * contrato que lib/leaderboards/load.ts). Sin caché: lectura puntual por
 * username, sin el fan-out de los leaderboards.
 */

export interface PublicProfile {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  /** % de aciertos (0–100); 0 si aún no tiene pronósticos procesados. */
  accuracy: number;
  total_predictions: number;
  /** Racha máxima de participación en días; 0 si nunca arrancó una. */
  max_streak: number;
  earned: AchievementType[];
}

/**
 * El perfil público de `username`, o null si no existe. Envuelto en `cache` de
 * React: `generateMetadata` (OG) y el render de la página comparten una sola
 * lectura por request en lugar de pegarle dos veces a la DB (Bet 3).
 */
export const loadPublicProfile = cache(async function loadPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  const admin = createAdminClient();

  const { data: user, error } = await admin
    .from("users")
    .select("id, username, avatar_url, total_points")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    throw new Error(
      `[profiles] error leyendo usuario ${username}: ${error.message}`,
    );
  }
  if (!user) return null;

  const [accuracyRes, streakRes, achievementsRes] = await Promise.all([
    admin
      .from("user_accuracy")
      .select("accuracy, total_predictions")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("streaks")
      .select("max_streak")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("achievements").select("type").eq("user_id", user.id),
  ]);
  const failed = accuracyRes.error ?? streakRes.error ?? achievementsRes.error;
  if (failed) {
    throw new Error(
      `[profiles] error leyendo stats de ${username}: ${failed.message}`,
    );
  }

  // La columna `type` es text en la DB: filtrar contra las defs valida el cast.
  const earned = (achievementsRes.data ?? [])
    .map((r) => r.type)
    .filter((t): t is AchievementType => t in ACHIEVEMENT_BY_TYPE);

  return {
    user_id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    total_points: user.total_points,
    accuracy: accuracyRes.data?.accuracy ?? 0,
    total_predictions: accuracyRes.data?.total_predictions ?? 0,
    max_streak: streakRes.data?.max_streak ?? 0,
    earned,
  };
});

/** Un pronóstico del usuario junto al resultado real de su partido. */
export interface ProfilePrediction {
  match_id: number;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  phase: string;
  kickoff_at: string;
  status: MatchStatus;
  /** Marcador real (post-alargue, pre-penales); null si aún no hay. */
  score_home: number | null;
  score_away: number | null;
  /** "home" | "away" en knockout con penales; null en grupos. */
  winner_team: string | null;
  /** Pronóstico del usuario. */
  result_pred: ResultPred;
  home_goals_pred: number | null;
  away_goals_pred: number | null;
  result_correct: boolean | null;
  goals_correct: boolean | null;
  points_earned: number | null;
}

/** Cuántos pronósticos mostrar en el perfil público (más recientes primero). */
const PROFILE_PREDICTIONS_LIMIT = 30;

/**
 * Pronósticos de un usuario para partidos que YA arrancaron, junto al resultado
 * real. Server-only, cliente admin (la RLS solo deja leer la fila propia).
 *
 * Solo incluye partidos `live`/`finished`: mostrar el pronóstico de un partido
 * aún abierto filtraría el pick antes del kickoff — justo lo que la RLS de
 * `predictions` evita (otros recién lo ven post-kickoff). Orden por kickoff
 * descendente (lo más reciente arriba), acotado a `PROFILE_PREDICTIONS_LIMIT`.
 */
export async function loadProfilePredictions(
  userId: string,
): Promise<ProfilePrediction[]> {
  const admin = createAdminClient();

  const { data: preds, error: predErr } = await admin
    .from("predictions")
    .select(
      "match_id, result_pred, home_goals_pred, away_goals_pred, result_correct, goals_correct, points_earned",
    )
    .eq("user_id", userId);
  if (predErr) {
    throw new Error(
      `[profiles] error leyendo pronósticos de ${userId}: ${predErr.message}`,
    );
  }
  if (!preds || preds.length === 0) return [];

  const { data: matches, error: matchErr } = await admin
    .from("matches")
    .select(
      "id, home_team, away_team, home_flag, away_flag, phase, kickoff_at, status, score_home, score_away, winner_team",
    )
    .in(
      "id",
      preds.map((p) => p.match_id),
    )
    .in("status", ["live", "finished"])
    .order("kickoff_at", { ascending: false })
    .limit(PROFILE_PREDICTIONS_LIMIT);
  if (matchErr) {
    throw new Error(
      `[profiles] error leyendo partidos de ${userId}: ${matchErr.message}`,
    );
  }
  if (!matches || matches.length === 0) return [];

  const predByMatch = new Map(preds.map((p) => [p.match_id, p]));

  return matches.flatMap((m) => {
    const p = predByMatch.get(m.id);
    if (!p) return [];
    return [
      {
        match_id: m.id,
        home_team: m.home_team,
        away_team: m.away_team,
        home_flag: m.home_flag,
        away_flag: m.away_flag,
        phase: m.phase,
        kickoff_at: m.kickoff_at,
        status: m.status as MatchStatus,
        score_home: m.score_home,
        score_away: m.score_away,
        winner_team: m.winner_team,
        result_pred: p.result_pred as ResultPred,
        home_goals_pred: p.home_goals_pred,
        away_goals_pred: p.away_goals_pred,
        result_correct: p.result_correct,
        goals_correct: p.goals_correct,
        points_earned: p.points_earned,
      },
    ];
  });
}
