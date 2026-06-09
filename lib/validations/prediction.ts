import { z } from "zod";

/**
 * Validación del input de un pronóstico (tarea 4.1).
 *
 * Los valores de los enums deben coincidir con los tipos de la DB
 * (result_pred / goals_range en 0003_predictions.sql).
 *
 * NOTA: la regla "no hay empate en knockout" (draw → 422) NO se valida acá
 * porque depende del partido (su fase), no del input. El endpoint 4.2 la aplica
 * tras leer el match. Acá solo se valida la forma del input.
 */

export const RESULT_PRED_VALUES = ["home", "draw", "away"] as const;
export const GOALS_RANGE_VALUES = ["0-1", "2-3", "4-5", "6+"] as const;

export const createPredictionSchema = z.object({
  match_id: z.number().int().positive(),
  result_pred: z.enum(RESULT_PRED_VALUES),
  goals_range_pred: z.enum(GOALS_RANGE_VALUES),
});

export type CreatePredictionInput = z.infer<typeof createPredictionSchema>;
