import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { isPushConfigured, sendPushToAll } from "@/lib/notifications/webPush";
import { pushBroadcastSchema } from "@/lib/validations/push";

/**
 * POST /api/notifications/broadcast — anuncio push a TODOS los usuarios
 * suscritos, solo a demanda (tarea 8.7). No lo dispara ningún cron: se invoca
 * manualmente (curl / Postman) con `Authorization: Bearer ${CRON_SECRET}`,
 * el mismo secreto que protege los crons — nunca desde el cliente.
 *
 * Sin body envía el anuncio por defecto (la tarjeta compartible de resultados);
 * el body permite personalizar título/texto/destino para futuros anuncios:
 *
 *   curl -X POST https://<app>/api/notifications/broadcast \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"body": "Otro anuncio", "url": "/ranking"}'
 *
 * El `tag` fijo hace que dos broadcasts seguidos se reemplacen en el
 * dispositivo en vez de apilarse.
 *
 * Runtime Node: `web-push` usa crypto de Node (no corre en edge).
 */
export const runtime = "nodejs";

const DEFAULT_ANNOUNCEMENT = {
  title: "✨ Novedades en Mundialito",
  body: "Ahora puedes compartir la tarjeta con tus resultados del día con tus amigos. ¡Échale un vistazo!",
  url: "/estadisticas",
  tag: "announcement",
};

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Las notificaciones no están configuradas en el servidor." },
      { status: 503 },
    );
  }

  // Body opcional: sin body (o vacío) se usa el anuncio por defecto.
  const raw = await request.json().catch(() => ({}));
  const parsed = pushBroadcastSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { sent, pruned, users } = await sendPushToAll({
      ...DEFAULT_ANNOUNCEMENT,
      ...parsed.data,
    });
    return NextResponse.json({ sent, pruned, users }, { status: 200 });
  } catch (err) {
    console.error("[api/notifications/broadcast] error enviando broadcast:", err);
    return NextResponse.json(
      { error: "No se pudo enviar el anuncio." },
      { status: 500 },
    );
  }
}
