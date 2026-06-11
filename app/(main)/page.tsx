import { AdSlot } from "@/components/ads/AdSlot";
import { DayCompleteCelebration } from "@/components/DayCompleteCelebration";
import {
  MatchCard,
  type MatchCardData,
  type MatchCardPrediction,
} from "@/components/MatchCard";
import { AD_SLOTS } from "@/lib/ads/config";
import { PushOptIn } from "@/components/PushOptIn";
import { UpcomingMatches } from "@/components/UpcomingMatches";
import {
  nextDay,
  tournamentDayRangeUtc,
  tournamentToday,
} from "@/lib/matches/day";
import { TOURNAMENT_TIME_ZONE } from "@/lib/scoring/streaks";
import { createClient } from "@/lib/supabase/server";

/**
 * Home de la app principal (tarea 4.4): los partidos del día con su formulario de
 * pronóstico. "Día" en la TZ fija del torneo (CONTEXT.md "Partido del día").
 *
 * Server Component: trae los partidos de hoy y los pronósticos PROPIOS del
 * usuario en un solo render, y delega la interactividad a las islas de cliente
 * (PredictionForm / Consensus). La ventana de pronóstico la re-valida el endpoint
 * (regla de arquitectura 3); acá la UI solo refleja el estado.
 */

const MATCH_COLUMNS =
  "id, home_team, away_team, home_flag, away_flag, phase, macro_round, kickoff_at, status, score_home, score_away, winner_team";

function dayLabel(day: string): string {
  // Mediodía UTC del día para evitar bordes de TZ al formatear la fecha.
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat("es", {
    timeZone: TOURNAMENT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export default async function Home() {
  const today = tournamentToday();
  const { startUtc, endUtc } = tournamentDayRangeUtc(today);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matchesData } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .gte("kickoff_at", startUtc)
    .lt("kickoff_at", endUtc)
    .order("kickoff_at", { ascending: true });

  const matches: MatchCardData[] = matchesData ?? [];

  // "Lo que se viene": partidos de mañana y pasado mañana (preview read-only).
  // Todos con kickoff futuro → ninguno bloqueado; no llevan formulario.
  const tomorrow = nextDay(today);
  const dayAfter = nextDay(tomorrow);
  const { startUtc: upcomingStart } = tournamentDayRangeUtc(tomorrow);
  const { endUtc: upcomingEnd } = tournamentDayRangeUtc(dayAfter);

  const { data: upcomingData } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .gte("kickoff_at", upcomingStart)
    .lt("kickoff_at", upcomingEnd)
    .order("kickoff_at", { ascending: true });

  const upcoming: MatchCardData[] = upcomingData ?? [];

  // Pronósticos propios de los partidos de hoy (RLS: solo los del usuario).
  // Incluye los campos de scoring (5.5) para mostrar acierto/puntos y la
  // mini-tarjeta compartible (7.5) cuando el partido ya fue procesado.
  const predByMatch = new Map<number, MatchCardPrediction>();
  if (user && matches.length > 0) {
    const { data: preds } = await supabase
      .from("predictions")
      .select(
        "match_id, result_pred, goals_range_pred, result_correct, goals_correct, points_earned",
      )
      .eq("user_id", user.id)
      .in(
        "match_id",
        matches.map((m) => m.id),
      );
    for (const p of preds ?? []) {
      predByMatch.set(p.match_id, {
        result_pred: p.result_pred,
        goals_range_pred: p.goals_range_pred,
        result_correct: p.result_correct,
        goals_correct: p.goals_correct,
        points_earned: p.points_earned,
      });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold tracking-tight">Partidos de hoy</h1>
        <span className="text-xs capitalize text-foreground-muted">
          {dayLabel(today)}
        </span>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
          No hay partidos hoy. Volvé mañana para sostener tu racha. 🔥
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((match, idx) => (
            <li key={match.id}>
              <MatchCard
                match={match}
                prediction={predByMatch.get(match.id) ?? null}
                userId={user?.id ?? null}
              />
              {/* Un solo ad por día, tras la 2ª card y solo si hay ≥3 (11.3).
                  Con el flag apagado AdSlot es null: DOM idéntico a hoy. */}
              {idx === 1 && matches.length >= 3 && (
                <AdSlot slot={AD_SLOTS.home} className="mt-3" />
              )}
            </li>
          ))}
        </ul>
      )}

      <UpcomingMatches matches={upcoming} />

      <PushOptIn />
      <DayCompleteCelebration />
    </main>
  );
}
