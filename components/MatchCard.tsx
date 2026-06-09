import { Consensus } from "@/components/Consensus";
import { PredictionForm } from "@/components/PredictionForm";
import { TOURNAMENT_TIME_ZONE } from "@/lib/scoring/streaks";
import type { GoalsRange, MatchStatus, ResultPred } from "@/types/domain";

/**
 * Tarjeta de un partido del día (tarea 4.4). Presentacional (server-component):
 * muestra equipos, fase y hora, y monta el `PredictionForm` (interactivo) y el
 * `Consensus` (post-kickoff) como islas de cliente.
 */

export interface MatchCardData {
  id: number;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  phase: string;
  macro_round: string;
  kickoff_at: string;
  status: MatchStatus;
}

export interface MatchCardPrediction {
  result_pred: ResultPred;
  goals_range_pred: GoalsRange;
}

const PHASE_LABELS: Record<string, string> = {
  round_32: "Dieciseisavos",
  round_16: "Octavos",
  quarter: "Cuartos",
  semi: "Semifinal",
  third_place: "Tercer puesto",
  final: "Final",
};

function phaseLabel(phase: string): string {
  if (phase.startsWith("group_")) {
    return `Grupo ${phase.slice("group_".length).toUpperCase()}`;
  }
  return PHASE_LABELS[phase] ?? phase;
}

function kickoffLabel(kickoffAt: string): string {
  return new Intl.DateTimeFormat("es", {
    timeZone: TOURNAMENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(kickoffAt));
}

export function MatchCard({
  match,
  prediction,
}: {
  match: MatchCardData;
  prediction: MatchCardPrediction | null;
}) {
  const isKnockout = match.macro_round !== "group_stage";

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-foreground-muted">
        <span>{phaseLabel(match.phase)}</span>
        <time dateTime={match.kickoff_at}>{kickoffLabel(match.kickoff_at)}</time>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Team flag={match.home_flag} name={match.home_team} />
        <span className="text-xs font-semibold text-foreground-muted">vs</span>
        <Team flag={match.away_flag} name={match.away_team} align="right" />
      </div>

      <PredictionForm
        matchId={match.id}
        kickoffAt={match.kickoff_at}
        isKnockout={isKnockout}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        initialPrediction={prediction}
      />

      <Consensus
        matchId={match.id}
        kickoffAt={match.kickoff_at}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
      />
    </article>
  );
}

function Team({
  flag,
  name,
  align = "left",
}: {
  flag: string | null;
  name: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {flag ? (
        // Banderas vienen como URL del proveedor; <img> simple basta acá.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flag}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-sm object-cover"
        />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-sm bg-surface-muted" aria-hidden />
      )}
      <span className="truncate text-sm font-semibold">{name}</span>
    </div>
  );
}
