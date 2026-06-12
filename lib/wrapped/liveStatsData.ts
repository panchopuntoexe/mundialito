import { liveRank } from "@/lib/leaderboards/rank";
import { levelForPoints } from "@/lib/scoring/levels";
import type { LiveStatsCardData } from "./liveStatsCard";

/**
 * Ensamble PURO de la tarjeta de stats en vivo: filas crudas de la DB →
 * `LiveStatsCardData`. Separado del loader (liveStats.ts) para poder testearlo
 * sin arrastrar el cliente de Supabase ni la validación de env (mismo patrón
 * que el resto de la lógica pura de lib/wrapped y lib/scoring).
 */

/** Filas crudas de la DB, separadas para poder testear el ensamble puro. */
export interface LiveStatsRows {
  username: string;
  totalPoints: number;
  /** Fila de la vista `user_accuracy`; null si aún no procesó pronósticos.
   *  Los campos son nullables porque los tipos generados de una VISTA lo son. */
  accuracy: {
    accuracy: number | null;
    total_predictions: number | null;
    correct_predictions: number | null;
  } | null;
  /** `streaks.current_streak`; null si nunca participó. */
  currentStreak: number | null;
  /** Usuarios con `total_points` estrictamente mayor. */
  higherCount: number;
  /** Usuarios con `total_points > 0` (universo del ranking). */
  positiveCount: number;
}

/** Ensamble puro de la data de la tarjeta (defaults 0, nivel derivado). */
export function toLiveStatsCardData(rows: LiveStatsRows): LiveStatsCardData {
  const { rank, total } = liveRank({
    higherCount: rows.higherCount,
    positiveCount: rows.positiveCount,
    points: rows.totalPoints,
  });
  return {
    username: rows.username,
    totalPoints: rows.totalPoints,
    levelKey: levelForPoints(rows.totalPoints).key,
    accuracy: rows.accuracy?.accuracy ?? 0,
    correctPredictions: rows.accuracy?.correct_predictions ?? 0,
    totalPredictions: rows.accuracy?.total_predictions ?? 0,
    currentStreak: rows.currentStreak ?? 0,
    rank,
    rankTotal: total,
  };
}
