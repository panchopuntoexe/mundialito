import { z } from "zod";

/**
 * Validación del username de onboarding (tarea 2.3).
 *
 * Reglas alineadas con la constraint de la DB (`username_len`, 3–20 chars en
 * 0001_users.sql). Restringimos el charset a [a-z0-9_] y normalizamos a
 * minúsculas: así "Juan" y "juan" no son dos usernames distintos (el unique de
 * Postgres es case-sensitive).
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "El username debe tener al menos 3 caracteres.")
  .max(20, "El username no puede superar los 20 caracteres.")
  .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo (_).")
  .transform((s) => s.toLowerCase());

export const createUserSchema = z.object({
  username: usernameSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
