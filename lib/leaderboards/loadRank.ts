import { liveRank, type LiveRank } from "@/lib/leaderboards/rank";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Posición del usuario en el ranking global por puntos.
 *
 * Mismo enfoque que `lib/wrapped/liveStats`: dos COUNTs indexados en vez del
 * leaderboard cacheado (que corta en el top 100 y dejaría sin posición a quien
 * esté fuera de él). `liveRank` garantiza la misma semántica de empates que
 * `assignRanks`. Cliente admin para contar a todos los usuarios (no es dato
 * sensible: solo cardinalidades).
 */
export async function loadUserRank(points: number): Promise<LiveRank> {
  const admin = createAdminClient();
  const [higherRes, positiveRes] = await Promise.all([
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .gt("total_points", points),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .gt("total_points", 0),
  ]);
  return liveRank({
    higherCount: higherRes.count ?? 0,
    positiveCount: positiveRes.count ?? 0,
    points,
  });
}
