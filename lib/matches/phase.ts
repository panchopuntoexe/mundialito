/**
 * Fases de eliminación (knockout) en el Home — anuncio de los 16avos y siguientes.
 *
 * Centraliza qué macro-rondas son de eliminación directa y el copy del anuncio
 * ("mensaje inicial") que aparece en el Home cuando arranca cada fase. Las
 * etiquetas combinan el nombre coloquial ("16avos de final") con el tamaño de la
 * ronda ("Ronda de 32"), igual que el resto de la app evita la ambigüedad de
 * octavos/16avos en español.
 *
 * La DB guarda `macro_round` como `text` libre, así que las funciones aceptan
 * `string | null | undefined` y validan contra el enum cerrado de dominio.
 */
import type { MacroRound } from "@/types/domain";

/** Macro-rondas de eliminación directa (todo menos la fase de grupos). */
const KNOCKOUT_ROUNDS = new Set<MacroRound>([
  "round_32",
  "round_16",
  "quarter",
  "semi",
  "final",
]);

/** ¿La macro-ronda es de eliminación directa? */
export function isKnockoutRound(
  macroRound: string | null | undefined,
): boolean {
  return macroRound != null && KNOCKOUT_ROUNDS.has(macroRound as MacroRound);
}

export interface KnockoutAnnouncement {
  /** Nombre coloquial de la ronda: "16avos de final", "Octavos de final", … */
  title: string;
  /** Tamaño de la ronda: "Ronda de 32", "Ronda de 16", … (subtítulo). */
  roundName: string;
  /** Mensaje motivacional bajo el título. */
  message: string;
}

const ANNOUNCEMENTS: Record<MacroRound, KnockoutAnnouncement | null> = {
  group_stage: null,
  round_32: {
    title: "¡Llegan los 16avos de final!",
    roundName: "Ronda de 32",
    message:
      "Arranca la eliminación directa: el que pierde, se va. Pronostica todos los partidos de la ronda para mantener tu racha viva.",
  },
  round_16: {
    title: "¡Octavos de final!",
    roundName: "Ronda de 16",
    message:
      "Quedan 16 equipos. Cada pronóstico pesa más: no dejes pasar ninguno y escala en el ranking.",
  },
  quarter: {
    title: "¡Cuartos de final!",
    roundName: "Los 8 mejores",
    message:
      "Ocho equipos, cuatro partidos. Afina tus pronósticos: ya no hay margen de error.",
  },
  semi: {
    title: "¡Semifinales!",
    roundName: "Los 4 mejores",
    message:
      "A un paso de la final. Pronostica los cruces que definen el Mundial.",
  },
  final: {
    title: "¡La gran final!",
    roundName: "El último partido",
    message: "Es ahora o nunca. Tu último pronóstico del Mundial: que cuente.",
  },
};

/** Copy del anuncio de la fase de eliminación, o `null` si no es knockout. */
export function knockoutAnnouncement(
  macroRound: string | null | undefined,
): KnockoutAnnouncement | null {
  if (!isKnockoutRound(macroRound)) return null;
  return ANNOUNCEMENTS[macroRound as MacroRound] ?? null;
}
