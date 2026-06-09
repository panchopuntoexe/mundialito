import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

/**
 * Helpers de sesión server-side (tarea 2.2).
 *
 * `getServerUser` revalida el token contra Supabase Auth (usa `getUser`, no
 * `getSession`), por lo que es seguro para autorizar en Route Handlers,
 * Server Components y Server Actions.
 */
export async function getServerUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Devuelve la fila de perfil (`public.users`) del usuario autenticado, o `null`
 * si todavía no completó el onboarding (no eligió username). RLS garantiza que
 * solo se lee la propia fila.
 */
export async function getServerProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}
