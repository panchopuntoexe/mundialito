/**
 * Cron — Results Checker + Score Calc (tareas 5.5 y 5.6, ARCHITECTURE §4.3).
 *
 * Cada 5 min: por cada partido finalizado sin procesar
 *   1. calcula los puntos de cada pronóstico (lógica pura 5.1/5.5),
 *   2. los aplica de forma ATÓMICA e idempotente vía la RPC `apply_match_results`
 *      (suma a users.total_points + marca processed=true en una transacción),
 *   3. evalúa y otorga achievements (5.3) a los usuarios afectados,
 *   4. invalida la caché de leaderboards en Redis (5.6).
 *
 * Idempotente (regla de arquitectura 4): el claim de `processed` lo hace la RPC.
 * NO toca rachas (viven en el endpoint de pronóstico, 4.2/5.2 — ADR 0001).
 *
 * La lógica de scoring/agregación vive pura en `lib/scoring/*` (testeada); acá
 * solo el cableado con Supabase y Redis.
 */
import { evaluateAchievements } from "@/lib/scoring/achievements";
import {
  aggregateAchievementStats,
  buildMatchResults,
} from "@/lib/scoring/results";
import {
  GLOBAL_LEADERBOARD_KEY,
  leagueLeaderboardKey,
} from "@/lib/leaderboards/keys";
import { del } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { WinnerTeam } from "@/types/domain";

type Admin = ReturnType<typeof createAdminClient>;

export interface ProcessResultsSummary {
  /** Partidos cuyos puntos aplicó ESTA corrida (claim ganado). */
  processed: number;
  /** Partidos finalizados que se omitieron por no tener marcador aún. */
  skippedNoScore: number;
  /** Usuarios con puntos nuevos (se les re-evalúan logros). */
  usersAffected: number;
}

export async function runProcessResults(): Promise<ProcessResultsSummary> {
  const admin = createAdminClient();

  const { data: matches, error } = await admin
    .from("matches")
    .select("id, score_home, score_away, winner_team")
    .eq("status", "finished")
    .eq("processed", false);
  if (error) {
    throw new Error(`[processResults] error leyendo partidos: ${error.message}`);
  }

  const affectedUsers = new Set<string>();
  let processed = 0;
  let skippedNoScore = 0;

  for (const match of matches ?? []) {
    // Un finalizado sin marcador no se puede puntuar; se deja sin procesar para
    // reintentar cuando el sync (5.4) complete el score.
    if (match.score_home === null || match.score_away === null) {
      console.warn(`[processResults] match ${match.id} finalizado sin marcador; se omite.`);
      skippedNoScore += 1;
      continue;
    }

    const { data: preds, error: predErr } = await admin
      .from("predictions")
      .select("id, user_id, result_pred, goals_range_pred")
      .eq("match_id", match.id);
    if (predErr) {
      console.error(`[processResults] error leyendo predicciones de ${match.id}:`, predErr);
      continue;
    }

    const results = buildMatchResults(preds ?? [], {
      score_home: match.score_home,
      score_away: match.score_away,
      winner_team: match.winner_team as WinnerTeam,
    });

    const { data: claimed, error: rpcErr } = await admin.rpc("apply_match_results", {
      p_match_id: match.id,
      p_results: results as unknown as Json,
    });
    if (rpcErr) {
      console.error(`[processResults] error aplicando resultados de ${match.id}:`, rpcErr);
      continue;
    }
    if (claimed !== true) {
      // Otra corrida ya lo procesó: no-op idempotente.
      continue;
    }

    processed += 1;
    for (const r of results) affectedUsers.add(r.user_id);
  }

  // Logros: se derivan del estado ya persistido (idempotente vía unique).
  for (const userId of affectedUsers) {
    await grantAchievements(admin, userId);
  }

  // Invalidación de leaderboards (5.6): solo si hubo cambios de puntos.
  if (affectedUsers.size > 0) {
    await invalidateLeaderboards(admin, affectedUsers);
  }

  console.info(
    `[processResults] ${processed} partidos procesados, ${affectedUsers.size} usuarios afectados.`,
  );
  return { processed, skippedNoScore, usersAffected: affectedUsers.size };
}

/** Re-evalúa los logros de un usuario y otorga los nuevos (idempotente). */
async function grantAchievements(admin: Admin, userId: string): Promise<void> {
  const [preds, streak, user, earned] = await Promise.all([
    admin.from("predictions").select("result_correct, goals_correct").eq("user_id", userId),
    admin.from("streaks").select("max_streak").eq("user_id", userId).maybeSingle(),
    admin.from("users").select("total_points").eq("id", userId).maybeSingle(),
    admin.from("achievements").select("type").eq("user_id", userId),
  ]);

  const stats = aggregateAchievementStats({
    predictions: preds.data ?? [],
    maxStreak: streak.data?.max_streak ?? 0,
    totalPoints: user.data?.total_points ?? 0,
  });

  const newTypes = evaluateAchievements(
    stats,
    (earned.data ?? []).map((e) => e.type),
  );
  if (newTypes.length === 0) return;

  const { error } = await admin
    .from("achievements")
    .upsert(
      newTypes.map((type) => ({ user_id: userId, type })),
      { onConflict: "user_id,type", ignoreDuplicates: true },
    );
  if (error) {
    console.error(`[processResults] error otorgando logros a ${userId}:`, error);
  }
}

/** Borra el leaderboard global y el de cada liga de los usuarios afectados. */
async function invalidateLeaderboards(
  admin: Admin,
  affectedUsers: Set<string>,
): Promise<void> {
  const keys = [GLOBAL_LEADERBOARD_KEY];

  const { data: memberships, error } = await admin
    .from("league_members")
    .select("league_id")
    .in("user_id", [...affectedUsers]);
  if (error) {
    console.error("[processResults] error leyendo membresías para invalidar caché:", error);
  } else {
    const leagueIds = new Set((memberships ?? []).map((m) => m.league_id));
    for (const id of leagueIds) keys.push(leagueLeaderboardKey(id));
  }

  await del(...keys);
}
