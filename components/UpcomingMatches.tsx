import { phaseLabel } from "@/components/MatchCard";
import { nextDay, tournamentToday } from "@/lib/matches/day";
import { TOURNAMENT_TIME_ZONE, toTournamentDay } from "@/lib/scoring/streaks";

/**
 * Timeline "Lo que se viene": los partidos de mañana y pasado mañana en el Home.
 *
 * Read-only (preview): todos tienen kickoff futuro, así que ninguno está bloqueado
 * y no llevan formulario de pronóstico — solo dan visibilidad de lo que viene. El
 * "día" se agrupa en la TZ fija del torneo, igual que los partidos de hoy.
 */

interface UpcomingMatch {
  id: number;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  phase: string;
  kickoff_at: string;
}

function dayLabel(day: string, tomorrow: string): string {
  if (day === tomorrow) return "Mañana";
  // Mediodía UTC del día para evitar bordes de TZ al formatear la fecha.
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat("es", {
    timeZone: TOURNAMENT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function kickoffLabel(kickoffAt: string): string {
  return new Intl.DateTimeFormat("es", {
    timeZone: TOURNAMENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(kickoffAt));
}

/** Agrupa los partidos (ya ordenados por kickoff) por día del torneo. */
function groupByDay(
  matches: UpcomingMatch[],
): { day: string; matches: UpcomingMatch[] }[] {
  const groups: { day: string; matches: UpcomingMatch[] }[] = [];
  for (const match of matches) {
    const day = toTournamentDay(new Date(match.kickoff_at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.matches.push(match);
    } else {
      groups.push({ day, matches: [match] });
    }
  }
  return groups;
}

export function UpcomingMatches({ matches }: { matches: UpcomingMatch[] }) {
  if (matches.length === 0) return null;

  const tomorrow = nextDay(tournamentToday());
  const groups = groupByDay(matches);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold tracking-tight text-foreground-muted">
        Lo que se viene
      </h2>

      {groups.map((group) => (
        <div key={group.day} className="flex flex-col gap-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            {dayLabel(group.day, tomorrow)}
          </h3>
          <ul className="flex flex-col gap-3 border-l border-border pl-4">
            {group.matches.map((match) => (
              <li key={match.id} className="relative">
                <span
                  className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand"
                  aria-hidden
                />
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                  <time
                    dateTime={match.kickoff_at}
                    className="shrink-0 text-xs font-semibold tabular-nums text-foreground-muted"
                  >
                    {kickoffLabel(match.kickoff_at)}
                  </time>
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <Flag flag={match.home_flag} />
                    <span className="truncate font-medium">
                      {match.home_team}
                    </span>
                    <span className="shrink-0 text-xs text-foreground-muted">
                      vs
                    </span>
                    <Flag flag={match.away_flag} />
                    <span className="truncate font-medium">
                      {match.away_team}
                    </span>
                  </div>
                </div>
                <span className="mt-0.5 block pl-0 text-[11px] uppercase tracking-wide text-foreground-muted">
                  {phaseLabel(match.phase)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Flag({ flag }: { flag: string | null }) {
  if (!flag) {
    return (
      <span
        className="h-4 w-4 shrink-0 rounded-sm bg-surface-muted"
        aria-hidden
      />
    );
  }
  return (
    // Banderas vienen como URL del proveedor; <img> simple basta acá.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flag}
      alt=""
      width={16}
      height={16}
      className="h-4 w-4 shrink-0 rounded-sm object-cover"
    />
  );
}
