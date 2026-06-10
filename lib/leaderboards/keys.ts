/**
 * Claves de caché de leaderboards en Redis (ARCHITECTURE §5).
 *
 * Centralizadas para que el cron que las INVALIDA (tarea 5.6) y los endpoints que
 * las ESCRIBEN/LEEN (Fase 6) usen exactamente la misma clave. El ranking de liga
 * es un filtro sobre `users.total_points`, no un ledger aparte (CONTEXT.md "Liga").
 */

/** Top global (todos los usuarios por `total_points`). TTL 5 min. */
export const GLOBAL_LEADERBOARD_KEY = "leaderboard:global";

/** Ranking por % de aciertos (vista `user_accuracy`). TTL 5 min. */
export const ACCURACY_LEADERBOARD_KEY = "leaderboard:accuracy";

/** Ranking por racha máxima de participación. TTL 5 min. */
export const STREAK_LEADERBOARD_KEY = "leaderboard:streak";

/** Ranking de una liga privada. TTL 5 min. */
export function leagueLeaderboardKey(leagueId: string): string {
  return `leaderboard:league:${leagueId}`;
}
