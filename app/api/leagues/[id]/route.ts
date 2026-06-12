import { NextResponse } from "next/server";
import { z } from "zod";
import { leagueLeaderboardKey } from "@/lib/leaderboards/keys";
import { loadLeagueLeaderboard } from "@/lib/leaderboards/load";
import { cached } from "@/lib/redis/client";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/leagues/[id] — ranking de una liga (tarea 6.4).
 *
 * Solo los miembros lo ven. La membresía se verifica con el cliente RLS: la
 * policy `league_members_select_same_league` solo devuelve la fila si sos
 * miembro, así que un no-miembro obtiene 403. Recién DESPUÉS se sirve el ranking
 * cacheado (`leaderboard:league:{id}`, TTL 5 min) — la clave es compartida entre
 * miembros, por eso el control de acceso va antes de tocar la caché.
 *
 * El ranking lo arma el cliente admin (lee puntos de todos los miembros); lo
 * invalida el cron de resultados (5.6).
 */

const LEADERBOARD_TTL_SECONDS = 300; // 5 min

const idSchema = z.uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "id de liga inválido." }, { status: 400 });
  }
  const leagueId = parsedId.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // ¿Es miembro? La RLS solo devuelve la fila a miembros de la liga.
  const { data: membership, error: membershipErr } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipErr) {
    console.error("[api/leagues/[id]] error verificando membresía:", membershipErr);
    return NextResponse.json(
      { error: "No se pudo verificar la membresía." },
      { status: 500 },
    );
  }
  if (!membership) {
    return NextResponse.json(
      { error: "No eres miembro de esta liga." },
      { status: 403 },
    );
  }

  // Datos de la liga (RLS deja verlos a miembros).
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, invite_code")
    .eq("id", leagueId)
    .maybeSingle();

  try {
    const leaderboard = await cached(
      leagueLeaderboardKey(leagueId),
      LEADERBOARD_TTL_SECONDS,
      () => loadLeagueLeaderboard(leagueId),
    );
    return NextResponse.json({ league, leaderboard });
  } catch (err) {
    console.error("[api/leagues/[id]] GET error:", err);
    return NextResponse.json(
      { error: "No se pudo obtener el ranking de la liga." },
      { status: 500 },
    );
  }
}
