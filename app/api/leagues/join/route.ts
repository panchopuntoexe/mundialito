import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { joinLeagueSchema } from "@/lib/validations/league";

/**
 * POST /api/leagues/join — unirse a una liga por invite_code (tarea 6.2).
 *
 * Flujo:
 *  1. Auth + perfil (FK league_members.user_id → users.id).
 *  2. Zod valida y normaliza { invite_code } a mayúsculas.
 *  3. Busca la liga por código → 404 si no existe.
 *  4. Inserta la membresía (idempotente: si ya era miembro, no duplica y responde OK).
 *
 * Usa el cliente admin porque la RLS de `leagues` oculta una liga a quien todavía
 * NO es miembro (no podría resolver el código). La membresía se crea siempre con
 * user_id = usuario autenticado, nunca con un valor del body.
 */
export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Completá el onboarding antes de unirte a una liga." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = joinLeagueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Código inválido." },
      { status: 422 },
    );
  }
  const { invite_code } = parsed.data;

  const { data: league, error: leagueErr } = await admin
    .from("leagues")
    .select("id, name, invite_code")
    .eq("invite_code", invite_code)
    .maybeSingle();
  if (leagueErr) {
    console.error("[api/leagues/join] error buscando liga:", leagueErr);
    return NextResponse.json(
      { error: "No se pudo buscar la liga." },
      { status: 500 },
    );
  }
  if (!league) {
    return NextResponse.json(
      { error: "No existe una liga con ese código." },
      { status: 404 },
    );
  }

  // Idempotente: el PK (league_id, user_id) impide duplicar. Si ya era miembro,
  // ignoramos el conflicto y respondemos como éxito (unirse dos veces es no-op).
  const { error: memberErr } = await admin
    .from("league_members")
    .upsert(
      { league_id: league.id, user_id: user.id },
      { onConflict: "league_id,user_id", ignoreDuplicates: true },
    );
  if (memberErr) {
    console.error("[api/leagues/join] error uniéndose a la liga:", memberErr);
    return NextResponse.json(
      { error: "No se pudo unir a la liga." },
      { status: 500 },
    );
  }

  return NextResponse.json({ league }, { status: 200 });
}
