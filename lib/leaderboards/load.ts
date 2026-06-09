import {
  assignRanks,
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
