import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";
import {
  chosenUsernameSchema,
  createUserSchema,
  updateUsernameSchema,
} from "@/lib/validations/user";

/**
 * Endpoint de perfil de usuario (tarea 2.3 — onboarding).
 *
 * GET   /api/users?username=foo  → { available: boolean }
 * POST  /api/users  { username } → crea la fila public.users del usuario actual.
 * PATCH /api/users  { username } → cambia el username (UNA sola vez, y solo con
 *        cuenta guardada — los anónimos primero vinculan Google).
 *
 * La unicidad del username se valida SERVER-SIDE con el cliente admin (la RLS
 * de `users` solo deja ver la fila propia, así que un cliente normal no puede
 * comprobar si otro username existe). El unique de la DB es la red de seguridad
 * final ante carreras, y el trigger de 0013 la de "solo un cambio".
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // `chosen`: los `invitado_*` reservados responden "no disponible".
  const parsed = chosenUsernameSchema.safeParse(
    searchParams.get("username") ?? "",
  );

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

export async function PATCH(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.is_anonymous) {
    return NextResponse.json(
      { error: "Primero guardá tu cuenta para poder cambiar tu nombre." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const parsed = updateUsernameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Username inválido." },
      { status: 422 },
    );
  }
  const { username } = parsed.data;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("username, username_changed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "No tenés perfil." }, { status: 404 });
  }
  if (profile.username_changed_at) {
    return NextResponse.json(
      { error: "Ya cambiaste tu nombre de usuario una vez." },
      { status: 409 },
    );
  }
  if (profile.username === username) {
    return NextResponse.json(
      { error: "Ese ya es tu nombre de usuario." },
      { status: 422 },
    );
  }

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

  // `.is("username_changed_at", null)` cierra la carrera de dos PATCH
  // simultáneos; el trigger de 0013 estampa `username_changed_at` y es la
  // garantía final.
  const { data: updated, error } = await admin
    .from("users")
    .update({ username })
    .eq("id", user.id)
    .is("username_changed_at", null)
    .select("id, username, username_changed_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ese username ya está en uso." },
        { status: 409 },
      );
    }
    console.error("[api/users] PATCH update error:", error);
    return NextResponse.json(
      { error: "No se pudo cambiar el username." },
      { status: 500 },
    );
  }
  if (!updated) {
    // La carrera: otro PATCH ganó entre el pre-check y el update.
    return NextResponse.json(
      { error: "Ya cambiaste tu nombre de usuario una vez." },
      { status: 409 },
    );
  }

  return NextResponse.json({ user: updated });
}
