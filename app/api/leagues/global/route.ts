import { NextResponse } from "next/server";
import { GLOBAL_LEADERBOARD_KEY } from "@/lib/leaderboards/keys";
import { loadGlobalLeaderboard } from "@/lib/leaderboards/load";
import { cached } from "@/lib/redis/client";
import { getServerUser } from "@/lib/supabase/auth";

/**
 * GET /api/leagues/global — leaderboard global (tarea 6.3).
 *
 * Top de usuarios por total de torneo. Cacheado en Redis (`leaderboard:global`,
 * TTL 5 min); en un HIT el fetcher no corre. El cron de resultados invalida esta
 * clave al sumar puntos (5.6), así que el ranking refleja los partidos recién
 * procesados sin esperar a que expire el TTL.
 *
 * El middleware ya exige sesión; el chequeo de auth acá es defensa en profundidad
 * porque el ranking expone nombres/puntos de TODOS (lectura admin, sin RLS).
 */

const LEADERBOARD_TTL_SECONDS = 300; // 5 min

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const leaderboard = await cached(
      GLOBAL_LEADERBOARD_KEY,
      LEADERBOARD_TTL_SECONDS,
      loadGlobalLeaderboard,
    );
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("[api/leagues/global] GET error:", err);
    return NextResponse.json(
      { error: "No se pudo obtener el ranking global." },
      { status: 500 },
    );
  }
}
