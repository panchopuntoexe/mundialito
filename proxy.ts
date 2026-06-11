import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy de sesión y rutas protegidas (tarea 2.2).
 *
 * En Next 16 la convención `middleware.ts` se renombró a `proxy.ts` (mismo
 * comportamiento, función `proxy`). Sigue siendo el "middleware" de sesión.
 *
 * En cada request:
 *  1. Refresca la sesión de Supabase (cookies) y obtiene el `user`.
 *  2. Deja pasar las rutas públicas de auth (/login, /callback).
 *  3. No interfiere con los crons (/api/cron/*): se autorizan con CRON_SECRET.
 *  4. Sin sesión → API responde 401 JSON; páginas redirigen a /login.
 *  5. Con sesión en /login → redirige a la app (/).
 *
 * El "gate" de onboarding (tener username) vive en el layout de (main), no acá:
 * evita una query a la DB en cada request del middleware.
 */

// Rutas públicas: no requieren sesión. Incluye las imágenes compartibles
// (Wrapped y resultado de partido): assets de link, se sirven sin sesión como un
// OG image.
const PUBLIC_PATHS = [
  "/login",
  "/callback",
  "/api/wrapped/image",
  "/api/matches/result-image",
  // Liveness check (10.3): la apunta un monitor externo, sin sesión.
  "/api/health",
  // Preview dev del Wrapped (mock, sin login). La página hace 404 en producción.
  "/wrapped-preview",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Copia las cookies refrescadas de la sesión a otra response (redirect/401). */
function withSessionCookies(
  target: NextResponse,
  source: NextResponse,
): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Los crons se autorizan con CRON_SECRET dentro de cada route handler.
  if (pathname.startsWith("/api/cron")) {
    return response;
  }

  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api")) {
      return withSessionCookies(
        NextResponse.json({ error: "No autenticado." }, { status: 401 }),
        response,
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return withSessionCookies(NextResponse.redirect(loginUrl), response);
  }

  // Ya logueado: no tiene sentido ver el login.
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return withSessionCookies(NextResponse.redirect(homeUrl), response);
  }

  return response;
}

export const config = {
  /**
   * Corre en todo excepto assets estáticos y de imagen de Next. Así el
   * middleware refresca la sesión en páginas y API por igual.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
