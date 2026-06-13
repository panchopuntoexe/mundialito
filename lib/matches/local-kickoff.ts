/**
 * Etiqueta de la hora de kickoff en la zona horaria DEL USUARIO.
 *
 * Fix de UX: la UI mostraba el kickoff en la TZ del torneo (ET) sin indicarlo,
 * y un usuario en UTC-5 leía "21:00" como su hora local — creía que el partido
 * aún no empezaba cuando ya se jugaba. La hora visible debe ser la del
 * dispositivo; el "día del torneo" (agrupado de Hoy, racha) sigue en ET
 * (CONTEXT.md), eso no cambia acá.
 *
 * Pura y testeable: recibe la TZ ya resuelta (el cliente pasa la del navegador
 * vía `Intl.DateTimeFormat().resolvedOptions().timeZone`).
 */
import { toTournamentDay } from "@/lib/scoring/streaks";

/**
 * Hora local "HH:mm". Si la fecha local cae en OTRO día calendario que el día
 * del torneo (kickoffs nocturnos de ET vistos desde el este, p. ej. 23:00 ET
 * = 00:00 en UTC-3), antepone el día corto — "sáb 00:00" — para que la hora no
 * se lea como si fuera del día bajo el que está agrupado el partido.
 */
export function localKickoffLabel(kickoffAt: string, timeZone: string): string {
  const instant = new Date(kickoffAt);
  const hour = new Intl.DateTimeFormat("es", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);

  // toTournamentDay con TZ explícita = fecha 'YYYY-MM-DD' en esa zona.
  const localDay = toTournamentDay(instant, timeZone);
  if (localDay === toTournamentDay(instant)) return hour;

  const weekday = new Intl.DateTimeFormat("es", {
    timeZone,
    weekday: "short",
  }).format(instant);
  return `${weekday} ${hour}`;
}
