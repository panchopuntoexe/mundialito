/**
 * Tipos del cuadro de eliminación (knockout).
 *
 * Una CELDA del cuadro es un partido de knockout (reusa `MatchCardData`) con el
 * pronóstico PROPIO superpuesto y el `external_ref` (id de worldcup26.ir, en orden
 * oficial FIFA) para ordenar dentro de cada ronda. Una COLUMNA es una fase.
 *
 * `BRACKET_CACHE_KEY` vive acá (módulo hoja, sin imports de runtime: el `import
 * type` se borra al compilar) para que lo compartan el loader, el cron de sync y
 * el script de backfill —que corre fuera del runtime de Next— sin arrastrar
 * `next/headers`.
 */
import type { MatchCardData, MatchCardPrediction } from "@/components/MatchCard";

/** Una celda del cuadro: el partido + el pronóstico propio (si hay). */
export interface BracketCell extends MatchCardData {
  external_ref: string | null;
  prediction: MatchCardPrediction | null;
}

/** Fila de partido de knockout tal como sale del select (sin pronóstico). */
export type KnockoutMatchRow = Omit<BracketCell, "prediction">;

/** Una columna del cuadro: todos los partidos de una fase. */
export interface BracketColumn {
  phase: string;
  matches: BracketCell[];
}

/**
 * Orden de las columnas (avance del torneo). El tercer puesto va al final, fuera
 * del embudo principal. Las claves son `phase` granular (no `macro_round`).
 */
export const BRACKET_PHASE_ORDER = [
  "round_32",
  "round_16",
  "quarter",
  "semi",
  "final",
  "third_place",
] as const;

/** Clave de caché de la lista de partidos de knockout (la invalida sync/backfill). */
export const BRACKET_CACHE_KEY = "bracket:knockout";
