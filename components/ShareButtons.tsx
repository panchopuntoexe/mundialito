"use client";

import { useState } from "react";

/**
 * Botonera de compartir reutilizable (tareas 7.4 y 7.5).
 *
 * Web Share API nativa (cubre WhatsApp/Instagram/X en móvil) con fallback a copiar
 * link, más atajos directos: WhatsApp y X (intents web) e Instagram vía descarga
 * del PNG (Instagram no acepta intents web). Compartida por las tarjetas de
 * Wrapped y de resultado de partido.
 */
interface ShareButtonsProps {
  /** URL pública/absoluta preferida (Storage). Si es null, se usa `fallbackPath`. */
  imageUrl: string | null;
  /** Ruta same-origin que renderiza la imagen en vivo (fallback de compartir). */
  fallbackPath: string;
  /** Texto del mensaje a compartir. */
  text: string;
  /** Nombre del archivo (sin extensión) al descargar para Instagram. */
  downloadName: string;
}

export function ShareButtons({
  imageUrl,
  fallbackPath,
  text,
  downloadName,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const src = imageUrl ?? fallbackPath;

  /** URL absoluta y pública de la imagen (sirve dentro y fuera de la app). */
  function shareUrl(): string {
    if (imageUrl) return imageUrl;
    if (typeof window !== "undefined") {
      return `${window.location.origin}${fallbackPath}`;
    }
    return src;
  }

  async function handleNativeShare() {
    const url = shareUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mundialito 2026", text, url });
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
      a.download = `${downloadName}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, "_blank", "noopener");
    }
  }

  return (
    <div className="flex flex-col gap-3">
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
