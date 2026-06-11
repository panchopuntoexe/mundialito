"use client";

import { useEffect, useRef } from "react";
import { adsEnabled, adsRequested, adsenseClient } from "@/lib/ads/config";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  /** Id de bloque de AdSense (de lib/ads/config). Sin slot → no renderiza. */
  slot: string | undefined;
  format?: "auto" | "horizontal" | "rectangle";
  className?: string;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Slot de anuncio (tarea 11.2).
 *
 * - Flag apagado (default): null SIEMPRE → DOM idéntico a no tener ads.
 * - Flag encendido en dev: placeholder punteado (chequear layout sin cuenta
 *   de AdSense ni cargar el script real).
 * - Flag encendido en prod: el <ins> de adsbygoogle dentro de un contenedor
 *   con min-h fijo (anti-CLS; hasta la aprobación de AdSense el bloque queda
 *   en blanco pero estable). Sin client id o sin slot → null.
 */
export function AdSlot({ slot, format = "auto", className }: AdSlotProps) {
  const pushed = useRef(false);
  const renderReal = adsEnabled && !isDev && !!slot;

  useEffect(() => {
    if (!renderReal || pushed.current) return;
    // Guard con ref: Strict Mode corre el efecto dos veces en dev y un push
    // duplicado sobre el mismo <ins> lanza error.
    pushed.current = true;
    (window.adsbygoogle ??= []).push({});
  }, [renderReal]);

  if (!adsRequested) return null;

  if (isDev) {
    return (
      <div
        className={`flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-border text-xs text-foreground-muted ${className ?? ""}`}
      >
        Ad · {slot ?? "sin slot"}
      </div>
    );
  }

  if (!renderReal) return null;

  return (
    <div className={`min-h-[100px] ${className ?? ""}`}>
      <ins
        className="adsbygoogle block"
        data-ad-client={adsenseClient}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
