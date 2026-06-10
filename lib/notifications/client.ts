/**
 * Helpers de Web Push en el cliente (tarea 8.3).
 *
 * Hablan con el navegador (Notification, PushManager) y con nuestros endpoints
 * (/api/notifications/*). No usan secretos: la clave VAPID pública llega por
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY. Se importan desde componentes de cliente.
 */

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

/** Suscripción push actual de este dispositivo, o null si no hay. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Pide permiso, suscribe en el push service y registra la suscripción en el
 * backend. Devuelve true si quedó suscrito.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const res = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  return res.ok;
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
