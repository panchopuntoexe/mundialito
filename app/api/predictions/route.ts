import { NextResponse } from "next/server";
import { tournamentDayRangeUtc, tournamentToday } from "@/lib/matches/day";
import { isParticipationComplete } from "@/lib/predictions/participation";
import { advanceStreak, type StreakState } from "@/lib/scoring/streaks";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createPredictionSchema } from "@/lib/validations/prediction";
import type { MacroRound } from "@/types/domain";

/**
 * POST /api/predictions — crear/actualizar un pronóstico (tarea 4.2).
 *
 * Flujo (ARCHITECTURE §4.1):
 *  1. Auth + perfil (FK predictions.user_id → users.id).
 *  2. Zod valida el body { match_id, result_pred, goals_range_pred }.
 *  3. Lee el match y RE-VALIDA la ventana SERVER-SIDE (regla de arquitectura 3):
 *     kickoff_at > now() → si ya empezó, 409. La RLS lo reafirma en profundidad.
 *  4. Knockout + result_pred='draw' → 422 (no hay empate en eliminación directa).
 *  5. Upsert respetando el unique (user_id, match_id).
 *  6. Actualiza la RACHA de participación AQUÍ (ADR 0001), no en el cron de
 *     resultados. La racha avanza solo al completar los partidos abiertos del día.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // El perfil debe existir: predictions y streaks referencian users(id) por FK.
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Completá el onboarding antes de pronosticar." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = createPredictionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Pronóstico inválido." },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id, kickoff_at, macro_round")
    .eq("id", input.match_id)
    .maybeSingle();
  if (matchErr) {
    console.error("[api/predictions] error leyendo match:", matchErr);
    return NextResponse.json(
      { error: "No se pudo leer el partido." },
      { status: 500 },
    );
  }
  if (!match) {
    return NextResponse.json({ error: "Partido inexistente." }, { status: 404 });
  }

  const now = new Date();
  if (new Date(match.kickoff_at).getTime() <= now.getTime()) {
    return NextResponse.json(
      { error: "El partido ya empezó; el pronóstico está cerrado." },
      { status: 409 },
    );
  }

  const isKnockout = match.macro_round !== "group_stage";
  if (isKnockout && input.result_pred === "draw") {
    return NextResponse.json(
      { error: "No hay empate en partidos de eliminación directa." },
      { status: 422 },
    );
  }

  // Upsert: la RLS reafirma dueño + ventana de tiempo (defensa en profundidad).
  const { data: prediction, error: upsertErr } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: user.id,
        match_id: input.match_id,
        result_pred: input.result_pred,
        goals_range_pred: input.goals_range_pred,
      },
      { onConflict: "user_id,match_id" },
    )
    .select("id, match_id, result_pred, goals_range_pred")
    .single();
  if (upsertErr) {
    console.error("[api/predictions] error guardando pronóstico:", upsertErr);
    return NextResponse.json(
      { error: "No se pudo guardar el pronóstico." },
      { status: 500 },
    );
  }

  const streak = await updateParticipationStreak({
    userId: user.id,
    macroRound: match.macro_round as MacroRound,
    now,
  });

  return NextResponse.json({ prediction, streak }, { status: 201 });
}

/**
 * Actualiza la racha de PARTICIPACIÓN tras guardar un pronóstico (ADR 0001).
 *
 * Usa el cliente admin: la RLS de `streaks` solo permite lectura propia; la
 * escritura va por service role para que el cliente no pueda manipular su racha
 * (ver 0005_gamification.sql). Un fallo al persistir la racha NO tumba la request
 * —el pronóstico ya se guardó— pero se loguea.
 */
async function updateParticipationStreak(params: {
  userId: string;
  macroRound: MacroRound;
  now: Date;
}): Promise<{
  current_streak: number;
  max_streak: number;
  completed_today: boolean;
}> {
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
    console.error("[api/predictions] error actualizando racha:", error);
  }

  return {
    current_streak: next.current_streak,
    max_streak: next.max_streak,
    completed_today: completedToday,
  };
}
