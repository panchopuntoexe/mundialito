/**
 * Listado y borrado de bots (tarea 9.6).
 *
 *   npm run bots:list     → tabla read-only (id, username, puntos, predicciones)
 *   npm run bots:delete   → borra TODOS los bots y su rastro completo
 *
 * El borrado va por `auth.admin.deleteUser`: auth.users cascadea a
 * public.users y de ahí a predictions/streaks/achievements/league_members
 * (todas las FK son on delete cascade). No hay nada que recomputar: los
 * puntos son por usuario, la precisión es una vista y los leaderboards se
 * reconstruyen en el próximo cache miss — igual se invalidan acá para que
 * los bots desaparezcan del ranking al instante, sin esperar el TTL.
 *
 * Cliente admin inline (mismo patrón que seed-bots.ts): lib/supabase/server.ts
 * arrastra next/headers. El cliente de Redis sí es importable (no usa Next).
 */
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";
import {
  ACCURACY_LEADERBOARD_KEY,
  GLOBAL_LEADERBOARD_KEY,
  STREAK_LEADERBOARD_KEY,
  leagueLeaderboardKey,
} from "@/lib/leaderboards/keys";
import { del } from "@/lib/redis/client";
import type { Database } from "@/types/database";

type Admin = ReturnType<typeof createClient<Database>>;

function adminClient(): Admin {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function loadBots(admin: Admin) {
  const { data, error } = await admin
    .from("users")
    .select("id, username, total_points")
    .eq("is_bot", true)
    .order("total_points", { ascending: false });
  if (error) throw new Error(`[bots] error leyendo bots: ${error.message}`);
  return data ?? [];
}

async function list(admin: Admin): Promise<void> {
  const bots = await loadBots(admin);
  if (bots.length === 0) {
    console.info("[bots:list] No hay bots.");
    return;
  }

  const { data: preds, error } = await admin
    .from("predictions")
    .select("user_id")
    .in(
      "user_id",
      bots.map((b) => b.id),
    );
  if (error) throw new Error(`[bots:list] error leyendo predicciones: ${error.message}`);
  const predCount = new Map<string, number>();
  for (const p of preds ?? []) {
    predCount.set(p.user_id, (predCount.get(p.user_id) ?? 0) + 1);
  }

  console.table(
    bots.map((b) => ({
      username: b.username,
      puntos: b.total_points,
      predicciones: predCount.get(b.id) ?? 0,
      id: b.id,
    })),
  );
  console.info(`[bots:list] ${bots.length} bots.`);
}

async function remove(admin: Admin): Promise<void> {
  const bots = await loadBots(admin);
  if (bots.length === 0) {
    console.info("[bots:delete] No hay bots que borrar.");
    return;
  }

  // Ligas afectadas ANTES de borrar (después no queda la membresía). Los bots
  // normalmente no están en ligas, pero si alguno entró, su caché también muere.
  const { data: memberships, error: memErr } = await admin
    .from("league_members")
    .select("league_id")
    .in(
      "user_id",
      bots.map((b) => b.id),
    );
  if (memErr) {
    throw new Error(`[bots:delete] error leyendo membresías: ${memErr.message}`);
  }
  const leagueIds = [...new Set((memberships ?? []).map((m) => m.league_id))];

  let deleted = 0;
  for (const bot of bots) {
    const { error } = await admin.auth.admin.deleteUser(bot.id);
    if (error) {
      throw new Error(
        `[bots:delete] falló el borrado de ${bot.username} (${bot.id}): ${error.message}. ` +
          `Borrados hasta ahora: ${deleted}. Re-correr para continuar.`,
      );
    }
    deleted++;
    console.info(`[bots:delete] ✗ ${bot.username}`);
  }

  const keys = [
    GLOBAL_LEADERBOARD_KEY,
    ACCURACY_LEADERBOARD_KEY,
    STREAK_LEADERBOARD_KEY,
    ...leagueIds.map(leagueLeaderboardKey),
  ];
  await del(...keys);

  console.info(
    `[bots:delete] OK — ${deleted} bots borrados (cascade total) y ${keys.length} claves de leaderboard invalidadas.`,
  );
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const admin = adminClient();
  if (mode === "list") return list(admin);
  if (mode === "delete") return remove(admin);
  throw new Error(`Modo desconocido "${mode}". Usar: list | delete.`);
}

main().catch((err: unknown) => {
  console.error("[bots] Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
