import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runProcessResults } from "@/jobs/processResults";

/**
 * GET /api/cron/process-results — Cron Results Checker + Score Calc (tareas 5.5/5.6).
 *
 * Lo dispara Vercel Cron cada 5 min (ver vercel.json). Protegido con CRON_SECRET
 * (ARCHITECTURE §8). Idempotente: correrlo dos veces no duplica puntos (la RPC
 * `apply_match_results` hace el claim atómico de `processed`).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const summary = await runProcessResults();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron/process-results] error:", err);
    return NextResponse.json(
      { error: "Falló el procesamiento de resultados." },
      { status: 500 },
    );
  }
}
