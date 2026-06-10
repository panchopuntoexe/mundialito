import { NextResponse } from "next/server";
import { generateInviteCode } from "@/lib/leagues/inviteCode";
import { rateLimit } from "@/lib/redis/client";
import { getServerUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { createLeagueSchema } from "@/lib/validations/league";

/**
 * POST /api/leagues — crear una liga privada (tarea 6.1).
 *
 * Flujo:
 *  1. Auth + perfil (FK leagues.created_by → users.id: el creador debe haber
 *     completado el onboarding).
 *  2. Zod valida { name }.
 *  3. Genera un invite_code único (reintenta ante colisión del unique de la DB).
 *  4. Inserta la liga y suma al creador como primer miembro.
 *
 * Usa el cliente admin (como el onboarding de users) para generar el código y
 * devolver la fila creada de forma fiable: la RLS de `leagues` solo deja VER una
 * liga a sus miembros, y el creador aún no lo es al momento del INSERT, así que
 * un `.select()` con el cliente RLS volvería vacío. Seteamos created_by/user_id
 * explícitamente al usuario autenticado, nunca a un valor del body.
 */

const MAX_CODE_ATTEMPTS = 5;

export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Rate limit (8.4): 5 ligas creadas / 5 min por usuario. Evita spam de ligas.
  const limit = await rateLimit(`leagues:create:${user.id}`, 5, 300);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Creaste demasiadas ligas seguidas. Probá en unos minutos." },
      { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
    );
  }

  const admin = createAdminClient();

  // El perfil debe existir: leagues.created_by y league_members.user_id lo referencian.
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Completá el onboarding antes de crear una liga." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = createLeagueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Liga inválida." },
      { status: 422 },
    );
  }
  const { name } = parsed.data;

  // Inserta la liga reintentando si el invite_code choca con uno existente.
  let league: { id: string; name: string; invite_code: string } | null = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode();
    const { data, error } = await admin
      .from("leagues")
      .insert({ name, invite_code: inviteCode, created_by: user.id })
      .select("id, name, invite_code")
      .single();

    if (!error) {
      league = data;
      break;
    }
    // 23505 = unique_violation. El único unique de leagues es invite_code →
    // colisión de código: reintenta con uno nuevo.
    if (error.code === "23505") {
      continue;
    }
    console.error("[api/leagues] error creando liga:", error);
    return NextResponse.json(
      { error: "No se pudo crear la liga." },
      { status: 500 },
    );
  }

  if (!league) {
    console.error("[api/leagues] no se obtuvo invite_code único tras reintentos.");
    return NextResponse.json(
      { error: "No se pudo generar un código único. Probá de nuevo." },
      { status: 500 },
    );
  }

  // El creador es el primer miembro. Si esto falla, la liga quedaría huérfana
  // (sin miembros, invisible por RLS): la borramos para no dejar basura.
  const { error: memberErr } = await admin
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id });
  if (memberErr) {
    console.error("[api/leagues] error sumando al creador como miembro:", memberErr);
    await admin.from("leagues").delete().eq("id", league.id);
    return NextResponse.json(
      { error: "No se pudo crear la liga." },
      { status: 500 },
    );
  }

  return NextResponse.json({ league }, { status: 201 });
}
