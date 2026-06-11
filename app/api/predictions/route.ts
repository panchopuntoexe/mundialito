import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/redis/client";
import { updateParticipationStreak } from "@/lib/predictions/updateStreak";
import { createClient } from "@/lib/supabase/server";
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

  // Rate limit (8.4): 20 pronósticos/min por usuario. Cubre pronosticar todos
  // los partidos del día sin fricción, pero frena scripts abusivos.
  const limit = await rateLimit(`predictions:${user.id}`, 20, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados pronósticos seguidos. Probá en unos segundos." },
      { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
    );
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
        goals_range_pred: input.goals_range_pred ?? null,
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
