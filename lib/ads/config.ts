/**
 * Configuración de ads — flag y slots (tarea 11.1).
 *
 * Los ads están CONSTRUIDOS pero APAGADOS: se encienden solo cuando
 * NEXT_PUBLIC_ENABLE_ADS="true" Y hay client id de AdSense. Sin ambas, los
 * componentes de ads no renderizan nada en producción (placeholder en dev).
 *
 * No viola la regla 5 de CLAUDE.md: ads ≠ mecánicas de dinero real. Pendiente
 * antes de encender en EEA: capa de consentimiento (GDPR).
 */
import { env } from "@/lib/env";

export const adsEnabled =
  env.NEXT_PUBLIC_ENABLE_ADS === "true" && !!env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const adsenseClient = env.NEXT_PUBLIC_ADSENSE_CLIENT;

/** Slots por ubicación; undefined → ese AdSlot no renderiza (o placeholder dev). */
export const AD_SLOTS = {
  home: env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
  ranking: env.NEXT_PUBLIC_ADSENSE_SLOT_RANKING,
} as const;
