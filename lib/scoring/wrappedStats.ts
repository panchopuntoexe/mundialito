/**
 * Agregación de stats para la tarjeta Wrapped — lógica pura (tarea 7.1).
 *
 * El cron de Wrapped (7.3) trae los pronósticos ya procesados del usuario en una
 * macro-ronda (o todo el torneo) y delega aquí el armado del snapshot que se
 * guarda en `wrapped_cards.stats_json` y alimenta la imagen (7.2):
 *  - agregados: % de aciertos, plenos, puntos de la fase, racha máxima, logros.
 *  - "fallo épico": entre los pronósticos INCORRECTOS, el del partido que el MAYOR
 *    % de la comunidad SÍ acertó ("todos lo vieron venir menos yo" — CONTEXT.md).
 *
 * Sin imports de env/red/DB: testeable sin Supabase (ADR de funciones puras).
 */
import type { AchievementType } from "@/lib/scoring/achievements";
import { levelForPoints, type LevelKey } from "@/lib/scoring/levels";
import type { MacroRound } from "@/types/domain";

/** Fase de la tarjeta: una macro-ronda o el torneo completo. */
export type WrappedPhase = MacroRound | "full_tournament";

/**
 * Un pronóstico procesado del usuario, ya con su resultado y el consenso del
 * partido. `communityCorrectPct` es el % de la comunidad que acertó el RESULTADO
 * de ese partido (la misma distribución que expone /consensus, tarea 4.6).
 */
export interface WrappedPrediction {
  matchId: number;
  /** Etiqueta para mostrar, p.ej. "ARG vs MEX". */
  matchLabel: string;
  pointsEarned: number;
  resultCorrect: boolean;
  goalsCorrect: boolean;
  /** % de la comunidad que acertó el resultado del partido (0-100). */
  communityCorrectPct: number;
}

/** El "fallo épico": el partido fallado que más gente acertó. */
export interface EpicMiss {
  matchId: number;
  matchLabel: string;
  communityCorrectPct: number;
}

/** Snapshot guardado en `wrapped_cards.stats_json`. */
export interface WrappedStats {
  phase: WrappedPhase;
  totalPredictions: number;
  correctPredictions: number;
  /** Plenos: resultado + rango de goles correctos. */
  perfectPredictions: number;
  /** % de aciertos de resultado (0-100, redondeado). */
  accuracy: number;
  /** Puntos sumados en la fase. */
  totalPoints: number;
  maxStreak: number;
  epicMiss: EpicMiss | null;
  achievements: AchievementType[];
  /**
   * Nivel del usuario según su total ACUMULADO de torneo (no los puntos de la
   * fase). Opcional: las tarjetas creadas antes de esta feature no lo tienen.
   */
  levelKey?: LevelKey;
}

/**
 * Encuentra el fallo épico: entre los pronósticos incorrectos, el del partido con
 * mayor `communityCorrectPct`. Empata por menor `matchId` (salida determinista).
 * Devuelve null si el usuario no falló ningún pronóstico.
 */
export function findEpicMiss(
  predictions: readonly WrappedPrediction[],
): EpicMiss | null {
  let worst: WrappedPrediction | null = null;
  for (const p of predictions) {
    if (p.resultCorrect) continue;
    if (
      worst === null ||
      p.communityCorrectPct > worst.communityCorrectPct ||
      (p.communityCorrectPct === worst.communityCorrectPct &&
        p.matchId < worst.matchId)
    ) {
      worst = p;
    }
  }
  if (worst === null) return null;
  return {
    matchId: worst.matchId,
    matchLabel: worst.matchLabel,
    communityCorrectPct: worst.communityCorrectPct,
  };
}

/**
 * Arma el snapshot de stats de la tarjeta Wrapped a partir de los pronósticos
 * procesados del usuario en la fase. `achievements` son los logros ya otorgados
 * (se copian al snapshot tal cual; su evaluación vive en 5.3).
 */
export function buildWrappedStats(params: {
  phase: WrappedPhase;
  predictions: readonly WrappedPrediction[];
  maxStreak: number;
  achievements?: readonly AchievementType[];
  /** Total ACUMULADO de torneo del usuario (define el nivel de la tarjeta). */
  userTotalPoints?: number;
}): WrappedStats {
  let correctPredictions = 0;
  let perfectPredictions = 0;
  let totalPoints = 0;
  for (const p of params.predictions) {
    totalPoints += p.pointsEarned;
    if (p.resultCorrect) {
      correctPredictions += 1;
      if (p.goalsCorrect) perfectPredictions += 1;
    }
  }

  const totalPredictions = params.predictions.length;
  const accuracy =
    totalPredictions === 0
      ? 0
      : Math.round((correctPredictions / totalPredictions) * 100);

  return {
    phase: params.phase,
    totalPredictions,
    correctPredictions,
    perfectPredictions,
    accuracy,
    totalPoints,
    maxStreak: params.maxStreak,
    epicMiss: findEpicMiss(params.predictions),
    achievements: [...(params.achievements ?? [])],
    levelKey:
      params.userTotalPoints === undefined
        ? undefined
        : levelForPoints(params.userTotalPoints).key,
  };
}
