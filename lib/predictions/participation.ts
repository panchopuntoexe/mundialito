/**
 * Completitud de la participación del día — lógica pura (tarea 4.2).
 *
 * La RACHA exige pronosticar TODOS los partidos del día que aún estaban ABIERTOS
 * (kickoff futuro) al momento de pronosticar (CONTEXT.md "Racha", ARCHITECTURE
 * §4.5). El conjunto de abiertos solo se ENCOGE con el correr del día —los
 * partidos van arrancando y se cierran—, así la racha siempre es alcanzable para
 * quien se presenta: los partidos que ya arrancaron antes de que el usuario
 * abriera la app no cuentan en su contra.
 *
 * Esta función es pura y testeable; el endpoint (4.2) le inyecta los partidos del
 * día y los match_id que el usuario ya tiene pronosticados (incluido el recién
 * guardado).
 */

export interface DayMatchSlot {
  id: number;
  /** Kickoff en ISO 8601. */
  kickoff_at: string;
}

/**
 * ¿El usuario completó la participación del día? `true` si todo partido del día
 * que todavía sigue ABIERTO (kickoff > now) tiene un pronóstico del usuario.
 * Requiere al menos un partido abierto: si ya arrancaron todos, no hay día que
 * "completar" (el usuario llegó cuando ya no había nada que pronosticar).
 */
export function isParticipationComplete(params: {
  todaysMatches: DayMatchSlot[];
  predictedMatchIds: Iterable<number>;
  now: Date;
}): boolean {
  const nowMs = params.now.getTime();
  const openMatches = params.todaysMatches.filter(
    (m) => new Date(m.kickoff_at).getTime() > nowMs,
  );
  if (openMatches.length === 0) return false;

  const predicted = new Set(params.predictedMatchIds);
  return openMatches.every((m) => predicted.has(m.id));
}
