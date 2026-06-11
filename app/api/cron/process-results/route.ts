import { NextResponse } from "next/server";
import { sendAlert } from "@/lib/alerts/send";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runProcessResults } from "@/jobs/processResults";
import { runBotPredictions, type BotPredictionsSummary } from "@/jobs/botPredictions";

/**
 * GET /api/cron/process-results — Cron Results Checker + Score Calc (tareas 5.5/5.6).
 *
 * Lo dispara Vercel Cron cada 5 min (ver vercel.json). Protegido con CRON_SECRET
 * (ARCHITECTURE §8). Idempotente: correrlo dos veces no duplica puntos (la RPC
 * `apply_match_results` hace el claim atómico de `processed`).
 *
 * También dispara las predicciones de bots (9.5) piggyback en esta invocación
 * (sin cron nuevo: Vercel limita la cantidad). Cada job tiene su try/catch:
 * que falle uno no bloquea al otro.
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

  let bots: BotPredictionsSummary | null = null;
  let botsError = false;
  try {
    bots = await runBotPredictions();
  } catch (err) {
    botsError = true;
    console.error("[cron/process-results] error en bots:", err);
    await sendAlert({ source: "cron/bot-predictions", error: err });
  }

  if (resultsError || botsError) {
    return NextResponse.json(
      { error: "Falló el procesamiento de resultados.", results, bots },
      { status: 500 },
    );
  }
  return NextResponse.json({ ...results, bots });
}
