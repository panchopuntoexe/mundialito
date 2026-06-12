import { z } from "zod";
import { GUEST_PREFIX } from "@/lib/users/guest";

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

/**
 * Username ELEGIDO por el usuario (onboarding o cambio de nombre): además del
 * formato, el prefijo `invitado_` queda reservado para los auto-generados de
 * `lib/users/guest.ts` — nadie puede hacerse pasar por invitado ni gastar su
 * único cambio en volver a parecer uno.
 */
export const chosenUsernameSchema = usernameSchema.refine(
  (s) => !s.startsWith(GUEST_PREFIX),
  { message: `Los nombres que empiezan con "${GUEST_PREFIX}" están reservados.` },
);

export const createUserSchema = z.object({
  username: chosenUsernameSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Body de PATCH /api/users (cambio de username, una sola vez). */
export const updateUsernameSchema = z.object({
  username: chosenUsernameSchema,
});

export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>;
