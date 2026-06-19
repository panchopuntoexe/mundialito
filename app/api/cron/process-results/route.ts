import { NextResponse } from "next/server";
import { sendAlert } from "@/lib/alerts/send";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runProcessResults } from "@/jobs/processResults";
import {
  runPredictionReminders,
  type PredictionRemindersSummary,
} from "@/jobs/predictionReminders";

/**
 * GET /api/cron/process-results — Cron Results Checker + Score Calc (tareas 5.5/5.6).
 *
 * Lo dispara Vercel Cron cada 5 min (ver vercel.json). Protegido con CRON_SECRET
 * (ARCHITECTURE §8). Idempotente: correrlo dos veces no duplica puntos (la RPC
 * `apply_match_results` hace el claim atómico de `processed`).
 *
 * También dispara, piggyback en esta invocación (sin crons nuevos: Vercel
 * limita la cantidad): el recordatorio de pronóstico olvidado (8.6). Cada job
 * tiene su try/catch: que falle uno no bloquea a los demás.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let results: Awaited<ReturnType<typeof runProcessResults>> | null = null;
  let resultsError = false;
  try {
    results = await runProcessResults();
  } catch (err) {
    resultsError = true;
    console.error("[cron/process-results] error:", err);
    await sendAlert({ source: "cron/process-results", error: err });
  }

  let reminders: PredictionRemindersSummary | null = null;
  let remindersError = false;
  try {
    reminders = await runPredictionReminders();
  } catch (err) {
    remindersError = true;
    console.error("[cron/process-results] error en recordatorios:", err);
    await sendAlert({ source: "cron/prediction-reminders", error: err });
  }

  if (resultsError || remindersError) {
    return NextResponse.json(
      { error: "Falló el procesamiento de resultados.", results, reminders },
      { status: 500 },
    );
  }
  return NextResponse.json({ ...results, reminders });
}
