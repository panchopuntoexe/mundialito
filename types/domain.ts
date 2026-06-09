/**
 * Tipos de dominio compartidos (tarea 1.8).
 *
 * Aliases sobre `Database` para usar en toda la app + uniones de dominio que
 * la DB guarda como `text` libre pero el código trata como enum cerrado.
 * Ver CONTEXT.md para el significado de cada término.
 */
import type { Database } from "@/types/database";

// ── Enums de la DB ──────────────────────────────────────────────
export type MatchStatus = Database["public"]["Enums"]["match_status"];
export type ResultPred = Database["public"]["Enums"]["result_pred"];
export type GoalsRange = Database["public"]["Enums"]["goals_range"];

// ── Uniones de dominio (en la DB son `text`) ────────────────────
/** Macro-ronda: límites de freeze/Wrapped (NO la fase granular). */
export type MacroRound =
  | "group_stage"
  | "round_32"
  | "round_16"
  | "quarter"
  | "semi"
  | "final";

/** Equipo que avanza en knockout; null en grupos. */
export type WinnerTeam = "home" | "away" | null;

export const GOALS_RANGES: readonly GoalsRange[] = [
  "0-1",
  "2-3",
  "4-5",
  "6+",
] as const;

export const MACRO_ROUNDS: readonly MacroRound[] = [
  "group_stage",
  "round_32",
  "round_16",
  "quarter",
  "semi",
  "final",
] as const;

// ── Aliases de filas ────────────────────────────────────────────
type Tables = Database["public"]["Tables"];

export type UserRow = Tables["users"]["Row"];
export type MatchRow = Tables["matches"]["Row"];
export type PredictionRow = Tables["predictions"]["Row"];
export type LeagueRow = Tables["leagues"]["Row"];
export type LeagueMemberRow = Tables["league_members"]["Row"];
export type StreakRow = Tables["streaks"]["Row"];
export type AchievementRow = Tables["achievements"]["Row"];
export type WrappedCardRow = Tables["wrapped_cards"]["Row"];
