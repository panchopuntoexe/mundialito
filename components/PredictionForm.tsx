"use client";

import { useEffect, useState } from "react";
import { GOALS_RANGE_VALUES } from "@/lib/validations/prediction";
import type { GoalsRange, ResultPred } from "@/types/domain";

/**
 * Formulario de pronóstico (tareas 4.4 y 4.5).
 *
 * 4.4 — selector de resultado (Local/Empate/Visitante; en knockout sin empate).
 * El rango de goles es opcional y va en una sección colapsable (bonus +15 pts).
 * 4.5 — tras confirmar (o tras el kickoff) el form se BLOQUEA y muestra el
 * pronóstico hecho. Antes del kickoff se puede reabrir con "Editar" (la RLS
 * permite editar hasta el kickoff; el server re-valida la ventana igual).
 */

interface SavedPrediction {
  result_pred: ResultPred;
  goals_range_pred: GoalsRange | null;
}

const GOALS_LABELS: Record<GoalsRange, string> = {
  "0-1": "0-1",
  "2-3": "2-3",
  "4-5": "4-5",
  "6+": "6+",
};

const GOALS_EXPLANATION =
  "Sumá los goles de local y visitante durante el partido (90 min + alargue). " +
  "Los penales no cuentan. Si acertás quién gana y el rango de goles, sumás 15 pts extra.";

export function PredictionForm({
  matchId,
  kickoffAt,
  isKnockout,
  homeTeam,
  awayTeam,
  initialPrediction,
}: {
  matchId: number;
  kickoffAt: string;
  isKnockout: boolean;
  homeTeam: string;
  awayTeam: string;
  initialPrediction: SavedPrediction | null;
}) {
  const kickoffMs = new Date(kickoffAt).getTime();

  const [closed, setClosed] = useState(() => Date.now() >= kickoffMs);
  const [saved, setSaved] = useState<SavedPrediction | null>(initialPrediction);
  const [editing, setEditing] = useState(
    () => !initialPrediction && Date.now() < kickoffMs,
  );

  const [result, setResult] = useState<ResultPred | null>(
    initialPrediction?.result_pred ?? null,
  );
  const [goals, setGoals] = useState<GoalsRange | null>(
    initialPrediction?.goals_range_pred ?? null,
  );
  const [showGoals, setShowGoals] = useState(
    () => !!initialPrediction?.goals_range_pred,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cierra el form al llegar el kickoff si la página queda abierta. Si ya pasó,
  // `closed` ya se inicializó en true (lazy init), así que no hace falta tocarlo.
  useEffect(() => {
    const remaining = kickoffMs - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      setClosed(true);
      setEditing(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [kickoffMs]);

  const resultOptions: { value: ResultPred; label: string }[] = isKnockout
    ? [
        { value: "home", label: homeTeam },
        { value: "away", label: awayTeam },
      ]
    : [
        { value: "home", label: homeTeam },
        { value: "draw", label: "Empate" },
        { value: "away", label: awayTeam },
      ];

  const resultLabel = (value: ResultPred) =>
    value === "home" ? homeTeam : value === "away" ? awayTeam : "Empate";

  function openEdit() {
    setShowGoals(!!saved?.goals_range_pred);
    setEditing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!result) {
      setError("Elegí quién gana.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          result_pred: result,
          goals_range_pred: goals,
        }),
      });
      const data: {
        error?: string;
        streak?: { current_streak: number; completed_today: boolean };
      } = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setSaved({ result_pred: result, goals_range_pred: goals });
        setEditing(false);
        // Al completar TODOS los partidos abiertos del día, avisamos al
        // celebrador global (confeti + atajo a Estadísticas). El dedupe por día
        // vive en <DayCompleteCelebration/>: editar luego no re-dispara.
        if (data.streak?.completed_today) {
          window.dispatchEvent(
            new CustomEvent("mundialito:day-complete", {
              detail: { currentStreak: data.streak.current_streak },
            }),
          );
        }
        return;
      }
      if (res.status === 409) {
        setClosed(true);
        setEditing(false);
      }
      setError(data.error ?? "No se pudo guardar el pronóstico.");
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Estado bloqueado (4.5): pronóstico hecho o ventana cerrada ──────
  if (!editing) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        {saved ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="text-xs text-foreground-muted">
                {closed ? "Tu pronóstico" : "Ya pronosticaste"}
              </span>
              <span className="font-semibold">
                {resultLabel(saved.result_pred)}
                {saved.goals_range_pred && (
                  <span className="text-foreground-muted">
                    {" "}
                    · {GOALS_LABELS[saved.goals_range_pred]} goles
                  </span>
                )}
              </span>
            </div>
            {closed ? (
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground-muted">
                Cerrado
              </span>
            ) : (
              <button
                type="button"
                onClick={openEdit}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
              >
                Editar
              </button>
            )}
          </div>
        ) : closed ? (
          <p className="text-sm text-foreground-muted">
            Cerrado — no pronosticaste este partido.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium text-foreground-muted transition hover:border-brand/40 hover:text-foreground"
          >
            Hacer pronóstico
          </button>
        )}
      </div>
    );
  }

  // ── Form editable (4.4) ────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="mt-3 border-t border-border pt-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
          ¿Quién gana?
        </legend>
        <div
          className={`grid gap-1.5 ${isKnockout ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {resultOptions.map((opt) => (
            <SegmentButton
              key={opt.value}
              active={result === opt.value}
              onClick={() => setResult(opt.value)}
              label={opt.label}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowGoals((open) => !open)}
          aria-expanded={showGoals}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-left text-xs font-medium text-foreground-muted transition hover:text-foreground"
        >
          <span>
            {showGoals
              ? "Ocultar bonus de goles"
              : "Bonus: pronosticar goles (+15 pts)"}
          </span>
          <span aria-hidden="true" className="text-foreground-muted">
            {showGoals ? "▲" : "▼"}
          </span>
        </button>

        {showGoals && (
          <fieldset className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-surface-muted/50 p-3">
            <legend className="sr-only">Rango de goles totales (opcional)</legend>
            <p className="text-[11px] leading-relaxed text-foreground-muted">
              {GOALS_EXPLANATION}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {GOALS_RANGE_VALUES.map((range) => (
                <SegmentButton
                  key={range}
                  active={goals === range}
                  onClick={() => setGoals(range)}
                  label={GOALS_LABELS[range]}
                />
              ))}
            </div>
            {goals && (
              <button
                type="button"
                onClick={() => setGoals(null)}
                className="self-start text-[11px] text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Quitar pronóstico de goles
              </button>
            )}
          </fieldset>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!result || submitting || closed}
        className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
      >
        {submitting ? "Guardando…" : "Confirmar pronóstico"}
      </button>
    </form>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`truncate rounded-lg border px-2 py-2 text-xs font-medium transition ${
        active
          ? "border-brand bg-brand/15 text-foreground"
          : "border-border bg-surface-muted text-foreground-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
