/**
 * "Partido(s) del día" — límites de día en la TZ del torneo (tarea 3.4).
 *
 * El "día" usa una zona horaria FIJA del torneo, no la local del usuario
 * (CONTEXT.md "Partido del día", ARCHITECTURE §4.5). Reutiliza la misma TZ que la
 * racha (`lib/scoring/streaks`) para que ambos coincidan en el corte de día.
 *
 * `tournamentDayRangeUtc` devuelve el rango UTC `[start, end)` del día calendario
 * para filtrar `matches.kickoff_at` en la DB. Es DST-aware: calcula el offset de
 * la TZ en cada instante (sin librerías).
 */
import { TOURNAMENT_TIME_ZONE, toTournamentDay } from "@/lib/scoring/streaks";

/** Día actual ('YYYY-MM-DD') en la TZ del torneo. */
export function tournamentToday(now: Date = new Date()): string {
  return toTournamentDay(now);
}

/** Offset (ms) entre la hora local de `timeZone` y UTC en el instante `date`. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const at: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") at[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute, at.second);
  return asUtc - date.getTime();
}

/** Instante UTC de la medianoche local de `day` en `timeZone` (DST-aware). */
function zonedDayStartUtc(day: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  // Primera aproximación: medianoche tratada como si fuera UTC, luego se corrige
  // con el offset real de la TZ en ese instante.
  const guessUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = tzOffsetMs(new Date(guessUtc), timeZone);
  return new Date(guessUtc - offset);
}

/** Suma un día calendario a 'YYYY-MM-DD'. */
export function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Rango UTC `[startUtc, endUtc)` del día calendario `day` en la TZ del torneo.
 * Se usa para `kickoff_at >= startUtc AND kickoff_at < endUtc`.
 */
export function tournamentDayRangeUtc(
  day: string,
  timeZone: string = TOURNAMENT_TIME_ZONE,
): { startUtc: string; endUtc: string } {
  return {
    startUtc: zonedDayStartUtc(day, timeZone).toISOString(),
    endUtc: zonedDayStartUtc(nextDay(day), timeZone).toISOString(),
  };
}
