"use client";

import { useEffect, useRef, useState } from "react";
import { FaEquals, FaMinus, FaPlus } from "react-icons/fa6";
import { MAX_GOALS_PER_TEAM } from "@/lib/validations/prediction";
import type { ResultPred } from "@/types/domain";

/**
 * Selector de pronóstico de UN TOQUE (rediseño 0013).
 *
 * Mientras el partido está abierto, los botones de resultado están SIEMPRE
 * visibles y tocar uno guarda al instante (UI optimista + POST debounced).
 * Re-tocar otro cambia el pronóstico — sin "Hacer pronóstico" ni "Confirmar".
 *
 * El bonus dejó de ser un rango de goles: ahora es el MARCADOR EXACTO, con dos
 * steppers (+/−, sin teclado). Mientras más cerca de los goles reales de cada
 * equipo, más puntos. Ajustar el marcador a un resultado decisivo sincroniza el
 * botón de "¿quién gana?" para que nunca se contradigan.
 *
 * Al kickoff el selector se bloquea y muestra el pronóstico hecho; cuando el
 * cron procesa el partido (5.5), el badge "Cerrado" se reemplaza por el
 * veredicto (acierto/pleno con puntos, o fallo). El server re-valida la
 * ventana igual (regla de arquitectura 3).
 *
 * Eventos globales que emite:
 *  - `mundialito:prediction-saved` ({ matchId }) → actualiza <DayProgress/>.
 *  - `mundialito:day-complete` ({ currentStreak }) → confeti + hoja.
 */

interface Score {
  home: number;
  away: number;
}

interface SavedPrediction {
  result_pred: ResultPred;
  home_goals_pred: number | null;
  away_goals_pred: number | null;
  /** Campos de scoring (5.5) — presentes solo si vino de la DB ya procesada. */
  result_correct?: boolean | null;
  /** Reinterpretado en 0013: true = marcador exacto. */
  goals_correct?: boolean | null;
  points_earned?: number | null;
}

const SCORE_EXPLANATION =
  "Pronostica el marcador exacto. Mientras más cerca de los goles de cada equipo, " +
  "más puntos (hasta +15). En eliminatorias cuenta reglamentario + alargue, " +
  "sin penales.";

/** Espera entre el toque y el POST: si el usuario duda entre dos opciones,
 *  solo viaja la última (no quemamos el rate limit de 20/min). */
const SAVE_DEBOUNCE_MS = 350;

/** Cuánto se mantiene visible el "✓ Guardado" tras confirmar el server.
 *  Al menos 1 minuto para que el usuario alcance a verlo con tranquilidad. */
const SAVED_VISIBLE_MS = 60_000;

type SaveStatus = "idle" | "saving" | "saved";

/** Resultado implícito en un marcador. Empate en knockout → null (lo elige el usuario). */
function deriveResultFromScore(
  score: Score,
  isKnockout: boolean,
): ResultPred | null {
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return isKnockout ? null : "draw";
}

function sameScore(a: Score | null, b: Score | null): boolean {
  if (a === null || b === null) return a === b;
  return a.home === b.home && a.away === b.away;
}

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

  const initialScore: Score | null =
    initialPrediction?.home_goals_pred != null &&
    initialPrediction?.away_goals_pred != null
      ? {
          home: initialPrediction.home_goals_pred,
          away: initialPrediction.away_goals_pred,
        }
      : null;

  const [closed, setClosed] = useState(() => Date.now() >= kickoffMs);
  // Último pronóstico CONFIRMADO por el server; `result`/`score` es lo elegido
  // en pantalla (optimista). Si el POST falla, se revierte a `saved`.
  const [saved, setSaved] = useState<SavedPrediction | null>(initialPrediction);
  const [result, setResult] = useState<ResultPred | null>(
    initialPrediction?.result_pred ?? null,
  );
  const [score, setScore] = useState<Score | null>(initialScore);
  const [showScore, setShowScore] = useState(() => initialScore !== null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lo último que el usuario eligió (el debounce manda SIEMPRE este valor).
  const pendingRef = useRef<{ result: ResultPred; score: Score | null } | null>(
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
    const prevScore: Score | null =
      prev && prev.home_goals_pred != null && prev.away_goals_pred != null
        ? { home: prev.home_goals_pred, away: prev.away_goals_pred }
        : null;
    if (
      prev &&
      prev.result_pred === pending.result &&
      sameScore(prevScore, pending.score)
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
          home_goals_pred: pending.score?.home ?? null,
          away_goals_pred: pending.score?.away ?? null,
        }),
      });
      const data: {
        error?: string;
        streak?: { current_streak: number; completed_today: boolean };
      } = await res.json().catch(() => ({}));
      if (res.status === 201) {
        const confirmed: SavedPrediction = {
          result_pred: pending.result,
          home_goals_pred: pending.score?.home ?? null,
          away_goals_pred: pending.score?.away ?? null,
        };
        savedRef.current = confirmed;
        setSaved(confirmed);
        setStatus("saved");
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatus("idle"), SAVED_VISIBLE_MS);
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
      revertToSaved();
      setStatus("idle");
      if (res.status === 409) {
        setClosed(true);
        setError("El partido ya empezó; el pronóstico está cerrado.");
        return;
      }
      setError(data.error ?? "No se pudo guardar el pronóstico.");
    } catch {
      revertToSaved();
      setStatus("idle");
      setError("Error de red. Intenta de nuevo.");
    }
  }

  function revertToSaved() {
    const prev = savedRef.current;
    setResult(prev?.result_pred ?? null);
    setScore(
      prev && prev.home_goals_pred != null && prev.away_goals_pred != null
        ? { home: prev.home_goals_pred, away: prev.away_goals_pred }
        : null,
    );
  }

  /** Programa el guardado de la elección actual (optimista + debounce). */
  function scheduleSave(next: { result: ResultPred; score: Score | null }) {
    setError(null);
    pendingRef.current = next;
    setStatus("saving");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
  }

  function pickResult(value: ResultPred) {
    if (closed) return;
    setResult(value);
    scheduleSave({ result: value, score });
  }

  /** Ajusta los goles de un equipo (+/−) y sincroniza el ganador si el
   *  marcador es decisivo. */
  function changeScore(team: keyof Score, delta: number) {
    if (closed) return;
    const base: Score = score ?? { home: 0, away: 0 };
    const next: Score = {
      ...base,
      [team]: Math.min(Math.max(base[team] + delta, 0), MAX_GOALS_PER_TEAM),
    };
    if (sameScore(next, score)) return;
    setScore(next);

    // Auto-sync marcador → ganador (en grupos un empate fija 'draw'; en knockout
    // un empate deja el pick al usuario).
    const derived = deriveResultFromScore(next, isKnockout);
    const nextResult = derived ?? result;
    if (derived) setResult(derived);

    // Sin resultado (empate en knockout aún sin elegir ganador) el server
    // rechaza el POST: guardamos local y viaja cuando se toque un ganador.
    if (nextResult) scheduleSave({ result: nextResult, score: next });
  }

  function clearScore() {
    if (closed) return;
    setScore(null);
    if (result) scheduleSave({ result, score: null });
  }

  // ── Estado bloqueado: kickoff pasado ────────────────────────────────
  if (closed) {
    const savedScore =
      saved && saved.home_goals_pred != null && saved.away_goals_pred != null
        ? `${saved.home_goals_pred} - ${saved.away_goals_pred}`
        : null;
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
                {savedScore && (
                  <span className="text-foreground-muted">
                    {" "}
                    · {savedScore}
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
              ) : saved.points_earned > 0 ? (
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                  Cerca · +{saved.points_earned} pts
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
              <span className="animate-scale-in inline-block font-semibold text-brand">
                ✓ Guardado
              </span>
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
              justSaved={status === "saved" && result === opt.value}
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
          onClick={() => setShowScore((open) => !open)}
          aria-expanded={showScore}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-left text-xs font-medium text-foreground-muted transition hover:text-foreground"
        >
          <span>
            {showScore
              ? "Ocultar marcador exacto"
              : "Marcador (opcional · +15 pts)"}
          </span>
          <span aria-hidden="true" className="text-foreground-muted">
            {showScore ? "▲" : "▼"}
          </span>
        </button>

        {showScore && (
          <fieldset className="mt-2 flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/50 p-3">
            <legend className="sr-only">Marcador exacto (opcional)</legend>
            <p className="text-[11px] leading-relaxed text-foreground-muted">
              {SCORE_EXPLANATION}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Stepper
                label={homeTeam}
                flag={homeFlag}
                value={score?.home ?? 0}
                muted={score === null}
                onDec={() => changeScore("home", -1)}
                onInc={() => changeScore("home", 1)}
              />
              <Stepper
                label={awayTeam}
                flag={awayFlag}
                value={score?.away ?? 0}
                muted={score === null}
                onDec={() => changeScore("away", -1)}
                onInc={() => changeScore("away", 1)}
              />
            </div>
            {score === null ? (
              <p className="text-[11px] text-foreground-muted">
                Ajusta los goles para pronosticar el marcador.
              </p>
            ) : (
              <button
                type="button"
                onClick={clearScore}
                className="self-start py-1.5 text-[11px] text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Quitar marcador
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
  justSaved = false,
  onClick,
  label,
  flag,
}: {
  active: boolean;
  /** Acaba de confirmarse el guardado de esta opción: pulso sutil de feedback. */
  justSaved?: boolean;
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
        justSaved ? "animate-pop" : ""
      } ${
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
          <FaEquals />
        </span>
      )}
      <span className="w-full truncate text-center text-xs font-bold leading-tight">
        {label}
      </span>
    </button>
  );
}

/** Selector de goles de un equipo con botones +/− (sin teclado). */
function Stepper({
  label,
  flag,
  value,
  muted,
  onDec,
  onInc,
}: {
  label: string;
  flag: string | null;
  value: number;
  muted: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex min-w-0 max-w-full items-center gap-1.5">
        {flag ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flag}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 rounded-sm object-cover"
          />
        ) : null}
        <span className="truncate text-xs font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <StepButton
          ariaLabel={`Quitar un gol a ${label}`}
          onClick={onDec}
          disabled={value <= 0}
          icon={<FaMinus />}
        />
        <span
          className={`w-7 text-center text-2xl font-bold tabular-nums ${
            muted ? "text-foreground-muted" : "text-foreground"
          }`}
        >
          {value}
        </span>
        <StepButton
          ariaLabel={`Sumar un gol a ${label}`}
          onClick={onInc}
          disabled={value >= MAX_GOALS_PER_TEAM}
          icon={<FaPlus />}
        />
      </div>
    </div>
  );
}

function StepButton({
  ariaLabel,
  onClick,
  disabled,
  icon,
}: {
  ariaLabel: string;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm text-foreground transition enabled:hover:border-brand/50 enabled:hover:bg-brand/10 enabled:active:scale-95 disabled:opacity-30"
    >
      {icon}
    </button>
  );
}
