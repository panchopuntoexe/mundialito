"use client";

import { useEffect, useRef, useState } from "react";
import { GOALS_RANGE_VALUES } from "@/lib/validations/prediction";
import type { GoalsRange, ResultPred } from "@/types/domain";

/**
 * Selector de pronóstico de UN TOQUE (rediseño de usabilidad; antes 4.4/4.5).
 *
 * Mientras el partido está abierto, los botones de resultado están SIEMPRE
 * visibles y tocar uno guarda al instante (UI optimista + POST debounced).
 * Re-tocar otro cambia el pronóstico — sin "Hacer pronóstico" ni "Confirmar"
 * ni "Editar". El bonus de goles sigue colapsable y también guarda al tocar.
 *
 * Al kickoff el selector se bloquea y muestra el pronóstico hecho; cuando el
 * cron procesa el partido (5.5), el badge "Cerrado" se reemplaza por el
 * veredicto (acierto/pleno con puntos, o fallo). El server re-valida la
 * ventana igual (regla de arquitectura 3).
 *
 * Eventos globales que emite:
 *  - `mundialito:prediction-saved` ({ matchId }) → actualiza <DayProgress/>.
 *  - `mundialito:day-complete` ({ currentStreak }) → confeti + hoja (igual que antes).
 */

interface SavedPrediction {
  result_pred: ResultPred;
  goals_range_pred: GoalsRange | null;
  /** Campos de scoring (5.5) — presentes solo si vino de la DB ya procesada. */
  result_correct?: boolean | null;
  goals_correct?: boolean | null;
  points_earned?: number | null;
}

const GOALS_LABELS: Record<GoalsRange, string> = {
  "0-1": "0-1",
  "2-3": "2-3",
  "4-5": "4-5",
  "6+": "6+",
};

const GOALS_EXPLANATION =
  "Suma los goles de local y visitante durante el partido (90 min + alargue). " +
  "Si aciertas quién gana y el rango de goles, sumas 15 pts extra. Los penales no cuentan.";

/** Espera entre el toque y el POST: si el usuario duda entre dos opciones,
 *  solo viaja la última (no quemamos el rate limit de 20/min). */
const SAVE_DEBOUNCE_MS = 350;

type SaveStatus = "idle" | "saving" | "saved";

export function PredictionForm({
  matchId,
  kickoffAt,
  isKnockout,
  homeTeam,
  awayTeam,
  homeFlag,
  awayFlag,
  initialPrediction,
}: {
  matchId: number;
  kickoffAt: string;
  isKnockout: boolean;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string | null;
  awayFlag: string | null;
  initialPrediction: SavedPrediction | null;
}) {
  const kickoffMs = new Date(kickoffAt).getTime();

  const [closed, setClosed] = useState(() => Date.now() >= kickoffMs);
  // Último pronóstico CONFIRMADO por el server; `result`/`goals` es lo elegido
  // en pantalla (optimista). Si el POST falla, se revierte a `saved`.
  const [saved, setSaved] = useState<SavedPrediction | null>(initialPrediction);
  const [result, setResult] = useState<ResultPred | null>(
    initialPrediction?.result_pred ?? null,
  );
  const [goals, setGoals] = useState<GoalsRange | null>(
    initialPrediction?.goals_range_pred ?? null,
  );
  const [showGoals, setShowGoals] = useState(
    () => !!initialPrediction?.goals_range_pred,
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lo último que el usuario eligió (el debounce manda SIEMPRE este valor).
  const pendingRef = useRef<{ result: ResultPred; goals: GoalsRange | null } | null>(
    null,
  );
  const savedRef = useRef<SavedPrediction | null>(initialPrediction);

  // Cierra el selector al llegar el kickoff si la página queda abierta. Si ya
  // pasó, `closed` ya se inicializó en true (lazy init).
  useEffect(() => {
    const remaining = kickoffMs - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setClosed(true), remaining);
    return () => clearTimeout(timer);
  }, [kickoffMs]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, []);

  async function flushSave() {
    const pending = pendingRef.current;
    if (!pending) return;
    const prev = savedRef.current;
    if (
      prev &&
      prev.result_pred === pending.result &&
      prev.goals_range_pred === pending.goals
    ) {
      setStatus("idle");
      return; // Nada cambió respecto a lo guardado.
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          result_pred: pending.result,
          goals_range_pred: pending.goals,
        }),
      });
      const data: {
        error?: string;
        streak?: { current_streak: number; completed_today: boolean };
      } = await res.json().catch(() => ({}));
      if (res.status === 201) {
        const confirmed: SavedPrediction = {
          result_pred: pending.result,
          goals_range_pred: pending.goals,
        };
        savedRef.current = confirmed;
        setSaved(confirmed);
        setStatus("saved");
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatus("idle"), 1500);
        window.dispatchEvent(
          new CustomEvent("mundialito:prediction-saved", {
            detail: { matchId },
          }),
        );
        // Al completar TODOS los partidos abiertos del día, avisamos al
        // celebrador global (confeti + atajo a Estadísticas). El dedupe por
        // día vive en <DayCompleteCelebration/>.
        if (data.streak?.completed_today) {
          window.dispatchEvent(
            new CustomEvent("mundialito:day-complete", {
              detail: { currentStreak: data.streak.current_streak },
            }),
          );
        }
        return;
      }
      // Falló: revertimos la elección optimista a lo último confirmado.
      setResult(savedRef.current?.result_pred ?? null);
      setGoals(savedRef.current?.goals_range_pred ?? null);
      setStatus("idle");
      if (res.status === 409) {
        setClosed(true);
        setError("El partido ya empezó; el pronóstico está cerrado.");
        return;
      }
      setError(data.error ?? "No se pudo guardar el pronóstico.");
    } catch {
      setResult(savedRef.current?.result_pred ?? null);
      setGoals(savedRef.current?.goals_range_pred ?? null);
      setStatus("idle");
      setError("Error de red. Intenta de nuevo.");
    }
  }

  /** Programa el guardado de la elección actual (optimista + debounce). */
  function scheduleSave(next: { result: ResultPred; goals: GoalsRange | null }) {
    setError(null);
    pendingRef.current = next;
    setStatus("saving");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
  }

  function pickResult(value: ResultPred) {
    if (closed) return;
    setResult(value);
    scheduleSave({ result: value, goals });
  }

  function pickGoals(value: GoalsRange | null) {
    if (closed) return;
    setGoals(value);
    // Sin resultado elegido el server rechaza el POST: guardamos la elección
    // local y viaja junto con el resultado cuando lo toque.
    if (result) scheduleSave({ result, goals: value });
  }

  // ── Estado bloqueado: kickoff pasado ────────────────────────────────
  if (closed) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        {saved ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="text-xs text-foreground-muted">
                Tu pronóstico
              </span>
              <span className="font-semibold">
                {saved.result_pred === "home"
                  ? homeTeam
                  : saved.result_pred === "away"
                    ? awayTeam
                    : "Empate"}
                {saved.goals_range_pred && (
                  <span className="text-foreground-muted">
                    {" "}
                    · {GOALS_LABELS[saved.goals_range_pred]} goles
                  </span>
                )}
              </span>
            </div>
            {saved.points_earned != null ? (
              saved.result_correct ? (
                <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand">
                  {saved.goals_correct ? "Pleno" : "Acertaste"} · +
                  {saved.points_earned} pts
                </span>
              ) : (
                <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-medium text-danger">
                  No acertaste
                </span>
              )
            ) : (
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground-muted">
                Cerrado
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">
            Cerrado — no pronosticaste este partido.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Selector de un toque (partido abierto) ──────────────────────────
  return (
    <div className="mt-3 border-t border-border pt-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
          <span>¿Quién gana? · toca y listo</span>
          <span aria-live="polite" className="normal-case tracking-normal">
            {status === "saving" ? (
              <span className="text-foreground-muted">Guardando…</span>
            ) : status === "saved" ? (
              <span className="font-semibold text-brand">✓ Guardado</span>
            ) : null}
          </span>
        </legend>
        <div
          className={`grid gap-1.5 ${isKnockout ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {(isKnockout
            ? ([
                { value: "home", label: homeTeam, flag: homeFlag },
                { value: "away", label: awayTeam, flag: awayFlag },
              ] as const)
            : ([
                { value: "home", label: homeTeam, flag: homeFlag },
                { value: "draw", label: "Empate", flag: null },
                { value: "away", label: awayTeam, flag: awayFlag },
              ] as const)
          ).map((opt) => (
            <ResultPickButton
              key={opt.value}
              active={result === opt.value}
              onClick={() => pickResult(opt.value)}
              label={opt.label}
              flag={opt.flag}
            />
          ))}
        </div>
        {isKnockout && (
          <p className="text-[11px] text-foreground-muted">
            Eliminación directa: no hay empate.
          </p>
        )}
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
                  onClick={() => pickGoals(range)}
                  label={GOALS_LABELS[range]}
                />
              ))}
            </div>
            {goals && !result && (
              <p className="text-[11px] text-foreground-muted">
                Elige quién gana y el bonus se guarda junto.
              </p>
            )}
            {goals && (
              <button
                type="button"
                onClick={() => pickGoals(null)}
                className="self-start py-1.5 text-[11px] text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
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
    </div>
  );
}

function ResultPickButton({
  active,
  onClick,
  label,
  flag,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  flag: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 transition-all ${
        active
          ? "border-brand bg-brand/20 text-foreground shadow-[0_0_14px_rgba(34,197,94,0.3)] ring-2 ring-brand/50"
          : "border-border bg-surface-muted text-foreground hover:border-brand/40 hover:bg-brand/10"
      }`}
    >
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flag}
          alt=""
          width={36}
          height={36}
          className={`h-9 w-9 shrink-0 rounded-md object-cover shadow-md ${
            active ? "ring-2 ring-white/30" : ""
          }`}
        />
      ) : (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-md text-lg"
          aria-hidden
        >
          🟰
        </span>
      )}
      <span className="w-full truncate text-center text-xs font-bold leading-tight">
        {label}
      </span>
    </button>
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
          ? "border-brand bg-brand/20 text-foreground"
          : "border-border bg-surface-muted text-foreground-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
