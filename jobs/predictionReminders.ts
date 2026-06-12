/**
 * Cron — Recordatorio de pronóstico olvidado (tarea 8.6).
 *
 * Corre piggyback en /api/cron/process-results (cada 5 min). Busca partidos
 * que abren dentro de la próxima hora y avisa por push a los usuarios
 * suscritos que aún no los pronosticaron — COMO MÁXIMO UNA VEZ POR DÍA del
 * torneo por usuario, para no hostigar.
 *
 * El "una sola vez" lo garantiza la DB, no la memoria del proceso: antes de
 * enviar se inserta el claim en `push_notification_log` (unique sobre
 * user/kind/dedupe_key con ON CONFLICT DO NOTHING). Si el insert no devuelve
 * fila, otra corrida ya avisó hoy y se omite. Preferimos perder un aviso ante
 * un crash que mandarlo dos veces.
 *
 * La decisión de a quién avisar vive pura (y testeada) en
 * `lib/notifications/reminders.ts`; acá solo el cableado con Supabase.
 */
import {
  REMINDER_KIND,
  REMINDER_WINDOW_MS,
  buildReminderPlan,
  reminderPayload,
} from "@/lib/notifications/reminders";
import { isPushConfigured, sendPushToUser } from "@/lib/notifications/webPush";
import { createAdminClient } from "@/lib/supabase/server";

export interface PredictionRemindersSummary {
  /** Usuarios con partidos sin pronosticar dentro de la ventana. */
  candidates: number;
  /** Recordatorios enviados en esta corrida. */
  sent: number;
  /** Candidatos omitidos porque ya recibieron su aviso del día. */
  alreadyReminded: number;
}

const EMPTY: PredictionRemindersSummary = { candidates: 0, sent: 0, alreadyReminded: 0 };

export async function runPredictionReminders(
  now: Date = new Date(),
): Promise<PredictionRemindersSummary> {
  // Push opcional (8.3): sin claves VAPID el job es un no-op silencioso.
  if (!isPushConfigured()) return EMPTY;

  const admin = createAdminClient();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const { data: matches, error: matchErr } = await admin
    .from("matches")
    .select("id, kickoff_at")
    .eq("status", "scheduled")
    .gt("kickoff_at", now.toISOString())
    .lte("kickoff_at", windowEnd.toISOString());
  if (matchErr) {
    throw new Error(`[predictionReminders] error leyendo partidos: ${matchErr.message}`);
  }
  if (!matches || matches.length === 0) return EMPTY;

  // Solo tiene sentido evaluar usuarios alcanzables por push.
  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("user_id");
  if (subErr) {
    throw new Error(`[predictionReminders] error leyendo suscripciones: ${subErr.message}`);
  }
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];
  if (userIds.length === 0) return EMPTY;

  const { data: preds, error: predErr } = await admin
    .from("predictions")
    .select("user_id, match_id")
    .in("match_id", matches.map((m) => m.id))
    .in("user_id", userIds);
  if (predErr) {
    throw new Error(`[predictionReminders] error leyendo pronósticos: ${predErr.message}`);
  }

  const plan = buildReminderPlan({ matches, predictions: preds ?? [], userIds });

  let sent = 0;
  let alreadyReminded = 0;
  for (const candidate of plan) {
    // Claim atómico ANTES de enviar: con ignoreDuplicates, el insert devuelve
    // la fila solo si esta corrida la creó; vacío = ya se avisó hoy.
    const { data: claimed, error: claimErr } = await admin
      .from("push_notification_log")
      .upsert(
        {
          user_id: candidate.userId,
          kind: REMINDER_KIND,
          dedupe_key: candidate.dedupeKey,
        },
        { onConflict: "user_id,kind,dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    if (claimErr) {
      console.error(
        `[predictionReminders] error en claim de ${candidate.userId}:`,
        claimErr,
      );
      continue;
    }
    if (!claimed || claimed.length === 0) {
      alreadyReminded += 1;
      continue;
    }

    const result = await sendPushToUser(candidate.userId, reminderPayload(candidate.missing));
    if (result.sent > 0) sent += 1;
  }

  if (plan.length > 0) {
    console.info(
      `[predictionReminders] ${sent} recordatorios enviados (${alreadyReminded} ya avisados hoy).`,
    );
  }
  return { candidates: plan.length, sent, alreadyReminded };
}
