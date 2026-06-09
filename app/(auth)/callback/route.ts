import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de autenticación (tarea 2.1).
 *
 * Punto de retorno común para OAuth (Google) y magic link (email). En flujo PKCE
 * el proveedor redirige acá con `?code=...`; lo canjeamos por una sesión y la
 * persistimos en cookies. Tras esto, el middleware/layout decide si el usuario
 * necesita onboarding (elegir username).
 *
 * `?next=` permite volver a una ruta específica tras el login (default `/`).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // `next` debe ser una ruta relativa para evitar open-redirects.
      const dest = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${dest}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Sin código ni error: link inválido o expirado.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Enlace inválido o expirado.")}`,
  );
}
