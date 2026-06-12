/**
 * Recordatorio de pronóstico olvidado (tarea 8.6) — lógica pura.
 *
 * Decide a quién avisar: usuarios suscritos a push con partidos que abren
 * dentro de la ventana (`REMINDER_WINDOW_MS` antes del kickoff) y que aún no
 * pronosticaron. Para no molestar, el aviso es COMO MÁXIMO UNO POR DÍA del
 * torneo: el `dedupeKey` es el día (TZ del torneo) del primer partido sin
 * pronosticar, y el job lo persiste en `push_notification_log` (unique) antes
 * de enviar. El cableado con Supabase vive en `jobs/predictionReminders.ts`.
 */
import { toTournamentDay } from "@/lib/scoring/streaks";
import type { PushPayload } from "@/lib/notifications/webPush";

/** Cuánto antes del kickoff entra un partido en la ventana de recordatorio. */
export const REMINDER_WINDOW_MS = 60 * 60 * 1000;

/** `kind` del recordatorio en `push_notification_log`. */
export const REMINDER_KIND = "prediction-reminder";

export interface ReminderMatch {
  id: number;
  kickoff_at: string;
}

export interface ReminderPrediction {
  user_id: string;
  match_id: number;
}

export interface ReminderCandidate {
  userId: string;
  /** Cuántos partidos de la ventana le faltan pronosticar. */
  missing: number;
  /** Día del torneo del primer partido faltante → una vez por día. */
  dedupeKey: string;
}

/**
 * Cruza partidos de la ventana × usuarios suscritos × pronósticos existentes
 * y devuelve un candidato por usuario al que le falte al menos un pronóstico.
 */
export function buildReminderPlan(input: {
  matches: ReminderMatch[];
  predictions: ReminderPrediction[];
  userIds: string[];
}): ReminderCandidate[] {
  const { matches, predictions, userIds } = input;
  if (matches.length === 0 || userIds.length === 0) return [];

  const predicted = new Set(predictions.map((p) => `${p.user_id}:${p.match_id}`));
  const byKickoff = [...matches].sort((a, b) =>
    a.kickoff_at.localeCompare(b.kickoff_at),
  );

  const plan: ReminderCandidate[] = [];
  for (const userId of userIds) {
    const missing = byKickoff.filter((m) => !predicted.has(`${userId}:${m.id}`));
    if (missing.length === 0) continue;
    plan.push({
      userId,
      missing: missing.length,
      dedupeKey: toTournamentDay(new Date(missing[0].kickoff_at)),
    });
  }
  return plan;
}

/** Payload del push de recordatorio (texto en tuteo neutro). */
export function reminderPayload(missing: number): PushPayload {
  const body =
    missing === 1
      ? "Tienes 1 partido sin pronosticar y cierra cuando empiece. ¡Haz tu pronóstico!"
      : `Tienes ${missing} partidos sin pronosticar y el primero cierra pronto. ¡Haz tus pronósticos!`;
  return {
    title: "⏰ Te falta pronosticar",
    body,
    url: "/",
    tag: REMINDER_KIND,
  };
}
