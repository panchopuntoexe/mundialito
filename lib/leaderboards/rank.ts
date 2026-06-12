/**
 * Posición individual en el ranking global — lógica pura.
 *
 * Para la tarjeta de stats en vivo no hace falta cargar el leaderboard entero:
 * con dos COUNTs indexados alcanza. `rank = 1 + (usuarios con más puntos)`
 * produce exactamente el mismo número que `assignRanks` (standard competition
 * ranking 1, 2, 2, 4: los empatados comparten la cantidad de usuarios por
 * encima). El denominador son los usuarios con puntos (> 0), igual que el
 * leaderboard global; un usuario con 0 puntos queda fuera de ese total, así
 * que se le muestra `#rank de rank` para evitar un "#231 de 230".
 */

export interface LiveRank {
  /** Posición 1-based en el ranking por puntos. */
  rank: number;
  /** Total de participantes contra los que se compara (`de N`). */
  total: number;
}

export function liveRank(params: {
  /** Cantidad de usuarios con `total_points` estrictamente mayor. */
  higherCount: number;
  /** Cantidad de usuarios con `total_points > 0` (el universo del ranking). */
  positiveCount: number;
  /** Puntos del usuario. */
  points: number;
}): LiveRank {
  const rank = params.higherCount + 1;
  return {
    rank,
    total: params.points > 0 ? params.positiveCount : rank,
  };
}
