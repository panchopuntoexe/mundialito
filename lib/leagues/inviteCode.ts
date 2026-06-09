/**
 * Generador de códigos de invitación de liga (tarea 6.1).
 *
 * Lógica pura y testeable: el RNG es inyectable. El charset excluye caracteres
 * ambiguos (0/O, 1/I/L) para que un código dictado por voz o copiado a mano no se
 * lea mal. La UNICIDAD la garantiza el unique de `leagues.invite_code` en la DB:
 * el endpoint reintenta ante una colisión (improbable con ~31^6 combinaciones).
 */

/** Charset sin caracteres ambiguos (sin 0, O, 1, I, L). */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_LENGTH = 6;

/** Llena `out` con bytes aleatorios. Por defecto usa Web Crypto (Node 20 + Edge). */
export type RandomBytes = (out: Uint8Array) => void;

const defaultRandomBytes: RandomBytes = (out) => {
  globalThis.crypto.getRandomValues(out);
};

/**
 * Devuelve un código de `INVITE_CODE_LENGTH` caracteres del alfabeto no ambiguo.
 * Mapea cada byte al alfabeto por módulo: el leve sesgo (256 % 31) es irrelevante
 * para un código de invitación.
 */
export function generateInviteCode(
  randomBytes: RandomBytes = defaultRandomBytes,
): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  randomBytes(bytes);
  let code = "";
  for (const byte of bytes) {
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }
  return code;
}
