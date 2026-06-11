import {
  ACHIEVEMENT_BY_TYPE,
  type AchievementType,
} from "@/lib/scoring/achievements";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Carga del perfil público de un usuario por username. Server-only.
 *
 * Usa el cliente ADMIN: la RLS de `users`/`user_accuracy`/`streaks`/
 * `achievements` solo deja ver la fila propia, y el perfil muestra datos de
 * OTRO usuario. Nunca importar este módulo desde un client component (mismo
 * contrato que lib/leaderboards/load.ts). Sin caché: lectura puntual por
 * username, sin el fan-out de los leaderboards.
 */

export interface PublicProfile {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  /** % de aciertos (0–100); 0 si aún no tiene pronósticos procesados. */
  accuracy: number;
  total_predictions: number;
  /** Racha máxima de participación en días; 0 si nunca arrancó una. */
  max_streak: number;
  earned: AchievementType[];
}

/** El perfil público de `username`, o null si no existe. */
export async function loadPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  const admin = createAdminClient();

  const { data: user, error } = await admin
    .from("users")
    .select("id, username, avatar_url, total_points")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    throw new Error(
      `[profiles] error leyendo usuario ${username}: ${error.message}`,
    );
  }
  if (!user) return null;

  const [accuracyRes, streakRes, achievementsRes] = await Promise.all([
    admin
      .from("user_accuracy")
      .select("accuracy, total_predictions")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("streaks")
      .select("max_streak")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("achievements").select("type").eq("user_id", user.id),
  ]);
  const failed = accuracyRes.error ?? streakRes.error ?? achievementsRes.error;
  if (failed) {
    throw new Error(
      `[profiles] error leyendo stats de ${username}: ${failed.message}`,
    );
  }

  // La columna `type` es text en la DB: filtrar contra las defs valida el cast.
  const earned = (achievementsRes.data ?? [])
    .map((r) => r.type)
    .filter((t): t is AchievementType => t in ACHIEVEMENT_BY_TYPE);

  return {
    user_id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    total_points: user.total_points,
    accuracy: accuracyRes.data?.accuracy ?? 0,
    total_predictions: accuracyRes.data?.total_predictions ?? 0,
    max_streak: streakRes.data?.max_streak ?? 0,
    earned,
  };
}
