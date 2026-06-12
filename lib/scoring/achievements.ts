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
  /** Cómo se desbloquea (texto para la UI). El ícono vive en
   *  components/icons.tsx (<BadgeIcon/>, mapeado por `type`). */
  description: string;
  /** Frase graciosa para el tooltip de la web UI. */
  funFact: string;
  /** ¿El usuario cumple el criterio con estas stats? */
  earned: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  {
    type: "first_prediction",
    label: "Debut",    description: "Hiciste tu primer pronóstico.",
    funFact: "Todo crack debutó alguna vez.",
    earned: (s) => s.totalPredictions >= 1,
  },
  {
    type: "tournament_opener",
    label: "Telonero",    description: "Pronosticaste el primer partido del torneo.",
    funFact: "Llegaste antes de que corten el pasto. ¿Tienes contactos en la organización?",
    earned: (s) => s.predictedTournamentOpener,
  },
  {
    type: "first_win",
    label: "Primer acierto",    description: "Acertaste el resultado de un partido.",
    funFact: "Uno de uno: estadísticamente eres infalible. No lo arruines - _ -",
    earned: (s) => s.correctPredictions >= 1,
  },
  {
    type: "sharpshooter",
    label: "Francotirador",    description: "Clavaste un pleno: resultado + rango de goles.",
    funFact: "Resultado y goles clavados. ¿Tienes otra cosa que hacer?",
    earned: (s) => s.perfectPredictions >= 1,
  },
  {
    type: "hot_streak",
    label: "En racha",    description: "Más de 3 partidos seguidos acertados.",
    funFact: "Messi",
    earned: (s) => s.maxCorrectStreak >= 4,
  },
  {
    type: "streak_3",
    label: "Constante",    description: "Racha de participación de 3 días.",
    funFact: "Toca césped.",
    earned: (s) => s.maxStreak >= 3,
  },
  {
    type: "streak_legend",
    label: "Leyenda de la racha",    description: "Racha de participación de 10 días.",
    funFact: "Avísale a tu familia que estás bien.",
    earned: (s) => s.maxStreak >= 10,
  },
  {
    type: "centurion",
    label: "Centurión",    description: "Llegaste a 100 puntos.",
    funFact: "100 puntos. ¿HUH?",
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
