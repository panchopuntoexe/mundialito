import { z } from "zod";

/**
 * Validaciones de ligas (tareas 6.1 y 6.2).
 *
 * - `createLeagueSchema`: nombre de liga, alineado con la constraint de la DB
 *   (`league_name_len`, 1–40 chars en 0004_leagues.sql).
 * - `joinLeagueSchema`: código de invitación. Se normaliza a MAYÚSCULAS y sin
 *   espacios para que el lookup sea exacto sin importar cómo lo pegó el usuario
 *   (los códigos se generan en mayúsculas, ver inviteCode.ts).
 */

export const leagueNameSchema = z
  .string()
  .trim()
  .min(1, "Poné un nombre para la liga.")
  .max(40, "El nombre no puede superar los 40 caracteres.");

export const createLeagueSchema = z.object({
  name: leagueNameSchema,
});

export const inviteCodeSchema = z
  .string()
  .trim()
  .min(4, "Código demasiado corto.")
  .max(12, "Código demasiado largo.")
  .regex(/^[A-Za-z0-9]+$/, "El código solo tiene letras y números.")
  .transform((s) => s.toUpperCase());

export const joinLeagueSchema = z.object({
  invite_code: inviteCodeSchema,
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;
