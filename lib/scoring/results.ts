/**
 * Procesamiento de resultados — lógica pura (tarea 5.5, ARCHITECTURE §4.3).
 *
 * El cron (jobs/processResults.ts) usa estas funciones para:
 *  - `buildMatchResults`: calcular los puntos de cada pronóstico de un partido
 *    finalizado (delega en la lógica de scoring 5.1). El resultado se aplica de
 *    forma ATÓMICA e idempotente vía la RPC `apply_match_results` (migración 0007).
 *  - `aggregateAchievementStats`: armar las stats agregadas del usuario para
 *    evaluar logros (5.3) tras sumarle los puntos.
 *
 * NO toca rachas: son de participación y viven en el endpoint de pronóstico
 * (4.2/5.2 — ADR 0001). Sin imports de env/red/DB: testeable sin Supabase.
 */
import type { AchievementStats } from "@/lib/scoring/achievements";
import {
  calculatePoints,
  type ScoredMatch,
  type ScoredPrediction,
} from "@/lib/scoring/calculate";

/** Pronóstico a puntuar: el de scoring + su identidad para persistir. */
export type PredictionToScore = ScoredPrediction & {
  id: string;
  user_id: string;
};

/**
 * Una predicción ya puntuada, lista para la RPC `apply_match_results`. Las claves
 * coinciden EXACTAMENTE con las que lee la función SQL (`prediction_id`,
 * `user_id`, `points`, `result_correct`, `goals_correct`).
 */
export interface MatchResultEntry {
  prediction_id: string;
  user_id: string;
  points: number;
  result_correct: boolean;
  goals_correct: boolean;
}

/** Calcula los puntos de todos los pronósticos de un partido contra su resultado. */
export function buildMatchResults(
  predictions: readonly PredictionToScore[],
  match: ScoredMatch,
): MatchResultEntry[] {
  return predictions.map((p) => {
    const { points, resultCorrect, goalsCorrect } = calculatePoints(p, match);
    return {
      prediction_id: p.id,
      user_id: p.user_id,
      points,
      result_correct: resultCorrect,
      goals_correct: goalsCorrect,
    };
  });
}

/** Filas de predicciones de un usuario, para contar aciertos y rachas. */
interface ScoredPredictionRow {
  match_id: number;
  result_correct: boolean | null;
  goals_correct: boolean | null;
  /** Kickoff del partido (ISO) — ordena la racha de aciertos consecutivos. */
  kickoff_at: string;
}

/**
 * Arma las stats agregadas que consume `evaluateAchievements` (5.3). `totalPoints`
 * y `maxStreak` se leen de la DB (post-actualización); los conteos y la racha de
 * aciertos se derivan de las predicciones del usuario. `openerMatchId` es el primer
 * partido del torneo (por kickoff) para el logro "Telonero".
 */
export function aggregateAchievementStats(params: {
  predictions: readonly ScoredPredictionRow[];
  maxStreak: number;
  totalPoints: number;
  openerMatchId: number | null;
}): AchievementStats {
  let correctPredictions = 0;
  let perfectPredictions = 0;
  let predictedTournamentOpener = false;
  for (const p of params.predictions) {
    if (p.result_correct) {
      correctPredictions += 1;
      if (p.goals_correct) perfectPredictions += 1;
    }
    if (params.openerMatchId !== null && p.match_id === params.openerMatchId) {
      predictedTournamentOpener = true;
    }
  }

  // Racha de aciertos: corrida más larga de result_correct=true en orden de
  // kickoff. Las no procesadas (null) no rompen ni suman (solo aparecen al final,
  // partidos aún no jugados).
  const ordered = [...params.predictions].sort((a, b) =>
    a.kickoff_at < b.kickoff_at ? -1 : a.kickoff_at > b.kickoff_at ? 1 : 0,
  );
  let maxCorrectStreak = 0;
  let run = 0;
  for (const p of ordered) {
    if (p.result_correct === null) continue;
    if (p.result_correct) {
      run += 1;
      if (run > maxCorrectStreak) maxCorrectStreak = run;
    } else {
      run = 0;
    }
  }

  return {
    totalPredictions: params.predictions.length,
    correctPredictions,
    perfectPredictions,
    maxStreak: params.maxStreak,
    totalPoints: params.totalPoints,
    predictedTournamentOpener,
    maxCorrectStreak,
  };
}
