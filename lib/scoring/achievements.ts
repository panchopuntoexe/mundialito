/**
 * Logros (achievements) — lógica pura (tarea 5.3).
 *
 * Evalúa qué logros corresponden a un usuario según sus stats agregadas y
 * devuelve SOLO los nuevos (idempotente: nunca re-otorga uno ya ganado).
 * El cron de resultados (5.5) persiste los nuevos respetando unique(user, type).
 */

export type AchievementType =
  | "first_prediction" // primer pronóstico
  | "first_win" // primer resultado acertado
  | "sharpshooter" // al menos un pleno (resultado + bonus de goles)
  | "streak_3" // racha de 3
  | "streak_legend" // racha de 10
  | "centurion"; // 100+ puntos

export interface AchievementStats {
  totalPredictions: number;
  correctPredictions: number;
  /** Pronósticos con resultado + rango de goles correctos (pleno). */
  perfectPredictions: number;
  maxStreak: number;
  totalPoints: number;
}

interface AchievementDef {
  type: AchievementType;
  /** ¿El usuario cumple el criterio con estas stats? */
  earned: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  { type: "first_prediction", earned: (s) => s.totalPredictions >= 1 },
  { type: "first_win", earned: (s) => s.correctPredictions >= 1 },
  { type: "sharpshooter", earned: (s) => s.perfectPredictions >= 1 },
  { type: "streak_3", earned: (s) => s.maxStreak >= 3 },
  { type: "streak_legend", earned: (s) => s.maxStreak >= 10 },
  { type: "centurion", earned: (s) => s.totalPoints >= 100 },
] as const;

/**
 * Devuelve los logros recién ganados (cumplen criterio y no estaban otorgados).
 */
export function evaluateAchievements(
  stats: AchievementStats,
  alreadyEarned: Iterable<string> = [],
): AchievementType[] {
  const earnedSet = new Set(alreadyEarned);
  return ACHIEVEMENT_DEFS.filter(
    (def) => !earnedSet.has(def.type) && def.earned(stats),
  ).map((def) => def.type);
}
