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
  /** Métrica extra según la vista del ranking (Precisión). Opcional. */
  accuracy?: number;
  /** Métrica extra según la vista del ranking (Racha). Opcional. */
  max_streak?: number;
}

export interface LeaderboardEntry extends RankedUser {
  rank: number;
}

/**
 * "Standard competition ranking" (1, 2, 2, 4) sobre usuarios YA ordenados de mayor
 * a menor por el valor de `getValue`: empates (mismo valor que el anterior)
 * comparten posición y la siguiente salta.
 */
export function assignRanksBy(
  users: RankedUser[],
  getValue: (u: RankedUser) => number,
): LeaderboardEntry[] {
  let lastValue: number | null = null;
  let lastRank = 0;

  return users.map((user, index) => {
    const value = getValue(user);
    const rank = value === lastValue ? lastRank : index + 1;
    lastValue = value;
    lastRank = rank;
    return { ...user, rank };
  });
}

/** Ranking por total de torneo (`total_points`). */
export function assignRanks(users: RankedUser[]): LeaderboardEntry[] {
  return assignRanksBy(users, (u) => u.total_points);
}
