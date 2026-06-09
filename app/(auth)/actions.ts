"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

/** Cierra la sesión y vuelve al login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
