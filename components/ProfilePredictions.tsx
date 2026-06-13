import { FaCheck, FaXmark } from "react-icons/fa6";
import { phaseLabel } from "@/components/MatchCard";
import type { ProfilePrediction } from "@/lib/profiles/load";

/**
 * Historial público de pronósticos: por cada partido que ya arrancó, el
 * pronóstico del usuario junto al marcador real. Server-component presentacional
 * (sin estado): los datos los trae `loadProfilePredictions` (solo partidos
 * live/finished, para no filtrar picks antes del kickoff).
 *
 * El marcador real va al centro; debajo, el pronóstico del usuario con un check/
 * cross según haya acertado el resultado, la etiqueta "exacto" si clavó ambos
 * goles, y los puntos ganados (cuando el cron ya procesó el partido).
 */
export function ProfilePredictions({
  predictions,
}: {
  predictions: ProfilePrediction[];
}) {
  if (predictions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm text-foreground-muted">
        Todavía no tiene pronósticos con resultado.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {predictions.map((p) => (
        <li key={p.match_id}>
          <PredictionRow prediction={p} />
        </li>
      ))}
    </ul>
  );
}

function PredictionRow({ prediction: p }: { prediction: ProfilePrediction }) {
  const hasScore = p.score_home !== null && p.score_away !== null;
  const hasPredScore =
    p.home_goals_pred !== null && p.away_goals_pred !== null;
  const isTie = hasScore && p.score_home === p.score_away;

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-foreground-muted">
        <span>{phaseLabel(p.phase)}</span>
        {p.status === "live" ? (
          <span className="flex items-center gap-1.5 font-semibold text-brand">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand"
              aria-hidden
            />
            En vivo
          </span>
        ) : (
          <span className="font-semibold">Final</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Team flag={p.home_flag} name={p.home_team} />
        <span className="shrink-0 text-xl font-bold tabular-nums">
          {hasScore ? `${p.score_home} - ${p.score_away}` : "–"}
        </span>
        <Team flag={p.away_flag} name={p.away_team} align="right" />
      </div>

      {p.winner_team !== null && isTie && (
        <p className="mt-1 text-center text-xs text-foreground-muted">
          Avanza{" "}
          <span className="font-semibold text-foreground">
            {p.winner_team === "home" ? p.home_team : p.away_team}
          </span>{" "}
          por penales
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {p.result_correct !== null &&
            (p.result_correct ? (
              <FaCheck aria-hidden className="shrink-0 text-brand" />
            ) : (
              <FaXmark aria-hidden className="shrink-0 text-danger" />
            ))}
          <span className="text-foreground-muted">Pronóstico:</span>
          <span className="font-semibold tabular-nums">
            {hasPredScore
              ? `${p.home_goals_pred} - ${p.away_goals_pred}`
              : resultLabel(p.result_pred, p.home_team, p.away_team)}
          </span>
          {p.goals_correct && (
            <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              Exacto
            </span>
          )}
        </div>

        {p.points_earned !== null && (
          <span className="shrink-0 text-sm font-bold tabular-nums text-brand">
            +{p.points_earned}
            <span className="ml-0.5 text-[11px] font-medium text-foreground-muted">
              pts
            </span>
          </span>
        )}
      </div>
    </article>
  );
}

/** Etiqueta del resultado pronosticado cuando no hay marcador exacto (legacy). */
function resultLabel(
  result: ProfilePrediction["result_pred"],
  homeTeam: string,
  awayTeam: string,
): string {
  if (result === "draw") return "Empate";
  return `Gana ${result === "home" ? homeTeam : awayTeam}`;
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
        <span
          className="h-6 w-6 shrink-0 rounded-sm bg-surface-muted"
          aria-hidden
        />
      )}
      <span className="truncate text-sm font-semibold">{name}</span>
    </div>
  );
}
