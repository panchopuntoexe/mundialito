/**
 * Racha de PARTICIPACIÓN — lógica pura (tarea 5.2, ADR 0001).
 *
 * Mide días consecutivos en que el usuario pronosticó TODOS los partidos
 * abiertos del día. No mide aciertos y NO afecta los puntos. Se invoca desde el
 * endpoint de pronóstico (4.2), nunca desde el cron de resultados.
 *
 * Reglas (ARCHITECTURE.md §4.5, CONTEXT.md):
 * - "Día" en una zona horaria FIJA del torneo (no la local del usuario).
 * - Día consecutivo → +1. Mismo día → sin cambio (idempotente).
 * - Salto de día(s) → si hay freeze, se auto-consume y la racha continúa;
 *   si no, se reinicia a 1.
 * - El freeze se recarga una vez por MACRO-RONDA (no por cada grupo).
 */
import type { MacroRound } from "@/types/domain";

/**
 * Zona horaria que define el límite de "día" del torneo. Decisión de producto:
 * un único huso fijo para todos los usuarios (el Mundial 2026 abarca varios).
 */
export const TOURNAMENT_TIME_ZONE = "America/New_York";

/** Convierte un instante a la fecha 'YYYY-MM-DD' en la TZ del torneo. */
export function toTournamentDay(
  instant: Date,
  timeZone: string = TOURNAMENT_TIME_ZONE,
): string {
  // en-CA produce el formato ISO YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Días calendario entre dos fechas 'YYYY-MM-DD' (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msA = Date.UTC(ay, am - 1, ad);
  const msB = Date.UTC(by, bm - 1, bd);
  return Math.round((msB - msA) / 86_400_000);
}

export interface StreakState {
  current_streak: number;
  max_streak: number;
  freeze_available: boolean;
  /** Día (TZ del torneo) de la última participación completa, o null. */
  last_participated_on: string | null;
  /** Macro-ronda del último refill de freeze, o null. */
  freeze_refilled_round: string | null;
}

export interface StreakInput {
  /** Día actual en TZ del torneo ('YYYY-MM-DD'). */
  today: string;
  /** Macro-ronda del día actual (para el refill de freeze). */
  macroRound: MacroRound;
  /** ¿El usuario ya pronosticó todos los partidos abiertos del día? */
  completedToday: boolean;
}

/**
 * Calcula el nuevo estado de racha tras un evento de participación.
 * Pura: no toca la DB. El endpoint persiste el resultado.
 */
export function advanceStreak(
  state: StreakState,
  input: StreakInput,
): StreakState {
  // 1) Refill de freeze al entrar a una nueva macro-ronda (una sola vez).
  let freezeAvailable = state.freeze_available;
  let freezeRefilledRound = state.freeze_refilled_round;
  if (state.freeze_refilled_round !== input.macroRound) {
    freezeAvailable = true;
    freezeRefilledRound = input.macroRound;
  }

  const base: StreakState = {
    ...state,
    freeze_available: freezeAvailable,
    freeze_refilled_round: freezeRefilledRound,
  };

  // 2) Si todavía no completó el día, no se mueve la racha (solo quedó el refill).
  if (!input.completedToday) {
    return base;
  }

  // 3) Ya completó el día: avanzar / mantener / reiniciar.
  const { last_participated_on } = state;

  // Mismo día que la última participación → idempotente.
  if (last_participated_on === input.today) {
    return base;
  }

  let current: number;
  let freeze = freezeAvailable;

  if (last_participated_on === null) {
    // Primera participación de la historia.
    current = 1;
  } else {
    const gap = daysBetween(last_participated_on, input.today);
    if (gap === 1) {
      // Día consecutivo.
      current = base.current_streak + 1;
    } else if (freeze) {
      // Se saltó día(s) pero hay freeze: se consume y la racha continúa.
      current = base.current_streak + 1;
      freeze = false;
    } else {
      // Salto sin freeze: se reinicia.
      current = 1;
    }
  }

  return {
    current_streak: current,
    max_streak: Math.max(base.max_streak, current),
    freeze_available: freeze,
    last_participated_on: input.today,
    freeze_refilled_round: freezeRefilledRound,
  };
}
