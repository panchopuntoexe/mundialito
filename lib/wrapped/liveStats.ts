import { createAdminClient } from "@/lib/supabase/server";
import type { LiveStatsCardData } from "./liveStatsCard";
import { toLiveStatsCardData } from "./liveStatsData";

/**
 * Carga de las stats en vivo de un usuario para su tarjeta compartible.
 * Server-only (cliente admin, mismo contrato que lib/profiles/load.ts).
 *
 * No reusa `loadPublicProfile`: ese carga por username, no trae la racha
 * ACTUAL ni los aciertos absolutos, y arrastra logros que la tarjeta no usa.
 * La posición en el ranking se resuelve con dos COUNTs indexados en vez de
 * deserializar el leaderboard cacheado (que además corta en el top 100) —
 * `liveRank` garantiza la misma semántica de empates que `assignRanks`.
 * El ensamble puro vive en liveStatsData.ts (testeable sin DB).
 */

/** Las stats en vivo de `userId`, o null si el usuario no existe. */
export async function loadLiveStats(
  userId: string,
): Promise<LiveStatsCardData | null> {
  const admin = createAdminClient();

  const { data: user, error } = await admin
    .from("users")
    .select("username, total_points")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `[liveStats] error leyendo usuario ${userId}: ${error.message}`,
    );
  }
  if (!user) return null;

  const [accuracyRes, streakRes, higherRes, positiveRes] = await Promise.all([
    admin
      .from("user_accuracy")
      .select("accuracy, total_predictions, correct_predictions")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .gt("total_points", user.total_points),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .gt("total_points", 0),
  ]);
  const failed =
    accuracyRes.error ?? streakRes.error ?? higherRes.error ?? positiveRes.error;
  if (failed) {
    throw new Error(
      `[liveStats] error leyendo stats de ${userId}: ${failed.message}`,
    );
  }

  return toLiveStatsCardData({
    username: user.username,
    totalPoints: user.total_points,
    accuracy: accuracyRes.data,
    currentStreak: streakRes.data?.current_streak ?? null,
    higherCount: higherRes.count ?? 0,
    positiveCount: positiveRes.count ?? 0,
  });
}
