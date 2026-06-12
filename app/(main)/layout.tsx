import Link from "next/link";
import { redirect } from "next/navigation";
import { FaFire } from "react-icons/fa6";
import { BottomNav } from "@/components/BottomNav";
import { LevelIcon } from "@/components/icons";
import { SaveAccountButton } from "@/components/SaveAccountButton";
import { Samy } from "@/components/Samy";
import { levelForPoints } from "@/lib/scoring/levels";
import { getServerProfile, getServerUser } from "@/lib/supabase/auth";
import { GUEST_PREFIX } from "@/lib/users/guest";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout de la app principal (tarea 2.2 + modo invitado + navegación inferior).
 *  - Gate de onboarding: con sesión pero sin username (sin fila en
 *    public.users) → /onboarding.
 *  - Visitante SIN sesión (solo llega a las rutas públicas /ranking y /u, el
 *    proxy bloquea el resto): header con CTA "Jugar" en vez de perfil.
 *  - Con perfil: header compacto con racha, nivel y username. La navegación
 *    vive en <BottomNav/> (fija abajo, marca la tab activa); "Salir" se movió a
 *    Estadísticas → Cuenta para descomprimir el header.
 *  - Invitado (sesión anónima): barra fina bajo el header con "Guardar cuenta".
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

  // Racha actual para el chip del header (RLS: select own). La racha es el
  // gancho de retención: tiene que estar visible en todo momento, no solo en
  // el modal de día completo.
  let currentStreak = 0;
  if (user && profile) {
    const supabase = await createClient();
    const { data: streak } = await supabase
      .from("streaks")
      .select("current_streak")
      .eq("user_id", user.id)
      .maybeSingle();
    currentStreak = streak?.current_streak ?? 0;
  }

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Samy />
          <span>
            Mundi<span className="text-brand">alito</span>
          </span>
        </span>
        {profile && level ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-foreground-muted">
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums ${
                currentStreak > 0 ? "text-accent" : "text-foreground-muted"
              }`}
              title={`Racha: ${currentStreak} ${currentStreak === 1 ? "día" : "días"} pronosticando todos los partidos`}
            >
              <FaFire aria-hidden />
              {currentStreak}
            </span>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium"
              style={{ color: level.color }}
              title={`Nivel: ${level.name} · ${profile.total_points} pts`}
            >
              <LevelIcon level={level.key} />
              {level.name}
            </span>
            <span className="truncate">@{profile.username}</span>
          </span>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-brand-strong"
          >
            Jugar
          </Link>
        )}
      </header>
      {profile && isAnonymous && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-brand/5 px-4 py-1.5 text-xs">
          <span className="truncate text-foreground-muted">
            Jugando como invitado
          </span>
          <SaveAccountButton />
        </div>
      )}
      {/* Ex-invitado que guardó su cuenta pero sigue con el username
          auto-generado: invitarlo a elegir su nombre (se puede una sola vez). */}
      {profile &&
        !isAnonymous &&
        profile.username.startsWith(GUEST_PREFIX) &&
        !profile.username_changed_at && (
          <div className="flex items-center justify-between gap-3 border-b border-border bg-brand/5 px-4 py-1.5 text-xs">
            <span className="truncate text-foreground-muted">
              Cuenta guardada ✓ Todavía tienes un nombre de invitado
            </span>
            <Link
              href="/estadisticas#cuenta"
              className="shrink-0 rounded-full border border-brand/50 bg-brand/10 px-2 py-0.5 font-medium text-brand transition hover:bg-brand/20"
            >
              Elegir mi nombre
            </Link>
          </div>
        )}
      <div className="flex flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
