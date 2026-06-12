"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LiveStatsCard } from "@/components/LiveStatsCard";
import { SaveAccountButton } from "@/components/SaveAccountButton";
import { toTournamentDay } from "@/lib/scoring/streaks";

/**
 * Celebración al completar los pronósticos del día.
 *
 * Escucha el evento global `mundialito:day-complete` que dispara <PredictionForm/>
 * cuando el endpoint informa `completed_today` (todos los partidos abiertos del día
 * quedaron pronosticados). Lanza confeti y abre una hoja con la racha, la tarjeta
 * de stats en vivo lista para compartir (el momento de máxima emoción) y un atajo
 * a Estadísticas.
 *
 * Dedupe POR DÍA con localStorage: editar un pronóstico ya completo, recargar o
 * volver a la pantalla no re-dispara el confeti. La clave usa el "día" en la TZ del
 * torneo, igual que la racha (CONTEXT.md "Partido del día").
 */

const STORAGE_PREFIX = "mundialito:dayCelebrated:";

interface DayCompleteDetail {
  currentStreak: number;
}

export function DayCompleteCelebration({
  isAnonymous = false,
  userId = null,
}: {
  /** Invitado: el momento de máxima intención para ofrecer guardar la cuenta. */
  isAnonymous?: boolean;
  /** Dueño de la tarjeta de stats en vivo; sin id se cae al share de solo texto. */
  userId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);

  const celebrate = useCallback(async (detail: DayCompleteDetail) => {
    const key = `${STORAGE_PREFIX}${toTournamentDay(new Date())}`;
    try {
      if (localStorage.getItem(key)) return; // Ya se celebró hoy en este dispositivo.
      localStorage.setItem(key, "1");
    } catch {
      // localStorage no disponible (modo privado, etc.): celebramos igual.
    }

    setStreak(detail.currentStreak);
    setOpen(true);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reducedMotion) {
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
      } catch {
        // El confeti es decorativo: si falla la carga, la hoja igual se muestra.
      }
    }
  }, []);

  useEffect(() => {
    function onDayComplete(e: Event) {
      const detail = (e as CustomEvent<DayCompleteDetail>).detail;
      if (detail) void celebrate(detail);
    }
    window.addEventListener("mundialito:day-complete", onDayComplete);
    return () =>
      window.removeEventListener("mundialito:day-complete", onDayComplete);
  }, [celebrate]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const shareText = `Pronostiqué los partidos de hoy en Mundialito 2026 — racha de ${streak} 🔥`;

  /** Fallback sin `userId` (sin tarjeta): comparte solo texto + link. */
  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mundialito 2026", text: shareText, url });
      } catch {
        // El usuario canceló el diálogo: no es un error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard no disponible: ignorar silenciosamente.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-complete-title"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          ✕
        </button>

        <div className="text-5xl" aria-hidden>
          🔥
        </div>
        <h2
          id="day-complete-title"
          className="mt-3 text-lg font-bold tracking-tight"
        >
          ¡Listo por hoy!
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Pronosticaste todos los partidos de hoy. Racha:{" "}
          <span className="font-semibold text-accent">
            {streak} {streak === 1 ? "día" : "días"}
          </span>
          .
        </p>

        {/* La tarjeta de stats en vivo, lista para compartir en el pico de
            emoción del día. ShareButtons manda la IMAGEN (no solo texto). */}
        {userId && (
          <div className="mt-5 text-left">
            <LiveStatsCard userId={userId} text={shareText} />
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/estadisticas"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong"
          >
            Ver mis estadísticas
          </Link>
          {!userId && (
            <button
              type="button"
              onClick={handleShare}
              className="rounded-lg border border-border bg-surface-muted px-4 py-2.5 text-sm font-medium transition hover:bg-border"
            >
              {copied ? "¡Link copiado!" : "Compartir e invitar amigos"}
            </button>
          )}
        </div>

        {isAnonymous && (
          <div className="mt-4 flex flex-col items-center gap-2 border-t border-border pt-4">
            <p className="text-xs text-foreground-muted">
              Guarda tu progreso para no perder tu racha 🔥
            </p>
            <SaveAccountButton />
          </div>
        )}
      </div>
    </div>
  );
}
