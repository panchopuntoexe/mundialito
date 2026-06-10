import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { getServerProfile } from "@/lib/supabase/auth";

/**
 * Layout de la app principal (tarea 2.2). Doble función:
 *  - El middleware ya garantiza sesión; acá se aplica el "gate" de onboarding:
 *    si el usuario aún no eligió username (no hay fila en public.users),
 *    se lo manda a /onboarding.
 *  - Provee el header con el username y el botón de cerrar sesión.
 */
export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getServerProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold tracking-tight">
          Mundi<span className="text-brand">alito</span>
        </span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-foreground-muted">@{profile.username}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
            >
              Salir
            </button>
          </form>
        </div>
      </header>
      <nav className="flex items-center gap-1 border-b border-border px-4 py-2 text-sm">
        <Link
          href="/"
          className="rounded-md px-3 py-1.5 font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          Hoy
        </Link>
        <Link
          href="/leagues"
          className="rounded-md px-3 py-1.5 font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          Ligas
        </Link>
        <Link
          href="/wrapped"
          className="rounded-md px-3 py-1.5 font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          Wrapped
        </Link>
      </nav>
      {children}
    </>
  );
}
