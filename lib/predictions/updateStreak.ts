/**
 * Racha de participación — actualización compartida (tarea 9.4).
 *
 * Extraída tal cual del endpoint de pronósticos (4.2/5.2) para que humanos y
 * bots (9.5) avancen la racha por EL MISMO código. La racha vive acá y no en
 * el cron de resultados (ADR 0001): avanza al completar los partidos abiertos
 * del día, no al puntuar.
 *
 * Usa el cliente admin: la RLS de `streaks` solo permite lectura propia; la
 * escritura va por service role para que el cliente no pueda manipular su racha
 * (ver 0005_gamification.sql). Un fallo al persistir la racha NO lanza —el
 * pronóstico ya se guardó— pero se loguea.
 */
import { tournamentDayRangeUtc, tournamentToday } from "@/lib/matches/day";
import { isParticipationComplete } from "@/lib/predictions/participation";
import { advanceStreak, type StreakState } from "@/lib/scoring/streaks";
import { createAdminClient } from "@/lib/supabase/server";
import type { MacroRound } from "@/types/domain";

export interface StreakUpdateResult {
  current_streak: number;
  max_streak: number;
  completed_today: boolean;
}

export async function updateParticipationStreak(params: {
  userId: string;
  macroRound: MacroRound;
  now: Date;
}): Promise<StreakUpdateResult> {
  const admin = createAdminClient();
  const today = tournamentToday(params.now);
  const { startUtc, endUtc } = tournamentDayRangeUtc(today);

  // Partidos del día (TZ del torneo) + pronósticos del usuario en ellos.
  const { data: todaysMatches } = await admin
    .from("matches")
    .select("id, kickoff_at")
    .gte("kickoff_at", startUtc)
    .lt("kickoff_at", endUtc);

  const dayMatches = todaysMatches ?? [];
  let predictedMatchIds: number[] = [];
  if (dayMatches.length > 0) {
    const { data: preds } = await admin
      .from("predictions")
      .select("match_id")
      .eq("user_id", params.userId)
      .in(
        "match_id",
        dayMatches.map((m) => m.id),
      );
    predictedMatchIds = (preds ?? []).map((p) => p.match_id);
  }

  const completedToday = isParticipationComplete({
    todaysMatches: dayMatches,
    predictedMatchIds,
    now: params.now,
  });

  const { data: row } = await admin
    .from("streaks")
    .select(
      "current_streak, max_streak, freeze_available, last_participated_on, freeze_refilled_round",
    )
    .eq("user_id", params.userId)
    .maybeSingle();

  const currentState: StreakState = row ?? {
    current_streak: 0,
    max_streak: 0,
    freeze_available: true,
    last_participated_on: null,
    freeze_refilled_round: null,
  };

  const next = advanceStreak(currentState, {
    today,
    macroRound: params.macroRound,
    completedToday,
  });

  const { error } = await admin.from("streaks").upsert(
    {
      user_id: params.userId,
      current_streak: next.current_streak,
      max_streak: next.max_streak,
      freeze_available: next.freeze_available,
      last_participated_on: next.last_participated_on,
      freeze_refilled_round: next.freeze_refilled_round,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[updateStreak] error actualizando racha:", error);
  }

  return {
    current_streak: next.current_streak,
    max_streak: next.max_streak,
    completed_today: completedToday,
  };
}
