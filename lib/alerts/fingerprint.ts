/**
 * Huella de errores para dedupe de alertas — lógica pura (tarea 10.1).
 *
 * Dos errores "iguales salvo detalles" deben colapsar en UNA alerta: el
 * mensaje se normaliza quitando lo variable (dígitos, UUIDs, espacios) antes
 * de hashear, así "error en match 123" y "error en match 456" comparten
 * huella y el dedupe en Redis (send.ts) frena la tormenta de emails.
 */
/** Hash FNV-1a de 32 bits. Estable entre runtimes (solo aritmética entera). */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Nombre + mensaje del error, sin partes variables, en minúsculas. */
export function normalizeError(error: unknown): string {
  const name = error instanceof Error ? error.name : "unknown";
  const message =
    error instanceof Error ? error.message : String(error ?? "sin mensaje");
  const stripped = message
    .slice(0, 200)
    .toLowerCase()
    .replace(UUID_RE, "<id>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
  return `${name.toLowerCase()}:${stripped.slice(0, 100)}`;
}

/** Huella hex estable de un error (para la clave de dedupe en Redis). */
export function errorFingerprint(error: unknown): string {
  return fnv1a(normalizeError(error)).toString(16);
}
