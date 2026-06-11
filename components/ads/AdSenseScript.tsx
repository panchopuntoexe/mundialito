import Script from "next/script";
import { adsEnabled, adsenseClient } from "@/lib/ads/config";

/**
 * Loader del script de AdSense (tarea 11.2). Se monta una sola vez en el
 * layout raíz. Con los ads apagados (default) no renderiza nada: el HTML no
 * contiene rastro de adsbygoogle. El service worker ya deja pasar
 * cross-origin sin cachear, no necesita cambios.
 */
export function AdSenseScript() {
  // En dev nunca se carga el script real: AdSlot muestra placeholders.
  if (!adsEnabled || process.env.NODE_ENV !== "production") return null;
  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
