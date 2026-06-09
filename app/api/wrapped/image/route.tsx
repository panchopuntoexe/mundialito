/**
 * GET /api/wrapped/image — imagen PNG de la tarjeta Wrapped (tarea 7.2).
 *
 *  - `?card=<uuid>`: renderiza en vivo la tarjeta guardada (lee stats_json y el
 *    username del dueño). La tarjeta es pública/compartible, así que se lee con el
 *    cliente admin (bypasea RLS) — es el equivalente a un link público de compartir.
 *  - `?preview=1`: renderiza el diseño con stats de muestra (verificación visual).
 *
 * El render lo hace `renderWrappedImage` (lib/wrapped/card), compartido con el cron
 * de Wrapped (7.3) que pre-renderiza y sube la imagen a Storage.
 */
import type { WrappedStats } from "@/lib/scoring/wrappedStats";
import { createAdminClient } from "@/lib/supabase/server";
import { renderWrappedImage, SAMPLE_WRAPPED_STATS } from "@/lib/wrapped/card";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("preview")) {
    return renderWrappedImage({
      username: "tu_usuario",
      stats: SAMPLE_WRAPPED_STATS,
    });
  }

  const cardId = searchParams.get("card");
  if (!cardId) {
    return new Response("Falta el parámetro 'card'.", { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wrapped_cards")
    .select("stats_json, users (username)")
    .eq("id", cardId)
    .maybeSingle();

  if (error) {
    console.error("[api/wrapped/image] error leyendo tarjeta:", error);
    return new Response("No se pudo leer la tarjeta.", { status: 500 });
  }
  if (!data) {
    return new Response("Tarjeta inexistente.", { status: 404 });
  }

  const stats = data.stats_json as unknown as WrappedStats;
  const username = data.users?.username ?? "jugador";

  return renderWrappedImage({ username, stats });
}
