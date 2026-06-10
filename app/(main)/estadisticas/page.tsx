import { redirect } from "next/navigation";
import { WrappedCard } from "@/components/WrappedCard";
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

  const { data: cards } = await supabase
    .from("wrapped_cards")
    .select("id, phase, image_url, stats_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight">Tus estadísticas</h1>
        <p className="text-sm text-foreground-muted">
          Tus tarjetas de cada fase del Mundial. Compartilas y sumá amigos.
        </p>
      </header>

      {!cards || cards.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
          Todavía no hay tarjetas. Al cerrar cada fase del torneo generamos tus
          estadísticas acá. 🎁
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
    </main>
  );
}
