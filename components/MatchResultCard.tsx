"use client";

import { ShareButtons } from "@/components/ShareButtons";

/**
 * Mini-tarjeta compartible del resultado de un partido (tarea 7.5).
 *
 * Muestra la imagen estilo "cuadritos de Wordle" (renderizada en vivo por
 * `/api/matches/result-image`) y delega el compartir en <ShareButtons/>. Se muestra
 * apenas el partido queda procesado (puntos calculados, 5.5).
 */
interface MatchResultCardProps {
  matchId: number;
  userId: string;
  homeTeam: string;
  awayTeam: string;
  pointsEarned: number;
}

export function MatchResultCard({
  matchId,
  userId,
  homeTeam,
  awayTeam,
  pointsEarned,
}: MatchResultCardProps) {
  const fallbackPath = `/api/matches/result-image?match=${matchId}&user=${userId}`;
  const text = `Pronostiqué ${homeTeam} vs ${awayTeam} en Prode Mundial 2026 y saqué ${pointsEarned} pts 🎯`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fallbackPath}
        alt={`Resultado — ${homeTeam} vs ${awayTeam}`}
        className="w-full rounded-lg"
        loading="lazy"
      />
      <ShareButtons
        imageUrl={null}
        fallbackPath={fallbackPath}
        text={text}
        downloadName={`resultado-${matchId}`}
      />
    </div>
  );
}
