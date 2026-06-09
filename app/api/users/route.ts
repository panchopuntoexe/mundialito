import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { createUserSchema, usernameSchema } from "@/lib/validations/user";

/**
 * Endpoint de perfil de usuario (tarea 2.3 — onboarding).
 *
 * GET  /api/users?username=foo  → { available: boolean }
 * POST /api/users  { username } → crea la fila public.users del usuario actual.
 *
 * La unicidad del username se valida SERVER-SIDE con el cliente admin (la RLS
 * de `users` solo deja ver la fila propia, así que un cliente normal no puede
 * comprobar si otro username existe). El unique de la DB es la red de seguridad
 * final ante carreras.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = usernameSchema.safeParse(searchParams.get("username") ?? "");

  // Formato inválido = no disponible (el form ya muestra el motivo del formato).
  if (!parsed.success) {
    return NextResponse.json({ available: false });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id")
    .eq("username", parsed.data)
    .maybeSingle();

  if (error) {
    console.error("[api/users] GET availability error:", error);
    return NextResponse.json(
      { error: "No se pudo verificar el username." },
      { status: 500 },
    );
  }

  return NextResponse.json({ available: data === null });
}

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

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Username inválido." },
      { status: 422 },
    );
  }
  const { username } = parsed.data;

  const admin = createAdminClient();

  // ¿El usuario ya completó el onboarding?
  const { data: existingProfile } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json(
      { error: "Ya tenés un perfil." },
      { status: 409 },
    );
  }

  // ¿El username está tomado?
  const { data: taken } = await admin
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) {
    return NextResponse.json(
      { error: "Ese username ya está en uso." },
      { status: 409 },
    );
  }

  // Datos del proveedor (Google) si están disponibles.
  const meta = user.user_metadata ?? {};
  const displayName =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    null;
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;

  const { data: created, error } = await admin
    .from("users")
    .insert({
      id: user.id,
      username,
      display_name: displayName,
      avatar_url: avatarUrl,
    })
    .select("id, username, display_name, avatar_url")
    .single();

  if (error) {
    // 23505 = unique_violation (carrera: username o perfil tomado entre el
    // pre-check y el insert).
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ese username ya está en uso." },
        { status: 409 },
      );
    }
    console.error("[api/users] POST insert error:", error);
    return NextResponse.json(
      { error: "No se pudo crear el perfil." },
      { status: 500 },
    );
  }

  return NextResponse.json({ user: created }, { status: 201 });
}
