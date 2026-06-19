import { Consensus } from "@/components/Consensus";
import { CountdownToKickoff } from "@/components/CountdownToKickoff";
import { KickoffTime } from "@/components/KickoffTime";
import { MatchResultCard } from "@/components/MatchResultCard";
import { PredictionForm } from "@/components/PredictionForm";
import { RefreshMatchButton } from "@/components/RefreshMatchButton";
import type { MatchStatus, ResultPred } from "@/types/domain";

/**
 * Tarjeta de un partido del día (tarea 4.4). Presentacional (server-component):
 * muestra equipos, fase y hora (o el marcador si el partido está en vivo o
 * terminó), y monta el `PredictionForm` (interactivo), el `Consensus`
 * (post-kickoff) y la mini-tarjeta compartible (7.5, post-procesamiento) como
 * islas de cliente.
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
  score_home: number | null;
  score_away: number | null;
  /** "home" | "away" en knockout (la DB lo guarda como text); null en grupos. */
  winner_team: string | null;
}

export interface MatchCardPrediction {
  result_pred: ResultPred;
  home_goals_pred: number | null;
  away_goals_pred: number | null;
  result_correct: boolean | null;
  goals_correct: boolean | null;
  points_earned: number | null;
}

const PHASE_LABELS: Record<string, string> = {
  round_32: "Dieciseisavos",
  round_16: "Octavos",
  quarter: "Cuartos",
  semi: "Semifinal",
  third_place: "Tercer puesto",
  final: "Final",
};

export function phaseLabel(phase: string): string {
  if (phase.startsWith("group_")) {
    return `Grupo ${phase.slice("group_".length).toUpperCase()}`;
  }
  return PHASE_LABELS[phase] ?? phase;
}

export function MatchCard({
  match,
  prediction,
  userId,
  refUsername = null,
}: {
  match: MatchCardData;
  prediction: MatchCardPrediction | null;
  userId: string | null;
  /** Username del usuario para atribuir el referral al compartir el resultado (A5). */
  refUsername?: string | null;
}) {
  const isKnockout = match.macro_round !== "group_stage";
  const hasScore =
    (match.status === "live" || match.status === "finished") &&
    match.score_home !== null &&
    match.score_away !== null;
  // La mini-tarjeta (7.5) aparece recién cuando el cron procesó el partido
  // (points_earned poblado), no apenas termina: la imagen incluye los puntos.
  const showResultCard =
    match.status === "finished" &&
    userId !== null &&
    prediction !== null &&
    prediction.points_earned !== null;

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-foreground-muted">
        <span>{phaseLabel(match.phase)}</span>
        <div className="flex items-center gap-2">
          {match.status === "live" ? (
            <span className="flex items-center gap-1.5 font-semibold text-brand">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden />
              En vivo
            </span>
          ) : match.status === "finished" ? (
            <span className="font-semibold">Final</span>
          ) : (
            <KickoffTime kickoffAt={match.kickoff_at} />
          )}
          <RefreshMatchButton />
        </div>
      </div>

      {/* Urgencia: cuando un partido abierto está por empezar (<2h), un chip que
          cuenta hacia atrás empuja a pronosticar antes del cierre. Se auto-oculta
          si falta más tiempo (el componente devuelve null). */}
      {match.status !== "live" && match.status !== "finished" && (
        <CountdownToKickoff
          kickoffAt={match.kickoff_at}
          className="mb-3 inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent"
        />
      )}

      {/* La cabecera de equipos solo aparece cuando hay marcador (en vivo /
          terminado): ahí los botones del PredictionForm ya no están. En un
          partido abierto los botones muestran bandera + nombre, así que repetir
          los equipos arriba sobra y confunde — quedan solo grupo y hora. */}
      {hasScore && (
        <div className="flex items-center justify-between gap-3">
          <Team flag={match.home_flag} name={match.home_team} />
          <span className="shrink-0 text-xl font-bold tabular-nums">
            {match.score_home} - {match.score_away}
          </span>
          <Team flag={match.away_flag} name={match.away_team} align="right" />
        </div>
      )}

      {/* En knockout con empate, el marcador no dice quién pasa: lo aclara
          winner_team (definido por penales). */}
      {hasScore &&
        match.winner_team !== null &&
        match.score_home === match.score_away && (
          <p className="mt-1 text-center text-xs text-foreground-muted">
            Avanza{" "}
            <span className="font-semibold text-foreground">
              {match.winner_team === "home" ? match.home_team : match.away_team}
            </span>{" "}
            por penales
          </p>
        )}

      <PredictionForm
        matchId={match.id}
        kickoffAt={match.kickoff_at}
        isKnockout={isKnockout}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        homeFlag={match.home_flag}
        awayFlag={match.away_flag}
        initialPrediction={prediction}
      />

      <Consensus
        matchId={match.id}
        kickoffAt={match.kickoff_at}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        userPick={prediction?.result_pred ?? null}
      />

      {showResultCard && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            Tu tarjeta del partido
          </p>
          <MatchResultCard
            matchId={match.id}
            userId={userId}
            homeTeam={match.home_team}
            awayTeam={match.away_team}
            pointsEarned={prediction.points_earned ?? 0}
            refUsername={refUsername}
          />
        </div>
      )}
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
