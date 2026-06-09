import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateLeagueForm } from "@/components/CreateLeagueForm";
import { JoinLeagueForm } from "@/components/JoinLeagueForm";
import { Leaderboard } from "@/components/Leaderboard";
import { GLOBAL_LEADERBOARD_KEY } from "@/lib/leaderboards/keys";
import { loadGlobalLeaderboard } from "@/lib/leaderboards/load";
import { cached } from "@/lib/redis/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Pantalla de ligas (tarea 6.6): crear/unirse, ver mis ligas y el ranking global.
 *
 * Server Component: trae mis ligas (RLS: solo las que integro) y el top global
 * (cacheado en Redis, misma clave que el endpoint 6.3) para el render inicial. El
 * ranking en vivo lo maneja el componente cliente <Leaderboard/>.
 */

const LEADERBOARD_TTL_SECONDS = 300; // 5 min

export default async function LeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id, joined_at, leagues(id, name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const myLeagues = (memberships ?? [])
    .map((m) => m.leagues)
    .filter((l): l is { id: string; name: string } => l !== null);

  const globalLeaderboard = await cached(
    GLOBAL_LEADERBOARD_KEY,
    LEADERBOARD_TTL_SECONDS,
    loadGlobalLeaderboard,
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <CreateLeagueForm />
        <div className="border-t border-border" />
        <JoinLeagueForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight">Mis ligas</h2>
        {myLeagues.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
            Todavía no estás en ninguna liga. Creá una y compartí el código con tus
            amigos. 🏆
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myLeagues.map((league) => (
              <li key={league.id}>
                <Link
                  href={`/leagues/${league.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium transition hover:bg-surface-muted"
                >
                  <span className="truncate">{league.name}</span>
                  <span aria-hidden className="text-foreground-muted">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight">Ranking global</h2>
        <Leaderboard
          endpoint="/api/leagues/global"
          initial={globalLeaderboard}
          currentUserId={user.id}
        />
      </section>
    </main>
  );
}
