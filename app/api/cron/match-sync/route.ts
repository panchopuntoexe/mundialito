import { NextResponse } from "next/server";
import { sendAlert } from "@/lib/alerts/send";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runMatchSync } from "@/jobs/matchSync";

/**
 * GET /api/cron/match-sync — Cron Match Sync (tarea 5.4).
 *
 * Lo dispara Vercel Cron cada minuto (ver vercel.json). Protegido con CRON_SECRET
 * (ARCHITECTURE §8): sin el header correcto → 401, nadie lo gatilla desde afuera.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const summary = await runMatchSync();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron/match-sync] error:", err);
    await sendAlert({ source: "cron/match-sync", error: err });
    return NextResponse.json(
      { error: "Falló la sincronización de partidos." },
      { status: 500 },
    );
  }
}
