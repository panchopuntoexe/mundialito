"use client";

import { useState } from "react";

/**
 * Tarjeta Wrapped compartible (tarea 7.4).
 *
 * Muestra la imagen generada (7.2/7.3) y ofrece compartir:
 *  - Web Share API nativa (abre la hoja de compartir del sistema → cubre
 *    WhatsApp, Instagram, X, etc. en móvil), con fallback a copiar link.
 *  - Atajos directos: WhatsApp y X (intents web) e Instagram vía descarga de la
 *    imagen (Instagram no acepta intents web; se comparte el PNG manualmente).
 *
 * Si la imagen aún no se subió a Storage (image_url null), se sirve en vivo desde
 * `/api/wrapped/image?card=<id>`.
 */
interface WrappedCardProps {
  cardId: string;
  phaseLabel: string;
  accuracy: number;
  imageUrl: string | null;
}

export function WrappedCard({
  cardId,
  phaseLabel,
  accuracy,
  imageUrl,
}: WrappedCardProps) {
  const [copied, setCopied] = useState(false);

  const src = imageUrl ?? `/api/wrapped/image?card=${cardId}`;
  const text = `Mi Wrapped de ${phaseLabel} en Prode Mundial 2026 — ${accuracy}% de aciertos 🔥`;

  /** URL absoluta y pública de la imagen (sirve dentro y fuera de la app). */
  function shareUrl(): string {
    if (imageUrl) return imageUrl;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/wrapped/image?card=${cardId}`;
    }
    return src;
  }

  async function handleNativeShare() {
    const url = shareUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Prode Mundial 2026", text, url });
      } catch {
        // El usuario canceló el diálogo: no es un error.
      }
      return;
    }
    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${text} ${shareUrl()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard no disponible: ignorar silenciosamente.
    }
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(`${text} ${shareUrl()}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener");
  }

  function shareX() {
    const params = new URLSearchParams({ text, url: shareUrl() });
    window.open(
      `https://twitter.com/intent/tweet?${params.toString()}`,
      "_blank",
      "noopener",
    );
  }

  /** Instagram no acepta intents web: se descarga el PNG para compartirlo. */
  async function downloadImage() {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `wrapped-${phaseLabel.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, "_blank", "noopener");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Tarjeta Wrapped — ${phaseLabel}`}
        className="w-full rounded-lg"
        loading="lazy"
      />

      <button
        type="button"
        onClick={handleNativeShare}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-background transition hover:bg-brand-strong"
      >
        Compartir
      </button>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium transition hover:bg-border"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={shareX}
          className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium transition hover:bg-border"
        >
          X
        </button>
        <button
          type="button"
          onClick={downloadImage}
          className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium transition hover:bg-border"
        >
          Instagram
        </button>
      </div>

      <button
        type="button"
        onClick={copyLink}
        className="text-xs font-medium text-foreground-muted transition hover:text-foreground"
      >
        {copied ? "¡Link copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
