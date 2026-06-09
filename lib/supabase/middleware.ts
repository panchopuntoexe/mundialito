import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Refresca la sesión de Supabase en cada request (tarea 2.2).
 *
 * Patrón oficial de @supabase/ssr para Next.js: crea un cliente atado a las
 * cookies de la request/response y llama a `getUser()` para revalidar el token
 * contra el servidor de Auth (NO usar `getSession()` para autorizar: solo lee
 * cookies y es spoofable). Devuelve la response con las cookies actualizadas y
 * el `user` para que el middleware decida el ruteo.
 *
 * IMPORTANTE: hay que devolver SIEMPRE este `response` (o copiar sus cookies a
 * uno nuevo) para no perder el token refrescado.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
