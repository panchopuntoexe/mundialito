"use client";

import { ShareButtons } from "@/components/ShareButtons";

/**
 * Tarjeta Wrapped compartible (tarea 7.4).
 *
 * Muestra la imagen generada (7.2/7.3) y delega el compartir en <ShareButtons/>.
 * Si la imagen aún no se subió a Storage (image_url null), se sirve en vivo desde
 * `/api/wrapped/image?card=<id>`.
 */
interface WrappedCardProps {
  cardId: string;
  phaseLabel: string;
  accuracy: number;
  imageUrl: string | null;
  /** Username del dueño para atribuir el referral en el link (A5). */
  refUsername?: string | null;
}

export function WrappedCard({
  cardId,
  phaseLabel,
  accuracy,
  imageUrl,
  refUsername = null,
}: WrappedCardProps) {
  const fallbackPath = `/api/wrapped/image?card=${cardId}`;
  const src = imageUrl ?? fallbackPath;
  const text = `Mis estadísticas de ${phaseLabel} en Mundialito 2026 — ${accuracy}% de aciertos 🔥`;
  const downloadName = `estadisticas-${phaseLabel.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Tarjeta de estadísticas — ${phaseLabel}`}
        className="w-full rounded-lg"
        loading="lazy"
      />
      <ShareButtons
        imageUrl={imageUrl}
        fallbackPath={fallbackPath}
        text={text}
        downloadName={downloadName}
        refUsername={refUsername}
      />
    </div>
  );
}
