import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InviteCodeCard } from "@/components/InviteCodeCard";
import { Leaderboard } from "@/components/Leaderboard";
import { leagueLeaderboardKey } from "@/lib/leaderboards/keys";
import { loadLeagueLeaderboard } from "@/lib/leaderboards/load";
import { cached } from "@/lib/redis/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Pantalla de una liga (tarea 6.6): código para compartir + ranking en vivo.
 *
 * El control de acceso lo hace la RLS: `leagues_select_member` solo devuelve la
 * liga si sos miembro, así que un no-miembro (o un id inexistente) cae en 404.
 * El ranking inicial sale de la misma clave de caché que el endpoint 6.4; el
 * componente cliente lo mantiene en vivo.
 */

const LEADERBOARD_TTL_SECONDS = 300; // 5 min

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // RLS: solo los miembros ven la liga → null = no miembro o inexistente.
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, invite_code")
    .eq("id", id)
    .maybeSingle();
  if (!league) {
    notFound();
  }

  // Username del que invita, para atribuir el referral en el link (A5).
  const { data: profileRow } = await supabase
    .from("users")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const leaderboard = await cached(
    leagueLeaderboardKey(league.id),
    LEADERBOARD_TTL_SECONDS,
    () => loadLeagueLeaderboard(league.id),
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <Link
          href="/leagues"
          className="text-sm text-foreground-muted transition hover:text-foreground"
        >
          ← Ligas
        </Link>
      </div>

      <h1 className="text-lg font-bold tracking-tight">{league.name}</h1>

      <InviteCodeCard
        leagueName={league.name}
        inviteCode={league.invite_code}
        refUsername={profileRow?.username ?? null}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight">Ranking</h2>
        <Leaderboard
          endpoint={`/api/leagues/${league.id}`}
          initial={leaderboard}
          currentUserId={user.id}
        />
      </section>
    </main>
  );
}
