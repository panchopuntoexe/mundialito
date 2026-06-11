import Link from "next/link";
import { redirect } from "next/navigation";
import { Samy } from "@/components/Samy";
import { SaveAccountButton } from "@/components/SaveAccountButton";
import { SignOutButton } from "@/components/SignOutButton";
import { levelForPoints } from "@/lib/scoring/levels";
import { getServerProfile, getServerUser } from "@/lib/supabase/auth";

/**
 * Layout de la app principal (tarea 2.2 + modo invitado). Triple función:
 *  - Gate de onboarding: con sesión pero sin username (sin fila en
 *    public.users) → /onboarding.
 *  - Visitante SIN sesión (solo llega a las rutas públicas /ranking y /u, el
 *    proxy bloquea el resto): header con CTA "Jugar" en vez de perfil/salir.
 *  - Con perfil: header con nivel, username y cerrar sesión.
 */
export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getServerUser();
  const profile = user ? await getServerProfile() : null;

  if (user && !profile) {
    redirect("/onboarding");
  }

  const level = profile ? levelForPoints(profile.total_points) : null;
  const isAnonymous = user?.is_anonymous ?? false;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Samy />
          <span>
            Mundi<span className="text-brand">alito</span>
          </span>
        </span>
        {profile && level ? (
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
            {isAnonymous && <SaveAccountButton />}
            <SignOutButton isAnonymous={isAnonymous} />
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-brand-strong"
          >
            Jugar
          </Link>
        )}
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
