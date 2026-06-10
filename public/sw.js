/**
 * Service Worker de Prode Mundial (tareas 8.2 y 8.3).
 *
 * Estrategias:
 *  - Precache del app shell (página offline + iconos) al instalar.
 *  - Navegaciones (mode === 'navigate'): network-first con copia a un cache de
 *    runtime → el HISTORIAL de páginas visitadas queda disponible sin conexión.
 *    Si la red falla y no hay copia, se sirve la página offline.
 *  - Estáticos del propio origen (_next/static, iconos): stale-while-revalidate.
 *  - API y cross-origin (Supabase, Upstash, API-Football): passthrough a la red
 *    (nunca se cachean datos sensibles ni respuestas autenticadas).
 *  - Push: muestra notificaciones (8.3) y enfoca/abre la app al hacer click.
 *
 * Bump CACHE_VERSION para invalidar caches viejos en el próximo deploy.
 */
const CACHE_VERSION = "v1";
const SHELL_CACHE = `prode-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `prode-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET; el resto (POST de pronósticos, etc.) va siempre a la red.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (Supabase, Upstash, API-Football, fuentes): no interceptar.
  if (url.origin !== self.location.origin) return;

  // API del propio backend: network-only (datos frescos, nunca cachear).
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones → network-first con fallback a cache/offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Estáticos del build y assets → stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/** Network-first: guarda copia de la navegación; offline sirve la copia o la página offline. */
async function networkFirstNavigation(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
}

/** Stale-while-revalidate: responde del cache y revalida en segundo plano. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}

// ── Push notifications (tarea 8.3) ───────────────────────────────
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Prode Mundial", body: event.data?.text() ?? "" };
  }

  const title = payload.title ?? "Prode Mundial";
  const options = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana de la app abierta, enfocarla y navegar.
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
