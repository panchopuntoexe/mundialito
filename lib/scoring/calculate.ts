/**
 * Cálculo de puntos — lógica pura (tarea 5.1, rediseño 0013).
 *
 * Reglas (ARCHITECTURE.md §3, CONTEXT.md):
 * - Resultado correcto = 10 pts (acertar quién gana / empata).
 * - Bonus de MARCADOR EXACTO por cercanía: por cada equipo, mientras más cerca
 *   de sus goles reales, más puntos, con caída EXPONENCIAL (no lineal). Se puntúa
 *   independiente del resultado ("más cerca = más puntos"). Tope del bonus 15 →
 *   tope total 25 (igual que antes, no descalibra niveles).
 * - En knockout el RESULTADO lo decide `winner_team` (el marcador puede empatar);
 *   en grupos se deriva del marcador a 90'/alargue.
 * - La cercanía cuenta reglamentario + alargue, SIN la tanda de penales: se
 *   calcula sobre `score_home`/`score_away`, que ya se guardan pre-tanda.
 * - NO hay multiplicador de racha (ADR 0001).
 */
import type { ResultPred, WinnerTeam } from "@/types/domain";

export const RESULT_POINTS = 10;
/** Cercanía por equipo según |pronóstico − real|: 0→7, 1→3, 2→1, ≥3→0. */
export const GOAL_PROXIMITY_POINTS = [7, 3, 1] as const;
/** Extra cuando el marcador es exacto en AMBOS equipos. */
export const EXACT_SCORE_BONUS = 1;
/** Tope del bonus de marcador (7 + 7 + 1). Tope total con resultado = 25. */
export const MAX_SCORE_BONUS =
  GOAL_PROXIMITY_POINTS[0] * 2 + EXACT_SCORE_BONUS;

/** Resultado a 90'/alargue (fase de grupos). Empate válido. */
export function deriveResult(scoreHome: number, scoreAway: number): ResultPred {
  if (scoreHome > scoreAway) return "home";
  if (scoreHome < scoreAway) return "away";
  return "draw";
}

/** Puntos de cercanía de un equipo (caída exponencial; fuera de tabla → 0). */
function proximityPoints(diff: number): number {
  return GOAL_PROXIMITY_POINTS[diff] ?? 0;
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
  /** Marcador exacto pronosticado; null = solo se pronosticó el resultado. */
  home_goals_pred: number | null;
  away_goals_pred: number | null;
}

export interface PointsResult {
  points: number;
  resultCorrect: boolean;
  /** true = marcador exacto en ambos equipos (antes "rango correcto"). */
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
  const resultCorrect = prediction.result_pred === actualResult;

  let scoreBonus = 0;
  let exactScore = false;
  // El marcador es opcional (van ambos goles o ninguno; lo garantiza Zod/DB).
  if (
    prediction.home_goals_pred !== null &&
    prediction.away_goals_pred !== null
  ) {
    const diffHome = Math.abs(prediction.home_goals_pred - match.score_home);
    const diffAway = Math.abs(prediction.away_goals_pred - match.score_away);
    exactScore = diffHome === 0 && diffAway === 0;
    scoreBonus =
      proximityPoints(diffHome) +
      proximityPoints(diffAway) +
      (exactScore ? EXACT_SCORE_BONUS : 0);
  }

  const points = (resultCorrect ? RESULT_POINTS : 0) + scoreBonus;

  // Sin multiplicador de racha (ADR 0001).
  return { points, resultCorrect, goalsCorrect: exactScore };
}
