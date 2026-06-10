import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/auth";
import { isPushConfigured, sendPushToUser } from "@/lib/notifications/webPush";

/**
 * POST /api/notifications/test — envía una notificación de prueba al usuario
 * autenticado (criterio de aceptación de la tarea 8.3: "llega una notificación
 * de prueba al dispositivo"). Útil también para que el usuario verifique que
 * activó bien las notificaciones.
 *
 * Runtime Node: `web-push` usa crypto de Node (no corre en edge).
 */
export const runtime = "nodejs";

export async function POST() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Las notificaciones no están configuradas en el servidor." },
      { status: 503 },
    );
  }

  try {
    const { sent, pruned } = await sendPushToUser(user.id, {
      title: "Mundialito",
      body: "¡Notificaciones activadas! Te avisaremos de los partidos del día. ⚽",
      url: "/",
      tag: "test",
    });

    if (sent === 0) {
      return NextResponse.json(
        { error: "No tenés dispositivos suscritos. Activá las notificaciones primero." },
        { status: 409 },
      );
    }

    return NextResponse.json({ sent, pruned }, { status: 200 });
  } catch (err) {
    console.error("[api/notifications/test] error enviando push:", err);
    return NextResponse.json(
      { error: "No se pudo enviar la notificación de prueba." },
      { status: 500 },
    );
  }
}
