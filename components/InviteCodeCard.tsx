"use client";

import { useState } from "react";

/**
 * Tarjeta con el código de invitación de una liga (tarea 6.6). Muestra el código
 * y permite compartirlo: usa la Web Share API si está disponible (móvil), con
 * fallback a copiar al portapapeles. Es el motor viral de la liga: compartir el
 * código es cómo entran los amigos.
 */
export function InviteCodeCard({
  leagueName,
  inviteCode,
}: {
  leagueName: string;
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);

  const shareText = `Unite a mi liga "${leagueName}" en Prode Mundial con el código ${inviteCode}`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Prode Mundial", text: shareText });
        return;
      } catch {
        // Cancelado o no soportado: caemos a copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(inviteCode);
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
        {copied ? "¡Copiado!" : "Compartir"}
      </button>
    </div>
  );
}
