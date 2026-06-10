/**
 * Genera un par de claves VAPID para Web Push (tarea 8.3).
 *
 *   npm run gen:vapid
 *
 * Pegá la salida en `.env.local` (y en las env vars de Vercel). La pública
 * (NEXT_PUBLIC_VAPID_PUBLIC_KEY) va al cliente; la privada (VAPID_PRIVATE_KEY)
 * es un secreto server-only. Generar las claves UNA sola vez por entorno:
 * rotarlas invalida todas las suscripciones existentes.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("# ── Web Push (VAPID) ──────────────────────────────────────");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:tu-email@ejemplo.com");
