/**
 * Helpers de Web Push en el cliente (tarea 8.3).
 *
 * Hablan con el navegador (Notification, PushManager) y con nuestros endpoints
 * (/api/notifications/*). No usan secretos: la clave VAPID pública llega por
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY. Se importan desde componentes de cliente.
 */

export type PushSubscribeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "denied"
        | "invalid_key"
        | "service_error"
        | "backend_error"
        | "sw_unavailable";
    };

export type PushFailureReason = Exclude<PushSubscribeResult, { ok: true }>["reason"];

/** Copia para el usuario según el motivo de fallo de la suscripción. */
export const PUSH_REASON_MESSAGES: Record<PushFailureReason, string> = {
  unsupported: "Tu navegador no soporta notificaciones push.",
  denied: "Permiso denegado. Activa las notificaciones en la configuración del navegador.",
  invalid_key:
    "La clave de notificaciones no es válida. Regenérala con npm run gen:vapid y actualiza las variables en Vercel.",
  service_error:
    "El navegador no pudo conectar con el servicio de push. Prueba Chrome o Edge, desactiva bloqueadores, o revisa que las notificaciones estén permitidas en Windows.",
  backend_error: "No se pudo guardar la suscripción. Intenta de nuevo.",
  sw_unavailable: "Necesitas HTTPS y la app instalada o recargada para activar notificaciones.",
};

/** El push requiere SW + PushManager + Notification (no en iOS Safari < 16.4). */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Convierte la clave VAPID pública (base64url) al Uint8Array que pide subscribe(). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  // ArrayBuffer explícito: applicationServerKey exige un BufferSource sobre
  // ArrayBuffer (no SharedArrayBuffer) — necesario para el Uint8Array genérico.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Formato mínimo de una clave VAPID pública P-256 (65 bytes sin comprimir). */
export function isValidVapidPublicKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  try {
    const bytes = urlBase64ToUint8Array(trimmed);
    return bytes.length === 65 && bytes[0] === 0x04;
  } catch {
    return false;
  }
}

/** Registra el SW si falta (p. ej. el usuario activa push antes del evento load). */
async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg?.active) {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    }
    return reg;
  } catch (err) {
    console.error("[push] service worker no disponible:", err);
    return null;
  }
}

/** Suscripción push actual de este dispositivo, o null si no hay. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await ensureServiceWorkerRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

async function subscribeOnPushManager(
  reg: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

/**
 * Pide permiso, suscribe en el push service y registra la suscripción en el
 * backend. Devuelve el resultado con motivo si falla (sin rechazar la promesa).
 */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const trimmedKey = vapidPublicKey.trim();
  if (!isValidVapidPublicKey(trimmedKey)) {
    return { ok: false, reason: "invalid_key" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const reg = await ensureServiceWorkerRegistration();
  if (!reg) return { ok: false, reason: "sw_unavailable" };

  let subscription: PushSubscription;
  try {
    subscription = await subscribeOnPushManager(reg, trimmedKey);
  } catch (firstErr) {
    // Suscripción vieja/corrupta o claves VAPID rotadas: limpiar y reintentar.
    const stale = await reg.pushManager.getSubscription();
    if (stale) await stale.unsubscribe().catch(() => {});

    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(trimmedKey),
      });
    } catch (secondErr) {
      console.error("[push] subscribe falló:", secondErr);
      return { ok: false, reason: "service_error" };
    }
  }

  try {
    const res = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!res.ok) return { ok: false, reason: "backend_error" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "backend_error" };
  }
}

/** Cancela la suscripción local y la borra del backend. */
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getExistingSubscription();
  if (!subscription) return true;

  await fetch("/api/notifications/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  return subscription.unsubscribe();
}
