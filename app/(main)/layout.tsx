import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { Samy } from "@/components/Samy";
import { levelForPoints } from "@/lib/scoring/levels";
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

  const level = levelForPoints(profile.total_points);

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Samy />
          <span>
            Mundi<span className="text-brand">alito</span>
          </span>
        </span>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-foreground-muted">
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium"
              style={{ color: level.color }}
              title={`Nivel: ${level.name} · ${profile.total_points} pts`}
            >
              <span aria-hidden>{level.emoji}</span>
              {level.name}
            </span>
            @{profile.username}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Salir"
              title="Salir"
              className="rounded-md border border-border p-1.5 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
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
          href="/estadisticas"
          className="rounded-md px-3 py-1.5 font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          Estadísticas
        </Link>
        <Link
          href="/ranking"
          className="rounded-md px-3 py-1.5 font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          Ranking
        </Link>
        <Link
          href="/leagues"
          className="rounded-md px-3 py-1.5 font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          Ligas
        </Link>
      </nav>
      {children}
    </>
  );
}
