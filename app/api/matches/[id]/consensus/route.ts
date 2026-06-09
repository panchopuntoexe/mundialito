import { NextResponse } from "next/server";
import { cached } from "@/lib/redis/client";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { RESULT_PRED_VALUES } from "@/lib/validations/prediction";
import type { ResultPred } from "@/types/domain";

/**
 * GET /api/matches/[id]/consensus — distribución de pronósticos (tarea 4.6).
 *
 * El consenso de la comunidad (% por opción) se revela SOLO después del kickoff
 * (CONTEXT.md: el pronóstico es secreto hasta que empieza el partido). Antes del
 * kickoff devuelve `{ available: false }`.
 *
 * Caché (ARCHITECTURE §5): tras el kickoff la RLS bloquea nuevos pronósticos, así
 * que la distribución queda CONGELADA — se cachea en `consensus:{id}` (TTL 5 min)
 * sin riesgo de servir datos viejos. El conteo lo hace el cliente admin con
 * `head: true` (solo cuenta, no transfiere filas).
 */

const CONSENSUS_TTL_SECONDS = 300; // 5 min

interface Consensus {
  total: number;
  counts: Record<ResultPred, number>;
  percentages: Record<ResultPred, number>;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const matchId = Number(rawId);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "id inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id, kickoff_at")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr) {
    console.error("[api/matches/consensus] error leyendo match:", matchErr);
    return NextResponse.json(
      { error: "No se pudo leer el partido." },
      { status: 500 },
    );
  }
  if (!match) {
    return NextResponse.json({ error: "Partido inexistente." }, { status: 404 });
  }

  // Solo después del kickoff (la distribución es secreta hasta que arranca).
  if (new Date(match.kickoff_at).getTime() > Date.now()) {
    return NextResponse.json({ available: false });
  }

  try {
    const consensus = await cached(
      `consensus:${matchId}`,
      CONSENSUS_TTL_SECONDS,
      () => computeConsensus(matchId),
    );
    return NextResponse.json({ available: true, ...consensus });
  } catch (err) {
    console.error("[api/matches/consensus] GET error:", err);
    return NextResponse.json(
      { error: "No se pudo calcular el consenso." },
      { status: 500 },
    );
  }
}

/** Cuenta los pronósticos del partido por opción de resultado. */
async function computeConsensus(matchId: number): Promise<Consensus> {
  const admin = createAdminClient();

  const entries = await Promise.all(
    RESULT_PRED_VALUES.map(async (value) => {
      const { count, error } = await admin
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("match_id", matchId)
        .eq("result_pred", value);
      if (error) throw new Error(error.message);
      return [value, count ?? 0] as const;
    }),
  );

  const counts = Object.fromEntries(entries) as Record<ResultPred, number>;
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  const percentages = Object.fromEntries(
    entries.map(([value, c]) => [
      value,
      total === 0 ? 0 : Math.round((c / total) * 100),
    ]),
  ) as Record<ResultPred, number>;

  return { total, counts, percentages };
}
