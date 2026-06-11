import {
  assignRanks,
  assignRanksBy,
  type LeaderboardEntry,
  type RankedUser,
} from "@/lib/leaderboards/rankings";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Carga de leaderboards desde la DB (tareas 6.3 y 6.4). Server-only.
 *
 * Usa el cliente ADMIN: la RLS de `users` solo deja ver la fila propia, así que
 * leer nombres/puntos de TODOS para un ranking debe hacerse server-side con
 * service role (regla de arquitectura: nunca exponer datos de otros al cliente
 * sin pasar por el backend). El total de torneo (`users.total_points`) es la
 * fuente única tanto del ranking global como del de ligas.
 *
 * Estas funciones son el `fetcher` del cache-aside: las envuelve `cached(KEY,
 * TTL, ...)` en los endpoints (y en las páginas server, compartiendo la misma
 * clave de Redis). Quien INVALIDA estas claves es el cron de resultados (5.6).
 */

const TOP_LIMIT = 100;

/** Mínimo de pronósticos procesados para entrar al ranking de Precisión (evita
 * 100% con 1 acierto). */
const ACCURACY_MIN_PREDICTIONS = 10;

const SELECT = "id, username, display_name, avatar_url, total_points";

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
};

function toRanked(row: UserRow): RankedUser {
  return {
    user_id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    total_points: row.total_points,
  };
}

/** Top global: todos los usuarios por total de torneo (desc). */
export async function loadGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  console.info("[leaderboards] cache miss → leyendo top global de la DB");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("users")
    .select(SELECT)
    // Solo quien ya sumó: los invitados recién creados (modo "Jugar sin
    // cuenta") no inflan el top; el empty-state ya invita a pronosticar.
    .gt("total_points", 0)
    .order("total_points", { ascending: false })
    .order("username", { ascending: true }) // desempate determinista (estable en caché)
    .limit(TOP_LIMIT);
  if (error) {
    throw new Error(`[leaderboards] error leyendo top global: ${error.message}`);
  }

  return assignRanks((data ?? []).map(toRanked));
}

/**
 * Ranking de una liga: solo sus miembros, ordenados por total de torneo. La
 * membresía NO recorta el total — incluye lo acumulado antes de unirse
 * (CONTEXT.md "Liga"). El control de acceso (solo miembros) vive en el endpoint.
 */
export async function loadLeagueLeaderboard(
  leagueId: string,
): Promise<LeaderboardEntry[]> {
  console.info(`[leaderboards] cache miss → leyendo liga ${leagueId} de la DB`);
  const admin = createAdminClient();

  const { data: members, error: membersErr } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  if (membersErr) {
    throw new Error(
      `[leaderboards] error leyendo miembros de ${leagueId}: ${membersErr.message}`,
    );
  }

  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return [];

  const { data, error } = await admin
    .from("users")
    .select(SELECT)
    .in("id", memberIds)
    .order("total_points", { ascending: false })
    .order("username", { ascending: true });
  if (error) {
    throw new Error(
      `[leaderboards] error leyendo usuarios de la liga ${leagueId}: ${error.message}`,
    );
  }

  return assignRanks((data ?? []).map(toRanked));
}

/**
 * Ranking por % de aciertos: lee la vista `user_accuracy` (migración 0010) con un
 * mínimo de pronósticos, y completa nombre/puntos (para el nivel) desde `users`.
 */
export async function loadAccuracyLeaderboard(): Promise<LeaderboardEntry[]> {
  console.info("[leaderboards] cache miss → ranking por precisión");
  const admin = createAdminClient();

  const { data: acc, error } = await admin
    .from("user_accuracy")
    .select("user_id, total_predictions, accuracy")
    .gte("total_predictions", ACCURACY_MIN_PREDICTIONS)
    .order("accuracy", { ascending: false })
    .order("total_predictions", { ascending: false })
    .order("user_id", { ascending: true }) // desempate estable para la caché
    .limit(TOP_LIMIT);
  if (error) {
    throw new Error(`[leaderboards] error leyendo precisión: ${error.message}`);
  }

  const rows = (acc ?? []).filter(
    (r): r is { user_id: string; total_predictions: number; accuracy: number } =>
      r.user_id !== null,
  );
  if (rows.length === 0) return [];

  const { data: users, error: usersErr } = await admin
    .from("users")
    .select(SELECT)
    .in(
      "id",
      rows.map((r) => r.user_id),
    );
  if (usersErr) {
    throw new Error(
      `[leaderboards] error leyendo usuarios de precisión: ${usersErr.message}`,
    );
  }
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  // Mantiene el orden por precisión de la vista, descartando usuarios faltantes.
  const ranked: RankedUser[] = [];
  for (const r of rows) {
    const u = byId.get(r.user_id);
    if (u) ranked.push({ ...toRanked(u), accuracy: r.accuracy ?? 0 });
  }
  return assignRanksBy(ranked, (u) => u.accuracy ?? 0);
}

/** Ranking por racha máxima de participación (tabla `streaks` + datos de `users`). */
export async function loadStreakLeaderboard(): Promise<LeaderboardEntry[]> {
  console.info("[leaderboards] cache miss → ranking por racha");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("streaks")
    .select(
      "user_id, max_streak, users (id, username, display_name, avatar_url, total_points)",
    )
    .gte("max_streak", 1)
    .order("max_streak", { ascending: false })
    .order("user_id", { ascending: true }) // desempate estable para la caché
    .limit(TOP_LIMIT);
  if (error) {
    throw new Error(`[leaderboards] error leyendo racha: ${error.message}`);
  }

  const ranked: RankedUser[] = [];
  for (const row of data ?? []) {
    const u = row.users;
    if (!u) continue;
    ranked.push({
      user_id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      total_points: u.total_points,
      max_streak: row.max_streak,
    });
  }
  return assignRanksBy(ranked, (u) => u.max_streak ?? 0);
}
