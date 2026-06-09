/**
 * Cálculo de puntos — lógica pura (tarea 5.1).
 *
 * Reglas (ARCHITECTURE.md §3, CONTEXT.md):
 * - Resultado correcto = 10 pts. Bonus de rango de goles = +15 (solo si además
 *   se acertó el resultado).
 * - En knockout el resultado lo decide `winner_team` (el marcador puede empatar);
 *   en grupos se deriva del marcador a 90'.
 * - El rango de goles cuenta reglamentario + alargue, SIN la tanda de penales:
 *   se calcula sobre `score_home`/`score_away`, que ya se guardan pre-tanda.
 * - NO hay multiplicador de racha (ADR 0001).
 */
import type { GoalsRange, ResultPred, WinnerTeam } from "@/types/domain";

export const RESULT_POINTS = 10;
export const GOALS_BONUS_POINTS = 15;

/** Resultado a 90'/marcador (fase de grupos). Empate válido. */
export function deriveResult(scoreHome: number, scoreAway: number): ResultPred {
  if (scoreHome > scoreAway) return "home";
  if (scoreHome < scoreAway) return "away";
  return "draw";
}

/** Bucket de goles totales (reg + alargue, sin tanda de penales). */
export function deriveGoalsRange(totalGoals: number): GoalsRange {
  if (totalGoals <= 1) return "0-1";
  if (totalGoals <= 3) return "2-3";
  if (totalGoals <= 5) return "4-5";
  return "6+";
}

export interface ScoredMatch {
  /** Marcador post-alargue, pre-tanda de penales. */
  score_home: number;
  score_away: number;
  /** Equipo que avanza en knockout; null en grupos. */
  winner_team: WinnerTeam;
}

export interface ScoredPrediction {
  result_pred: ResultPred;
  goals_range_pred: GoalsRange;
}

export interface PointsResult {
  points: number;
  resultCorrect: boolean;
  goalsCorrect: boolean;
}

/**
 * Calcula puntos de un pronóstico contra el resultado final de un partido.
 * Idempotente y sin efectos: el cron (5.5) la usa por cada predicción.
 */
export function calculatePoints(
  prediction: ScoredPrediction,
  match: ScoredMatch,
): PointsResult {
  // Knockout: gana quien avanza. Grupos: se deriva del marcador.
  const actualResult: ResultPred =
    match.winner_team ?? deriveResult(match.score_home, match.score_away);

  // Goles del partido en sí (la tanda de penales no suma).
  const totalGoals = match.score_home + match.score_away;
  const actualGoalsRange = deriveGoalsRange(totalGoals);

  const resultCorrect = prediction.result_pred === actualResult;
  const goalsCorrect = prediction.goals_range_pred === actualGoalsRange;

  let points = 0;
  if (resultCorrect) {
    points += RESULT_POINTS;
    if (goalsCorrect) {
      points += GOALS_BONUS_POINTS;
    }
  }

  // Sin multiplicador de racha (ADR 0001).
  return { points, resultCorrect, goalsCorrect };
}
