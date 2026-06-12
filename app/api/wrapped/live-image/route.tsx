/**
 * GET /api/wrapped/live-image — tarjeta de stats en vivo (mini-Wrapped).
 *
 *  - `?user=<uuid>`: renderiza las stats acumuladas del usuario AL MOMENTO
 *    (puntos, precisión, racha actual, posición en el ranking, nivel). A
 *    diferencia del Wrapped, no espera al cierre de fase: compartible siempre.
 *  - `?preview=1`: diseño con datos de muestra (verificación visual).
 *
 * Público/compartible por link (las stats ya son públicas vía /u/[username] y
 * el ranking): se lee con el cliente admin, como las otras dos imágenes.
 */
import { z } from "zod";
import { loadLiveStats } from "@/lib/wrapped/liveStats";
import {
  renderLiveStatsImage,
  SAMPLE_LIVE_STATS,
} from "@/lib/wrapped/liveStatsCard";

const paramsSchema = z.object({ user: z.string().uuid() });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("preview")) {
    return renderLiveStatsImage(SAMPLE_LIVE_STATS);
  }

  const parsed = paramsSchema.safeParse({ user: searchParams.get("user") });
  if (!parsed.success) {
    return new Response("Parámetro 'user' (uuid) requerido.", { status: 400 });
  }

  let stats;
  try {
    stats = await loadLiveStats(parsed.data.user);
  } catch (err) {
    console.error("[api/wrapped/live-image] error cargando stats:", err);
    return new Response("No se pudieron leer las stats.", { status: 500 });
  }
  if (!stats) {
    return new Response("Usuario no encontrado.", { status: 404 });
  }

  return renderLiveStatsImage(stats);
}
