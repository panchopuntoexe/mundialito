import { NextResponse } from "next/server";
import { sendAlert } from "@/lib/alerts/send";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runGenerateWrapped } from "@/jobs/generateWrapped";
import type { WrappedPhase } from "@/lib/scoring/wrappedStats";
import { WRAPPED_PHASE_LABELS } from "@/lib/wrapped/phases";

/**
 * GET /api/cron/generate-wrapped — Cron Wrapped Generator (tarea 7.3).
 *
 * Lo dispara Vercel Cron a diario (ver vercel.json): autodetecta las macro-rondas
 * completas y genera la tarjeta Wrapped de cada usuario que pronosticó en ellas.
 * Protegido con CRON_SECRET. Idempotente: unique(user_id, phase) evita duplicar.
 *
 * Disparo manual de una fase puntual: `?phase=group_stage` (o full_tournament).
 * Puede tardar (render de imágenes), de ahí el maxDuration extendido.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const phaseParam = new URL(request.url).searchParams.get("phase");
  let phase: WrappedPhase | undefined;
  if (phaseParam) {
    if (!(phaseParam in WRAPPED_PHASE_LABELS)) {
      return NextResponse.json({ error: "Fase inválida." }, { status: 400 });
    }
    phase = phaseParam as WrappedPhase;
  }

  try {
    const summary = await runGenerateWrapped(phase);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron/generate-wrapped] error:", err);
    await sendAlert({ source: "cron/generate-wrapped", error: err });
    return NextResponse.json(
      { error: "Falló la generación de Wrapped." },
      { status: 500 },
    );
  }
}
