import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeGrid } from "@/components/BadgeGrid";
import { LevelIcon } from "@/components/icons";
import { ChangeUsernameForm } from "@/components/ChangeUsernameForm";
import { InviteFriendsCard } from "@/components/InviteFriendsCard";
import { LiveStatsCard } from "@/components/LiveStatsCard";
import { SignOutButton } from "@/components/SignOutButton";
import { WrappedCard } from "@/components/WrappedCard";
import { loadUserRank } from "@/lib/leaderboards/loadRank";
import { loadReferralCount } from "@/lib/referrals/referrals";
import {
  ACHIEVEMENT_DEFS,
  type AchievementType,
} from "@/lib/scoring/achievements";
import { levelForPoints, nextLevel } from "@/lib/scoring/levels";
import type { WrappedPhase, WrappedStats } from "@/lib/scoring/wrappedStats";
import { getServerProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { wrappedPhaseLabel } from "@/lib/wrapped/phases";

/**
 * Pantalla de Estadísticas (tarea 7.4): las tarjetas del usuario por fase del
 * torneo. (Internamente la feature sigue llamándose "wrapped": tabla, lib y API.)
 *
 * Server Component: trae las tarjetas propias (RLS: select own, migración 0006).
 * El cron (7.3) las crea al cerrar cada fase. El compartir lo maneja el componente
 * cliente <WrappedCard/> (Web Share API + atajos).
 */
export default async function EstadisticasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [profile, { data: cards }, { data: earnedRows }, { data: accuracyRow }, { data: streakRow }] =
    await Promise.all([
      getServerProfile(),
      supabase
        .from("wrapped_cards")
        .select("id, phase, image_url, stats_json")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("achievements").select("type").eq("user_id", user.id),
      supabase
        .from("user_accuracy")
        .select("accuracy")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("streaks")
        .select("max_streak")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const earned = (earnedRows ?? []).map((r) => r.type as AchievementType);

  const points = profile?.total_points ?? 0;
  const level = levelForPoints(points);
  const next = nextLevel(points);
  // Progreso dentro del nivel actual hacia el siguiente (0–100).
  const levelPct = next
    ? Math.round(
        ((points - level.minPoints) / (next.minPoints - level.minPoints)) * 100,
      )
    : 100;

  // Posición en el ranking para el TEXTO de compartir (la imagen ya la lleva).
  // Solo con puntos > 0: un "#N de N" para 0 pts no aporta. (A4)
  const accuracyPct = accuracyRow?.accuracy ?? 0;
  const referralCount = profile ? await loadReferralCount(user.id) : 0;
  const liveRankData = points > 0 ? await loadUserRank(points) : null;
  const statsShareText = liveRankData
    ? `Voy #${liveRankData.rank} de ${liveRankData.total} con ${points} pts y ${accuracyPct}% de aciertos en Mundialito 2026 ⚽ ¿Me ganas?`
    : `Llevo ${points} pts y ${accuracyPct}% de aciertos en Mundialito 2026 ⚽ ¿Me ganas?`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight">Tus estadísticas</h1>
        {/* <p className="text-sm text-foreground-muted">
          Tus tarjetas de cada fase del Mundial. Compártelas y suma amigos.
        </p> */}
      </header>

      {/* Stats propios siempre visibles (rediseño de usabilidad): antes esta
          pantalla quedaba vacía hasta la primera tarjeta Wrapped y los números
          del usuario no se veían en ningún lado. */}
      <section className="flex flex-col gap-2">
        {/* <div className="grid grid-cols-3 gap-2">
          <Stat value={`${points}`} label="Puntos" />
          <Stat value={`${accuracyRow?.accuracy ?? 0}%`} label="Precisión" />
          <Stat value={`${streakRow?.max_streak ?? 0}`} label="Racha máx." />
        </div> */}
        {profile && (
          <Link
            href={`/u/${encodeURIComponent(profile.username)}`}
            className="self-start py-1 text-s font-medium text-foreground-muted underline-offset-2 transition hover:text-foreground hover:underline"
          >
            Ver tu perfil público →
          </Link>
        )}
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span
              style={{ color: level.color }}
              className="inline-flex items-center gap-1 font-semibold"
            >
              <LevelIcon level={level.key} /> {level.name}
            </span>
            <span className="text-foreground-muted">
              {next
                ? `${next.minPoints - points} pts para ${next.name}`
                : "Nivel máximo"}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={levelPct}
            aria-label="Progreso al siguiente nivel"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className="h-full rounded-full bg-brand/70"
              style={{ width: `${levelPct}%` }}
            />
          </div>
        </div>
        
      </section>

      {/* Tarjeta de stats en vivo: compartible SIEMPRE, sin esperar al cierre
          de fase (las Wrapped de abajo recién llegan con cada macro-ronda). */}
      <section className="flex flex-col gap-2">
        {/* <h2 className="text-sm font-bold tracking-tight">Comparte tus stats</h2> */}
        {/* <p className="text-xs text-foreground-muted">
          Tus stats al día de hoy, lista para compartir.
        </p> */}
        <LiveStatsCard
          userId={user.id}
          text={statsShareText}
          refUsername={profile?.username ?? null}
        />
      </section>

      {profile && (
        <InviteFriendsCard
          username={profile.username}
          referralCount={referralCount}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight">
          Logros{" "}
          <span className="font-normal text-foreground-muted">
            · {earned.length}/{ACHIEVEMENT_DEFS.length}
          </span>
        </h2>
        <BadgeGrid earned={earned} />
      </section>

      {/* Tarjetas de fase: solo se renderizan cuando existen (las crea el cron
          al cerrar cada macro-ronda). Sin estado vacío: antes de la primera
          tarjeta la sección simplemente no aparece. */}
      {cards && cards.length > 0 && (
        <ul className="flex flex-col gap-6">
          {cards.map((card) => {
            const stats = card.stats_json as unknown as WrappedStats | null;
            return (
              <li key={card.id} className="flex flex-col gap-2">
                <h2 className="text-sm font-bold tracking-tight">
                  {wrappedPhaseLabel(card.phase as WrappedPhase)}
                </h2>
                <WrappedCard
                  cardId={card.id}
                  phaseLabel={wrappedPhaseLabel(card.phase as WrappedPhase)}
                  accuracy={stats?.accuracy ?? 0}
                  imageUrl={card.image_url}
                  refUsername={profile?.username ?? null}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* "Salir" vive acá (no en el header) para descomprimir la barra
          superior; para invitados el botón confirma la pérdida de progreso. */}
      <section
        id="cuenta"
        className="mt-2 flex scroll-mt-20 flex-col gap-3 border-t border-border pt-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-tight">Cuenta</h2>
            <p className="text-xs text-foreground-muted">
              {user.is_anonymous
                ? "Jugando como invitado. Si sales sin guardar, pierdes tu progreso."
                : `Sesión iniciada como @${profile?.username ?? ""}.`}
            </p>
          </div>
          <SignOutButton isAnonymous={user.is_anonymous ?? false} showLabel />
        </div>
        {/* Cambio de username (una sola vez): solo con cuenta guardada — el
            gancho principal es el ex-invitado que quedó como invitado_xxxxxx. */}
        {profile && !user.is_anonymous && !profile.username_changed_at && (
          <ChangeUsernameForm currentUsername={profile.username} />
        )}
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-surface p-3">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
    </div>
  );
}
