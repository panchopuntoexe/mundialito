/**
 * Alertas operativas por email vía Resend (tarea 10.1).
 *
 * `sendAlert` NUNCA lanza: una alerta rota no puede tumbar al job que la
 * emite (lo peor que pasa es un console.error). Si faltan las envs
 * (RESEND_API_KEY / ALERT_EMAIL_TO) es un no-op con warning — las alertas son
 * una capacidad opcional, mismo patrón que VAPID.
 *
 * Dedupe: clave `alert:{source}:{huella}` con SET NX EX en Redis. El primer
 * error de un tipo manda email; las repeticiones dentro del TTL (15 min por
 * defecto) se silencian. Con match-sync corriendo cada minuto, una caída de
 * API-Football manda ≤4 emails/hora en vez de 60.
 *
 * Envío con fetch directo a la API de Resend (sin SDK). El From por defecto
 * (onboarding@resend.dev) solo entrega al email del dueño de la cuenta de
 * Resend: exactamente este caso de uso, sin verificar dominio.
 */
import { errorFingerprint } from "@/lib/alerts/fingerprint";
import { serverEnv } from "@/lib/env";
import { redis } from "@/lib/redis/client";

const DEFAULT_FROM = "Mundialito <onboarding@resend.dev>";
const DEFAULT_TTL_SECONDS = 900; // 15 min entre emails del mismo error

export interface AlertInput {
  /** Quién alerta: "cron/match-sync", "processResults", etc. */
  source: string;
  /** Contexto adicional legible (opcional). */
  message?: string;
  /** El error original (opcional; alimenta la huella de dedupe y el body). */
  error?: unknown;
  /** Huella manual; si falta se deriva del error (o de source+message). */
  dedupeKey?: string;
  dedupeTtlSeconds?: number;
}

export async function sendAlert(input: AlertInput): Promise<void> {
  try {
    const apiKey = serverEnv.RESEND_API_KEY;
    const to = serverEnv.ALERT_EMAIL_TO;
    if (!apiKey || !to) {
      console.warn(
        `[alerts] alerta de ${input.source} sin enviar: faltan RESEND_API_KEY/ALERT_EMAIL_TO.`,
      );
      return;
    }

    const fingerprint =
      input.dedupeKey ??
      (input.error !== undefined
        ? errorFingerprint(input.error)
        : errorFingerprint(`${input.source}:${input.message ?? ""}`));
    const dedupeRedisKey = `alert:${input.source}:${fingerprint}`;
    const ttl = input.dedupeTtlSeconds ?? DEFAULT_TTL_SECONDS;

    // SET NX: solo la primera corrida dentro del TTL gana el derecho a enviar.
    const claimed = await redis.set(dedupeRedisKey, new Date().toISOString(), {
      nx: true,
      ex: ttl,
    });
    if (claimed === null) return; // ya alertado hace <TTL: silencio.

    const now = new Date();
    const stack =
      input.error instanceof Error
        ? (input.error.stack ?? input.error.message)
        : input.error !== undefined
          ? String(input.error)
          : null;
    const lines = [
      `Fuente: ${input.source}`,
      `Cuándo: ${now.toISOString()}`,
      input.message ? `Detalle: ${input.message}` : null,
      stack ? `\nError:\n${stack}` : null,
      `\nDedupe: ${dedupeRedisKey} (silenciado ${ttl / 60} min)`,
    ].filter(Boolean);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: serverEnv.ALERT_EMAIL_FROM ?? DEFAULT_FROM,
        to: [to],
        subject: `[Mundialito] Fallo en ${input.source}`,
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) {
      console.error(
        `[alerts] Resend respondió ${res.status}: ${await res.text()}`,
      );
    }
  } catch (err) {
    // Nunca propagar: la alerta es best-effort.
    console.error("[alerts] fallo enviando alerta:", err);
  }
}
