import { FaCheck, FaXmark } from "react-icons/fa6";
import { KickoffTime } from "@/components/KickoffTime";
import type { BracketCell as BracketCellData } from "@/lib/bracket/types";

/**
 * Una celda del cuadro de eliminación (presentacional, server component).
 *
 * Muestra los dos equipos (o "Por definir" si la ronda aún no se resolvió), el
 * marcador con los penales cuando los hubo (Feature "drama de penales") y, si hay
 * usuario, la marca de su pronóstico (✓/✗ resuelto, o el pick pendiente). Sin
 * formulario: el cuadro es solo lectura; se pronostica en "Hoy".
 */

const TBD = "Por definir";

export function BracketCell({
  cell,
  hasUser,
}: {
  cell: BracketCellData;
  hasUser: boolean;
}) {
  const hasScore =
    (cell.status === "live" || cell.status === "finished") &&
    cell.score_home !== null &&
    cell.score_away !== null;
  const tied = hasScore && cell.score_home === cell.score_away;
  const showPenalties =
    tied &&
    cell.winner_team !== null &&
    cell.penalty_home !== null &&
    cell.penalty_away !== null;

  return (
    <article className="rounded-lg border border-border bg-surface p-2.5">
      <div className="mb-1 flex items-center justify-end text-[10px] uppercase tracking-wide text-foreground-muted">
        {cell.status === "live" ? (
          <span className="flex items-center gap-1 font-semibold text-brand">
            <span className="h-1 w-1 animate-pulse rounded-full bg-brand" aria-hidden />
            En vivo
          </span>
        ) : cell.status === "finished" ? (
          <span className="font-semibold">Final</span>
        ) : (
          <KickoffTime kickoffAt={cell.kickoff_at} />
        )}
      </div>

      <TeamLine
        flag={cell.home_flag}
        name={cell.home_team}
        score={cell.score_home}
        hasScore={hasScore}
        winner={cell.winner_team === "home"}
      />
      <TeamLine
        flag={cell.away_flag}
        name={cell.away_team}
        score={cell.score_away}
        hasScore={hasScore}
        winner={cell.winner_team === "away"}
      />

      {showPenalties && (
        // Marcador de la tanda con el del ganador primero: "Penales 4-2".
        <p className="mt-1 text-[11px] text-foreground-muted">
          Penales{" "}
          <span className="font-semibold text-foreground">
            {cell.winner_team === "home"
              ? `${cell.penalty_home}-${cell.penalty_away}`
              : `${cell.penalty_away}-${cell.penalty_home}`}
          </span>
        </p>
      )}

      {hasUser && <PickMarker cell={cell} />}
    </article>
  );
}

function TeamLine({
  flag,
  name,
  score,
  hasScore,
  winner,
}: {
  flag: string | null;
  name: string;
  score: number | null;
  hasScore: boolean;
  winner: boolean;
}) {
  const tbd = name === TBD;
  return (
    <div className="flex items-center gap-2 py-0.5 text-sm">
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flag}
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px] shrink-0 rounded-sm object-cover"
        />
      ) : (
        <span className="h-[18px] w-[18px] shrink-0 rounded-sm bg-surface-muted" aria-hidden />
      )}
      <span
        className={`min-w-0 flex-1 truncate ${
          tbd
            ? "italic text-foreground-muted"
            : winner
              ? "font-bold"
              : "font-medium"
        }`}
      >
        {name}
      </span>
      {hasScore && (
        <span className={`shrink-0 tabular-nums ${winner ? "font-bold" : ""}`}>
          {score}
        </span>
      )}
    </div>
  );
}

/** Marca del pronóstico propio: ✓/✗ si ya se resolvió, o el pick pendiente. */
function PickMarker({ cell }: { cell: BracketCellData }) {
  const pred = cell.prediction;

  if (!pred) {
    // Sin pronóstico: solo lo señalamos si el partido aún se puede pronosticar
    // (programado y con ambos equipos definidos), para empujar a participar.
    if (
      cell.status === "scheduled" &&
      cell.home_team !== TBD &&
      cell.away_team !== TBD
    ) {
      return (
        <p className="mt-1 border-t border-border pt-1 text-[11px] font-medium text-accent">
          Sin pronóstico
        </p>
      );
    }
    return null;
  }

  const pickName =
    pred.result_pred === "home"
      ? cell.home_team
      : pred.result_pred === "away"
        ? cell.away_team
        : "Empate";

  // Resuelto: ✓ acierto / ✗ fallo.
  if (pred.result_correct !== null) {
    return (
      <p
        className={`mt-1 flex items-center gap-1 border-t border-border pt-1 text-[11px] ${
          pred.result_correct ? "text-brand" : "text-foreground-muted"
        }`}
      >
        {pred.result_correct ? (
          <FaCheck aria-hidden />
        ) : (
          <FaXmark aria-hidden />
        )}
        <span>
          Tu pick: <span className="font-semibold">{pickName}</span>
          {pred.result_correct && pred.points_earned !== null
            ? ` · +${pred.points_earned}`
            : ""}
        </span>
      </p>
    );
  }

  // Pendiente: muestra el pick (el partido todavía no se procesó).
  return (
    <p className="mt-1 border-t border-border pt-1 text-[11px] text-foreground-muted">
      Tu pick: <span className="font-semibold text-foreground">{pickName}</span>
    </p>
  );
}
