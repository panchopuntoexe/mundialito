/**
 * Logros / insignias (achievements) — lógica pura (tarea 5.3).
 *
 * Evalúa qué logros corresponden a un usuario según sus stats agregadas y
 * devuelve SOLO los nuevos (idempotente: nunca re-otorga uno ya ganado).
 * El cron de resultados (5.5) persiste los nuevos respetando unique(user, type).
 *
 * Cada def lleva metadatos de presentación (`label`, `icon`, `description`) para
 * la UI de insignias. `icon` es un emoji solo para la web (no se usa en la imagen
 * Satori). Sin imports de env/red/DB: testeable.
 */

export type AchievementType =
  | "first_prediction" // primer pronóstico
  | "first_win" // primer resultado acertado
  | "sharpshooter" // al menos un pleno (resultado + bonus de goles)
  | "streak_3" // racha de participación de 3
  | "streak_legend" // racha de participación de 10
  | "centurion" // 100+ puntos
  | "tournament_opener" // pronosticó el primer partido del torneo
  | "hot_streak"; // más de 3 partidos seguidos acertados

export interface AchievementStats {
  totalPredictions: number;
  correctPredictions: number;
  /** Pronósticos con resultado + rango de goles correctos (pleno). */
  perfectPredictions: number;
  maxStreak: number;
  totalPoints: number;
  /** ¿Pronosticó el primer partido del torneo (por orden de kickoff)? */
  predictedTournamentOpener: boolean;
  /** Corrida más larga de aciertos de resultado consecutivos (por kickoff). */
  maxCorrectStreak: number;
}

export interface AchievementDef {
  type: AchievementType;
  /** Nombre visible de la insignia. */
  label: string;
  /** Emoji para la web UI (NO usar en la imagen Satori). */
  icon: string;
  /** Cómo se desbloquea (texto para la UI). */
  description: string;
  /** ¿El usuario cumple el criterio con estas stats? */
  earned: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  {
    type: "first_prediction",
    label: "Debut",
    icon: "✏️",
    description: "Hiciste tu primer pronóstico.",
    earned: (s) => s.totalPredictions >= 1,
  },
  {
    type: "tournament_opener",
    label: "Telonero",
    icon: "🎬",
    description: "Pronosticaste el primer partido del torneo.",
    earned: (s) => s.predictedTournamentOpener,
  },
  {
    type: "first_win",
    label: "Primer acierto",
    icon: "🎯",
    description: "Acertaste el resultado de un partido.",
    earned: (s) => s.correctPredictions >= 1,
  },
  {
    type: "sharpshooter",
    label: "Francotirador",
    icon: "💎",
    description: "Clavaste un pleno: resultado + rango de goles.",
    earned: (s) => s.perfectPredictions >= 1,
  },
  {
    type: "hot_streak",
    label: "En racha",
    icon: "🔥",
    description: "Más de 3 partidos seguidos acertados.",
    earned: (s) => s.maxCorrectStreak >= 4,
  },
  {
    type: "streak_3",
    label: "Constante",
    icon: "📅",
    description: "Racha de participación de 3 días.",
    earned: (s) => s.maxStreak >= 3,
  },
  {
    type: "streak_legend",
    label: "Leyenda de la racha",
    icon: "⚡",
    description: "Racha de participación de 10 días.",
    earned: (s) => s.maxStreak >= 10,
  },
  {
    type: "centurion",
    label: "Centurión",
    icon: "💯",
    description: "Llegaste a 100 puntos.",
    earned: (s) => s.totalPoints >= 100,
  },
] as const;

/** Acceso por tipo a la def (para la UI de insignias). */
export const ACHIEVEMENT_BY_TYPE: Readonly<
  Record<AchievementType, AchievementDef>
> = Object.fromEntries(ACHIEVEMENT_DEFS.map((d) => [d.type, d])) as Record<
  AchievementType,
  AchievementDef
>;

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
