"use client";

import { useState } from "react";

/**
 * Tarjeta con el código de invitación de una liga (tarea 6.6 + deep link).
 * Comparte el LINK de auto-unión (/leagues/join?code=…): quien lo toca queda
 * dentro de la liga en un toque, sin tipear el código. Web Share API si está
 * disponible (móvil), fallback a copiar el link al portapapeles. Es el motor
 * viral de la liga.
 */
export function InviteCodeCard({
  leagueName,
  inviteCode,
}: {
  leagueName: string;
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);

  const shareText = `Unite a mi liga "${leagueName}" en Mundialito 2026 ⚽`;

  function joinUrl(): string {
    return `${window.location.origin}/leagues/join?code=${encodeURIComponent(inviteCode)}`;
  }

  async function handleShare() {
    const url = joinUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mundialito", text: shareText, url });
        return;
      } catch {
        // Cancelado o no soportado: caemos a copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles disponible: el código ya está visible para copiar a mano.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
          Código de invitación
        </span>
        <span className="text-2xl font-bold tracking-[0.2em] tabular-nums">
          {inviteCode}
        </span>
      </div>
      <button
        type="button"
        onClick={handleShare}
        className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-background transition hover:bg-brand-strong"
      >
        {copied ? "¡Link copiado!" : "Compartir link"}
      </button>
    </div>
  );
}
