/**
 * Broadcast manual de un anuncio push a TODOS los suscriptores.
 *
 * Llama directo a `sendPushToAll` (cliente admin / service-role): no pasa por el
 * middleware `proxy.ts`, que bloquea `/api/notifications/broadcast` por exigir
 * sesión a todo `/api/*` salvo `/api/cron/*`. Se ejecuta con:
 *
 *   npm run notify:broadcast
 *
 * (= `node --env-file=.env.local --import tsx scripts/broadcast-announcement.ts`)
 *
 * Solo alcanza a quien aceptó el permiso del navegador y tiene suscripción
 * guardada: el Web Push no puede llegar a quien lo rechazó (no hay token).
 */
import { isPushConfigured, sendPushToAll } from "@/lib/notifications/webPush";

const PAYLOAD = {
  title: "⚽ ¡Nuevo! Marcador exacto",
  body: "Ahora puedes pronosticar el marcador exacto de cada partido y sumar más puntos. ¡Haz tu pronóstico de hoy!",
  url: "/",
  tag: "announcement",
};

async function main(): Promise<void> {
  if (!isPushConfigured()) {
    console.error("Push no configurado: faltan las claves VAPID en el entorno.");
    process.exit(1);
  }

  console.log("Enviando broadcast:", PAYLOAD.title);
  const { sent, pruned, users } = await sendPushToAll(PAYLOAD);
  console.log(
    `Listo → enviadas OK: ${sent} | usuarios alcanzados: ${users} | suscripciones muertas purgadas: ${pruned}`,
  );
}

main().catch((err) => {
  console.error("Error enviando el broadcast:", err);
  process.exit(1);
});
