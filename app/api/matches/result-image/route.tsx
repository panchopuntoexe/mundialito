/**
 * GET /api/matches/result-image — mini-tarjeta de resultado de un partido (7.5).
 *
 *  - `?match=<id>&user=<uuid>`: renderiza el resultado del partido y cómo le fue al
 *    usuario (cuadritos estilo Wordle + puntos). Disponible apenas el cron de
 *    resultados (5.5) procesa el partido (puntos calculados).
 *  - `?preview=1`: diseño con datos de muestra (verificación visual).
 *
 * Público/compartible por link (los pronósticos son públicos tras el kickoff): se
 * lee con el cliente admin. El render lo hace `renderMatchResultImage` (7.5).
 */
import { createAdminClient } from "@/lib/supabase/server";
import {
  renderMatchResultImage,
  SAMPLE_MATCH_RESULT,
} from "@/lib/wrapped/matchCard";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("preview")) {
    return renderMatchResultImage(SAMPLE_MATCH_RESULT);
  }

  const matchId = Number(searchParams.get("match"));
  const userId = searchParams.get("user");
  if (!Number.isInteger(matchId) || matchId <= 0 || !userId) {
    return new Response("Parámetros 'match' y 'user' requeridos.", {
      status: 400,
    });
  }

  const admin = createAdminClient();

  const { data: match, error: matchErr } = await admin
    .from("matches")
    .select("home_team, away_team, score_home, score_away, status")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr) {
    console.error("[api/matches/result-image] error leyendo partido:", matchErr);
    return new Response("No se pudo leer el partido.", { status: 500 });
  }
  if (
    !match ||
    match.status !== "finished" ||
    match.score_home === null ||
    match.score_away === null
  ) {
    return new Response("Resultado no disponible aún.", { status: 404 });
  }

  const { data: pred, error: predErr } = await admin
    .from("predictions")
    .select("result_correct, goals_correct, points_earned, users (username)")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();
  if (predErr) {
    console.error("[api/matches/result-image] error leyendo pronóstico:", predErr);
    return new Response("No se pudo leer el pronóstico.", { status: 500 });
  }
  // Sin pronóstico o aún sin procesar (points_earned null): no hay nada que mostrar.
  if (!pred || pred.points_earned === null) {
    return new Response("Pronóstico no disponible aún.", { status: 404 });
  }

  return renderMatchResultImage({
    username: pred.users?.username ?? "jugador",
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    scoreHome: match.score_home,
    scoreAway: match.score_away,
    resultCorrect: pred.result_correct ?? false,
    goalsCorrect: pred.goals_correct ?? false,
    pointsEarned: pred.points_earned,
  });
}
