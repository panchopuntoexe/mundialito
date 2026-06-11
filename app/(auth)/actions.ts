"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/redis/client";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createGuestProfileWith } from "@/lib/users/guest";

/**
 * Server actions de autenticación (tarea 2.1).
 *
 * Auth con Supabase: Google (OAuth) + email (magic link / OTP sin contraseña).
 * Ambos flujos vuelven por `/callback` (PKCE → `exchangeCodeForSession`).
 *
 * Config necesaria en el dashboard de Supabase (una sola vez):
 *  - Authentication → Providers → Google: habilitar + Client ID/Secret.
 *  - Authentication → URL Configuration → Redirect URLs: agregar
 *    `http://localhost:3000/callback` y la URL de producción `/callback`.
 */

/** Origen de la request (para construir el redirect de OAuth/magic link). */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  // Fallback si no viene el header `origin` (algunos proxies).
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Inicia el flujo OAuth de Google. Devuelve un redirect del lado del servidor
 * hacia la pantalla de consentimiento de Google.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data.url) {
    redirect(data.url);
  }
}

export type EmailSignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

/**
 * Envía un magic link al email. Usado con `useActionState` desde el formulario.
 * No revela si el email existe: siempre responde "revisá tu correo".
 */
export async function signInWithEmail(
  _prevState: EmailSignInState,
  formData: FormData,
): Promise<EmailSignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Ingresá un email válido." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/callback` },
  });

  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "sent", email };
}

/**
 * Entra como invitado: anonymous sign-in + perfil con username auto-generado.
 *
 * Los anónimos de Supabase son usuarios `authenticated` reales (tienen
 * auth.uid()), así que la RLS, el scoring y los rankings funcionan sin cambios.
 * Requiere `enable_anonymous_sign_ins` (config.toml / dashboard). Rate limit
 * por IP: `x-forwarded-for` es confiable detrás de Vercel; cada invitado real
 * cuenta como MAU, así que solo se crea con el tap del botón (nunca al visitar).
 */
export async function signInAsGuest() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const { allowed } = await rateLimit(`guest:signup:${ip}`, 10, 3600);
  if (!allowed) {
    redirect(
      `/login?error=${encodeURIComponent("Demasiados intentos. Probá de nuevo en un rato.")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    redirect(
      `/login?error=${encodeURIComponent("No pudimos crear tu sesión de invitado. Probá de nuevo.")}`,
    );
  }

  // Perfil con username invitado_xxxxxx. Si falla, no se bloquea la entrada:
  // el gate de (main) lo manda a /onboarding y elige username a mano.
  const admin = createAdminClient();
  await createGuestProfileWith(
    {
      insertProfile: async (row) =>
        (await admin.from("users").insert(row)).error,
    },
    data.user.id,
  );

  redirect("/");
}

/** Cierra la sesión y vuelve al login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
