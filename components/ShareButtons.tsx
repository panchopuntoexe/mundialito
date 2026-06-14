"use client";

import { useState } from "react";
import { APP_URL } from "@/lib/appUrl";

/**
 * Botonera de compartir reutilizable (tareas 7.4 y 7.5).
 *
 * El botón principal comparte la IMAGEN como archivo vía Web Share API nivel 2
 * (`navigator.share({ files })`, soportada en móvil: cubre WhatsApp/Instagram/X). Si
 * el navegador no puede compartir archivos, cae a compartir el link (con preview de
 * la imagen) y, por último, a copiar el link. Además: atajos directos a WhatsApp y X
 * (intents web, solo texto+link) e Instagram vía descarga del PNG. Compartida por las
 * tarjetas de Wrapped y de resultado de partido.
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

  /**
   * URL que se incluye en el mensaje al compartir: el link a la app (no la imagen).
   * Ya no se embebe un QR en la tarjeta, así que el destino vive en el texto.
   */
  function shareUrl(): string {
    return APP_URL;
  }

  /** Baja la imagen (`src`) como File para compartirla/descargarla. null si falla. */
  async function fetchImageFile(): Promise<File | null> {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], `${downloadName}.png`, {
        type: blob.type || "image/png",
      });
    } catch {
      return null;
    }
  }

  /** Comparte el link (con preview de la imagen) o, si no hay Web Share, copia. */
  async function shareLink() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mundialito 2026", text, url: shareUrl() });
      } catch {
        // El usuario canceló el diálogo: no es un error.
      }
      return;
    }
    await copyLink();
  }

  /**
   * Compartir nativo: intenta enviar la IMAGEN como archivo (Web Share API nivel 2).
   * Si el navegador no puede compartir archivos, cae a compartir el link.
   */
  async function handleNativeShare() {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function"
    ) {
      const file = await fetchImageFile();
      if (file && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Mundialito 2026",
            // Al compartir la imagen como archivo no hay campo `url`: el link
            // a la app va dentro del texto.
            text: `${text} ${shareUrl()}`,
          });
        } catch (err) {
          // AbortError = el usuario canceló (no es error); otro fallo → caer al link.
          if ((err as Error)?.name !== "AbortError") {
            await shareLink();
          }
        }
        return;
      }
    }
    await shareLink();
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
    const file = await fetchImageFile();
    if (!file) {
      window.open(src, "_blank", "noopener");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${downloadName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
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
