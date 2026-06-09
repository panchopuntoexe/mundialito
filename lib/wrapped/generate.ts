/**
 * Helpers puros del cron de Wrapped (tarea 7.3).
 *
 * El cron (jobs/generateWrapped) los usa para decidir QUÉ generar y para derivar
 * el consenso por partido que alimenta el "fallo épico" (7.1). Sin I/O: testeables
 * sin Supabase, igual que el resto de `lib/scoring`.
 */
import { deriveResult } from "@/lib/scoring/calculate";
import type { MatchStatus, ResultPred, WinnerTeam } from "@/types/domain";

/** Resultado real: en knockout lo decide quién avanza; en grupos, el marcador. */
export function actualResult(match: {
  score_home: number;
  score_away: number;
  winner_team: WinnerTeam;
}): ResultPred {
  return match.winner_team ?? deriveResult(match.score_home, match.score_away);
}

/**
 * % de la comunidad que acertó el RESULTADO del partido (0-100, redondeado). Es
 * la métrica que define el fallo épico: el partido fallado con mayor consenso.
 */
export function communityCorrectPct(
  resultPreds: readonly ResultPred[],
  actual: ResultPred,
): number {
  if (resultPreds.length === 0) return 0;
  const correct = resultPreds.filter((r) => r === actual).length;
  return Math.round((correct / resultPreds.length) * 100);
}

/**
 * Una macro-ronda está completa cuando tiene partidos y ninguno sigue pendiente
 * (todos finalizados o cancelados). Recién ahí tiene sentido generar su Wrapped.
 */
export function isMacroRoundComplete(
  statuses: readonly MatchStatus[],
): boolean {
  if (statuses.length === 0) return false;
  return statuses.every((s) => s === "finished" || s === "cancelled");
}
