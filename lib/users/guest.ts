/**
 * Username de invitado (modo "Jugar sin cuenta").
 *
 * Lógica pura, sin Supabase: recibe un `GuestProfileInserter` inyectable (lo
 * cumple el cliente admin estructuralmente), igual que el patrón de
 * `checkRateLimitWith` (8.4). Así se testea sin DB real; `signInAsGuest` lo
 * cablea con el insert real a `public.users`.
 */

export const GUEST_PREFIX = "invitado_";

const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;

/**
 * Genera un username de invitado: `invitado_` + 6 chars [a-z0-9] (15 chars en
 * total, válido contra `usernameSchema`). 36^6 ≈ 2.200M combinaciones: la
 * colisión con el unique de la DB es despreciable y la cubre el retry.
 */
export function generateGuestUsername(): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)];
  }
  return `${GUEST_PREFIX}${suffix}`;
}

export interface GuestProfileInserter {
  /** Inserta la fila en `public.users`; devuelve el error PostgREST o null. */
  insertProfile(row: {
    id: string;
    username: string;
  }): Promise<{ code?: string; message?: string } | null>;
}

/** unique_violation de Postgres: el username generado ya existía. */
const UNIQUE_VIOLATION = "23505";

/**
 * Crea el perfil del invitado reintentando con otro sufijo ante una colisión
 * de username (23505). Devuelve el username creado, o null si agotó los
 * intentos o el error no es recuperable (en ese caso el caller degrada al
 * onboarding manual).
 */
export async function createGuestProfileWith(
  inserter: GuestProfileInserter,
  userId: string,
  maxAttempts = 3,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const username = generateGuestUsername();
    const error = await inserter.insertProfile({ id: userId, username });
    if (!error) return username;
    if (error.code !== UNIQUE_VIOLATION) {
      console.error(
        `[guest] error creando perfil de invitado: ${error.message ?? error.code}`,
      );
      return null;
    }
  }
  console.error(
    `[guest] ${maxAttempts} colisiones seguidas de username de invitado`,
  );
  return null;
}
