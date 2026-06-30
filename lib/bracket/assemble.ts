/**
 * Armado del cuadro de eliminación — lógica PURA (sin Redis ni Supabase), para
 * testearla aislada igual que `lib/matches/sync.ts`. La carga con I/O (caché +
 * pronósticos del usuario) vive en `loadBracket.ts`.
 */
import type { MatchCardPrediction } from "@/components/MatchCard";
import {
  BRACKET_PHASE_ORDER,
  type BracketCell,
  type BracketColumn,
  type KnockoutMatchRow,
} from "@/lib/bracket/types";

/**
 * Agrupa los partidos en columnas por fase (en `BRACKET_PHASE_ORDER`) y, dentro de
 * cada una, los ordena por `external_ref` NUMÉRICO (orden oficial FIFA; como text
 * "100" < "73"). Superpone el pronóstico propio. Omite fases sin partidos.
 */
export function assembleBracket(
  rows: readonly KnockoutMatchRow[],
  predByMatch: ReadonlyMap<number, MatchCardPrediction>,
): BracketColumn[] {
  const byPhase = new Map<string, BracketCell[]>();
  for (const row of rows) {
    const cell: BracketCell = { ...row, prediction: predByMatch.get(row.id) ?? null };
    byPhase.set(row.phase, [...(byPhase.get(row.phase) ?? []), cell]);
  }

  const refOrder = (ref: string | null): number =>
    ref ? Number(ref) : Number.POSITIVE_INFINITY;

  const columns: BracketColumn[] = [];
  for (const phase of BRACKET_PHASE_ORDER) {
    const matches = byPhase.get(phase);
    if (!matches || matches.length === 0) continue;
    matches.sort((a, b) => refOrder(a.external_ref) - refOrder(b.external_ref));
    columns.push({ phase, matches });
  }
  return columns;
}
