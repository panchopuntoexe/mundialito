import { NextResponse } from "next/server";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validations/push";
import { getServerUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Suscripciones Web Push (tarea 8.3).
 *
 *  POST   — registra/actualiza la suscripción de este dispositivo (upsert por
 *           endpoint único). El user_id se setea al usuario autenticado, nunca
 *           a un valor del body.
 *  DELETE — borra la suscripción por endpoint (al desactivar las notificaciones).
 *
 * Usa el cliente admin (consistente con el resto de escrituras): RLS solo deja
 * VER/BORRAR las propias; el INSERT/UPDATE va por service role.
 */
export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Suscripción inválida." },
      { status: 422 },
    );
  }
  const { endpoint, keys } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[api/notifications/subscribe] error guardando:", error);
    return NextResponse.json(
      { error: "No se pudo guardar la suscripción." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = pushUnsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Endpoint inválido." },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  // Acota por user_id: nadie puede borrar la suscripción de otro por endpoint.
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint)
    .eq("user_id", user.id);
  if (error) {
    console.error("[api/notifications/subscribe] error borrando:", error);
    return NextResponse.json(
      { error: "No se pudo borrar la suscripción." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
