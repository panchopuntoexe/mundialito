"use client";

import { useSyncExternalStore } from "react";

/**
 * Countdown a kickoff (isla de cliente). Hermano de <KickoffTime/>: usa el mismo
 * patrón `useSyncExternalStore` (sin mismatch SSR — el server pinta `null` y el
 * cliente toma el relevo al hidratar), pero con un intervalo que refresca el
 * texto cada ~30 s. Crea urgencia para pronosticar antes del cierre.
 *
 *  - falta más de `withinMs` (def. 2 h): no muestra nada (`null`).
 *  - entre `withinMs` y 0: "Empieza en 1 h 23 min" / "Empieza en 23 min".
 *  - kickoff alcanzado: "En vivo".
 */

const TICK_MS = 30_000;

function subscribe(callback: () => void): () => void {
  const id = setInterval(callback, TICK_MS);
  return () => clearInterval(id);
}

/** Texto del countdown, o `null` si todavía falta más que `withinMs`. */
function computeLabel(kickoffMs: number, withinMs: number): string | null {
  const remaining = kickoffMs - Date.now();
  if (remaining <= 0) return "En vivo";
  if (remaining > withinMs) return null;

  const totalMin = Math.ceil(remaining / 60_000);
  if (totalMin >= 1440) {
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    return hours > 0
      ? `Empieza en ${days} d ${hours} h`
      : `Empieza en ${days} d`;
  }
  if (totalMin >= 60) {
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return mins > 0 ? `Empieza en ${hours} h ${mins} min` : `Empieza en ${hours} h`;
  }
  return `Empieza en ${totalMin} min`;
}

export function CountdownToKickoff({
  kickoffAt,
  withinMs = 2 * 60 * 60 * 1000,
  className,
}: {
  kickoffAt: string;
  /** Solo se muestra si el kickoff está dentro de esta ventana (ms). */
  withinMs?: number;
  className?: string;
}) {
  const kickoffMs = new Date(kickoffAt).getTime();

  const label = useSyncExternalStore(
    subscribe,
    () => computeLabel(kickoffMs, withinMs),
    () => null,
  );

  if (!label) return null;
  return <span className={className}>{label}</span>;
}
