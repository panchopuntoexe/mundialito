import { redirect } from "next/navigation";
import { BadgeGrid } from "@/components/BadgeGrid";
import { SignOutButton } from "@/components/SignOutButton";
import { WrappedCard } from "@/components/WrappedCard";
import {
  ACHIEVEMENT_DEFS,
  type AchievementType,
} from "@/lib/scoring/achievements";
import type { WrappedPhase, WrappedStats } from "@/lib/scoring/wrappedStats";
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

  const [{ data: cards }, { data: earnedRows }] = await Promise.all([
    supabase
      .from("wrapped_cards")
      .select("id, phase, image_url, stats_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("achievements").select("type").eq("user_id", user.id),
  ]);

  const earned = (earnedRows ?? []).map((r) => r.type as AchievementType);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight">Tus estadísticas</h1>
        <p className="text-sm text-foreground-muted">
          Tus tarjetas de cada fase del Mundial. Compartilas y sumá amigos.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight">
          Logros{" "}
          <span className="font-normal text-foreground-muted">
            · {earned.length}/{ACHIEVEMENT_DEFS.length}
          </span>
        </h2>
        <BadgeGrid earned={earned} />
      </section>

      {!cards || cards.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
          Tu primera tarjeta llega al cerrar la fase de grupos (27 de junio).
          Mientras tanto, pronosticá los partidos de cada día para sumar
          puntos. 🎁
        </p>
      ) : (
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
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* "Salir" vive acá (no en el header) para descomprimir la barra
          superior; para invitados el botón confirma la pérdida de progreso. */}
      <section className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold tracking-tight">Cuenta</h2>
          <p className="text-xs text-foreground-muted">
            {user.is_anonymous
              ? "Jugando como invitado. Si salís sin guardar, perdés tu progreso."
              : "Sesión iniciada."}
          </p>
        </div>
        <SignOutButton isAnonymous={user.is_anonymous ?? false} showLabel />
      </section>
    </main>
  );
}
