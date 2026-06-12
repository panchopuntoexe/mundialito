"use client";

import { useEffect, useState } from "react";

/**
 * Banda de progreso del día en Hoy: "Pronosticaste X de Y partidos". Hace
 * visible el objetivo diario que sostiene la racha (antes solo se descubría
 * al completarlo, con el confeti).
 *
 * Render inicial con los pronósticos que trajo el server; después escucha el
 * evento `mundialito:prediction-saved` de <PredictionForm/> para avanzar la
 * barra sin recargar.
 */
export function DayProgress({
  totalMatches,
  initialPredictedIds,
}: {
  totalMatches: number;
  initialPredictedIds: number[];
}) {
  const [predicted, setPredicted] = useState<ReadonlySet<number>>(
    () => new Set(initialPredictedIds),
  );

  useEffect(() => {
    function onSaved(e: Event) {
      const detail = (e as CustomEvent<{ matchId?: number }>).detail;
      if (typeof detail?.matchId !== "number") return;
      setPredicted((prev) => {
        if (prev.has(detail.matchId!)) return prev;
        const next = new Set(prev);
        next.add(detail.matchId!);
        return next;
      });
    }
    window.addEventListener("mundialito:prediction-saved", onSaved);
    return () =>
      window.removeEventListener("mundialito:prediction-saved", onSaved);
  }, []);

  if (totalMatches === 0) return null;

  const count = Math.min(predicted.size, totalMatches);
  const complete = count >= totalMatches;
  const pct = Math.round((count / totalMatches) * 100);

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className={complete ? "font-semibold text-brand" : "text-foreground-muted"}
        >
          {complete
            ? "¡Día completo! Tu racha sigue viva 🔥"
            : `Pronosticaste ${count} de ${totalMatches} ${
                totalMatches === 1 ? "partido" : "partidos"
              } de hoy`}
        </span>
        <span className="shrink-0 tabular-nums font-semibold text-foreground-muted">
          {count}/{totalMatches}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalMatches}
        aria-valuenow={count}
        aria-label="Pronósticos de hoy"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            complete ? "bg-brand" : "bg-brand/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
