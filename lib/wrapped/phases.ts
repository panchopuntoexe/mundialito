/**
 * Etiquetas legibles de las fases del Wrapped (tareas 7.2–7.4).
 *
 * Usa el tamaño de la ronda ("Ronda de 32/16") en vez de octavos/16avos para
 * evitar la ambigüedad de esos términos en español. Compartido por la imagen de
 * la tarjeta y la UI.
 */
import type { WrappedPhase } from "@/lib/scoring/wrappedStats";

export const WRAPPED_PHASE_LABELS: Record<WrappedPhase, string> = {
  group_stage: "Fase de Grupos",
  round_32: "Ronda de 32",
  round_16: "Ronda de 16",
  quarter: "Cuartos de Final",
  semi: "Semifinales",
  final: "Final",
  full_tournament: "Mundial 2026",
};

export function wrappedPhaseLabel(phase: WrappedPhase): string {
  return WRAPPED_PHASE_LABELS[phase] ?? WRAPPED_PHASE_LABELS.full_tournament;
}
