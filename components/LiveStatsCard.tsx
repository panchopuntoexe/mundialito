"use client";

import { ShareButtons } from "@/components/ShareButtons";

/**
 * Tarjeta compartible de stats en vivo (mini-Wrapped permanente).
 *
 * Muestra la imagen renderizada en vivo por `/api/wrapped/live-image` (puntos,
 * precisión, racha actual, posición y nivel al momento) y delega el compartir
 * en <ShareButtons/>. Disponible siempre, sin esperar al cierre de fase. El
 * texto del share lo arma cada superficie (Estadísticas, modal de día
 * completo) con las stats que ya tiene a mano.
 */
interface LiveStatsCardProps {
  userId: string;
  /** Texto del mensaje a compartir. */
  text: string;
}

export function LiveStatsCard({ userId, text }: LiveStatsCardProps) {
  const fallbackPath = `/api/wrapped/live-image?user=${userId}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fallbackPath}
        alt="Mis stats en vivo — Mundialito 2026"
        className="w-full rounded-lg"
        loading="lazy"
      />
      <ShareButtons
        imageUrl={null}
        fallbackPath={fallbackPath}
        text={text}
        downloadName="mis-stats-mundialito"
      />
    </div>
  );
}
