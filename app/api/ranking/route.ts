import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ACCURACY_LEADERBOARD_KEY,
  GLOBAL_LEADERBOARD_KEY,
  STREAK_LEADERBOARD_KEY,
} from "@/lib/leaderboards/keys";
import {
  loadAccuracyLeaderboard,
  loadGlobalLeaderboard,
  loadStreakLeaderboard,
} from "@/lib/leaderboards/load";
import type { LeaderboardEntry } from "@/lib/leaderboards/rankings";
import { cached } from "@/lib/redis/client";
import { getServerUser } from "@/lib/supabase/auth";

/**
 * GET /api/ranking?metric=points|accuracy|streak — ranking público filtrable.
 *
 * Cada métrica cachea su propia clave en Redis (TTL 5 min). El cron de resultados
 * invalida `global` y `accuracy` al sumar puntos; `streak` se refresca por TTL. Lo
 * usa el switch de pestañas de la sección Ranking (y el refetch en vivo de Puntos).
 */

const TTL_SECONDS = 300; // 5 min
const metricSchema = z.enum(["points", "accuracy", "streak"]);

function loadByMetric(
  metric: z.infer<typeof metricSchema>,
): Promise<LeaderboardEntry[]> {
  switch (metric) {
    case "accuracy":
      return cached(ACCURACY_LEADERBOARD_KEY, TTL_SECONDS, loadAccuracyLeaderboard);
    case "streak":
      return cached(STREAK_LEADERBOARD_KEY, TTL_SECONDS, loadStreakLeaderboard);
    default:
      return cached(GLOBAL_LEADERBOARD_KEY, TTL_SECONDS, loadGlobalLeaderboard);
  }
}

export async function GET(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = metricSchema.safeParse(searchParams.get("metric") ?? "points");
  if (!parsed.success) {
    return NextResponse.json({ error: "Métrica inválida." }, { status: 422 });
  }

  try {
    const leaderboard = await loadByMetric(parsed.data);
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("[api/ranking] GET error:", err);
    return NextResponse.json(
      { error: "No se pudo obtener el ranking." },
      { status: 500 },
    );
  }
}
