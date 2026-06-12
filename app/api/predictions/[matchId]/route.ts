import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/predictions/[matchId] — el pronóstico PROPIO de un partido (tarea 4.3).
 *
 * Devuelve el pronóstico del usuario autenticado para ese partido, incluidas las
 * columnas de resultado (las puebla el cron de cálculo, 5.5; null hasta ahí), o
 * 404 si todavía no pronosticó. La RLS `predictions_select_own` ya garantiza que
 * solo se lee la fila propia.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId: rawMatchId } = await params;
  const matchId = Number(rawMatchId);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "matchId inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("predictions")
    .select(
      "id, match_id, result_pred, goals_range_pred, result_correct, goals_correct, points_earned, created_at",
    )
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) {
    console.error("[api/predictions/[matchId]] GET error:", error);
    return NextResponse.json(
      { error: "No se pudo leer el pronóstico." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "No tienes un pronóstico para este partido." },
      { status: 404 },
    );
  }

  return NextResponse.json({ prediction: data });
}
