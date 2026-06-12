/**
 * Envío de Web Push server-side (tarea 8.3).
 *
 * Configura `web-push` con las claves VAPID (lazy, una sola vez) y envía pushes
 * a las suscripciones de un usuario o de todos. Server-only: usa secretos VAPID
 * y el cliente admin (service role) para leer/limpiar suscripciones. Las que el
 * push service rechaza como expiradas (404/410) se borran para no reintentar.
 *
 * Lo usan el endpoint de prueba (8.3), el cron de recordatorio de pronóstico
 * (8.6) y el broadcast de anuncios a demanda (8.7).
 */
import webpush from "web-push";
import { env, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

export interface PushPayload {
  title: string;
  body: string;
  /** A dónde navega la app al tocar la notificación. */
  url?: string;
  /** Agrupa/colapsa notificaciones del mismo tipo. */
  tag?: string;
  icon?: string;
}

/** ¿Están las claves VAPID configuradas? Si no, el push está deshabilitado. */
export function isPushConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && serverEnv.VAPID_PRIVATE_KEY);
}

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = serverEnv.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Web Push no está configurado: faltan las claves VAPID.");
  }
  webpush.setVapidDetails(
    serverEnv.VAPID_SUBJECT ?? "mailto:admin@prode-mundial.app",
    publicKey,
    privateKey,
  );
  configured = true;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Envía `payload` a cada suscripción; devuelve enviadas OK y purgadas. */
async function sendToSubscriptions(
  admin: ReturnType<typeof createAdminClient>,
  subs: SubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  const body = JSON.stringify(payload);
  const staleIds: string[] = [];
  let sent = 0;

  // En tandas: un broadcast puede tener muchas suscripciones y no queremos
  // abrir cientos de conexiones al push service a la vez.
  const BATCH = 50;
  for (let i = 0; i < subs.length; i += BATCH) {
    await Promise.all(
      subs.slice(i, i + BATCH).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          );
          sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404/410 = suscripción expirada/cancelada → purgar.
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            console.error("[webPush] error enviando push:", err);
          }
        }
      }),
    );
  }

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, pruned: staleIds.length };
}

/**
 * Envía `payload` a todas las suscripciones del usuario.
 * @returns cuántas se enviaron OK y cuántas suscripciones muertas se purgaron.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  ensureConfigured();
  const admin = createAdminClient();

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) {
    console.error("[webPush] error leyendo suscripciones:", error);
    throw new Error("No se pudieron leer las suscripciones.");
  }
  if (!subs || subs.length === 0) {
    return { sent: 0, pruned: 0 };
  }

  return sendToSubscriptions(admin, subs, payload);
}

/**
 * Broadcast: envía `payload` a TODAS las suscripciones registradas (anuncios
 * a demanda, tarea 8.7). `users` es la cantidad de usuarios distintos
 * alcanzados (un usuario puede tener varios dispositivos).
 */
export async function sendPushToAll(
  payload: PushPayload,
): Promise<{ sent: number; pruned: number; users: number }> {
  ensureConfigured();
  const admin = createAdminClient();

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  if (error) {
    console.error("[webPush] error leyendo suscripciones:", error);
    throw new Error("No se pudieron leer las suscripciones.");
  }
  if (!subs || subs.length === 0) {
    return { sent: 0, pruned: 0, users: 0 };
  }

  const users = new Set(subs.map((s) => s.user_id)).size;
  const { sent, pruned } = await sendToSubscriptions(admin, subs, payload);
  return { sent, pruned, users };
}
