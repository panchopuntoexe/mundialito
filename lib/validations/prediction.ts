import { z } from "zod";

/**
 * Validación del input de un pronóstico (tarea 4.1, rediseño 0013).
 *
 * El pronóstico mínimo es `result_pred` (quién gana). El MARCADOR EXACTO
 * (`home_goals_pred`/`away_goals_pred`) es un bonus opcional: o van los dos o
 * ninguno. Reemplaza al antiguo rango de goles (`goals_range_pred`, legacy).
 *
 * NOTA: la regla "no hay empate en knockout" (result_pred='draw' → 422) NO se
 * valida acá porque depende del partido (su fase), no del input. El endpoint 4.2
 * la aplica tras leer el match. Acá solo se valida la forma del input.
 */

export const RESULT_PRED_VALUES = ["home", "draw", "away"] as const;

/** Tope de goles por equipo que acepta el selector (UI usa 0–9). */
export const MAX_GOALS_PER_TEAM = 9;

const goalsField = z
  .number()
  .int()
  .min(0)
  .max(MAX_GOALS_PER_TEAM)
  .nullable()
  .optional();

export const createPredictionSchema = z
  .object({
    match_id: z.number().int().positive(),
    result_pred: z.enum(RESULT_PRED_VALUES),
    /** Marcador exacto del local (reg + alargue, sin penales). Va con el visitante. */
    home_goals_pred: goalsField,
    away_goals_pred: goalsField,
  })
  .refine(
    (v) =>
      (v.home_goals_pred == null) === (v.away_goals_pred == null),
    {
      message: "El marcador necesita los goles de ambos equipos.",
      path: ["home_goals_pred"],
    },
  );

export type CreatePredictionInput = z.infer<typeof createPredictionSchema>;
