/**
 * Ranking de leaderboards (tareas 6.3 y 6.4).
 *
 * `assignRanks` es lógica PURA y testeable: recibe usuarios YA ordenados por
 * puntos descendente (el ORDER BY lo hace la DB) y les asigna la posición usando
 * "standard competition ranking" (1, 2, 2, 4): empates comparten posición y la
 * siguiente posición salta. El ranking de liga reusa esta misma función sobre el
 * subconjunto de miembros (una liga es un FILTRO sobre el total, no un ledger
 * aparte — CONTEXT.md "Liga").
 */

export interface RankedUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
}

export interface LeaderboardEntry extends RankedUser {
  rank: number;
}

export function assignRanks(users: RankedUser[]): LeaderboardEntry[] {
  let lastPoints: number | null = null;
  let lastRank = 0;

  return users.map((user, index) => {
    // Mismos puntos que el anterior → comparten posición; si no, la posición es
    // la ordinal (índice + 1), que es lo que hace saltar tras un empate.
    const rank = user.total_points === lastPoints ? lastRank : index + 1;
    lastPoints = user.total_points;
    lastRank = rank;
    return { ...user, rank };
  });
}
