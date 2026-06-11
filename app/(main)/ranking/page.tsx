import { AdSlot } from "@/components/ads/AdSlot";
import { GuestCta } from "@/components/GuestCta";
import { RankingTabs } from "@/components/RankingTabs";
import { AD_SLOTS } from "@/lib/ads/config";
import {
  ACCURACY_LEADERBOARD_KEY,
  GLOBAL_LEADERBOARD_KEY,
  STREAK_LEADERBOARD_KEY,
} from "@/lib/leaderboards/keys";
import {
  loadAccuracyLeaderboard,
  loadGlobalLeaderboard,
  loadStreakLeaderboard,
} from "@/lib/leaderboards/load";
import { cached } from "@/lib/redis/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Sección Ranking: el mejor del Mundialito por la métrica que el usuario elija
 * (Puntos / Precisión / Racha). Server Component: pre-carga las 3 listas cacheadas
 * (mismas claves que el endpoint /api/ranking) para el render inicial; el switch de
 * pestañas y el realtime los maneja <RankingTabs/>.
 *
 * Página pública (viralidad): sin sesión también se ve, sin fila resaltada ni
 * realtime, y con el CTA de "Jugar sin cuenta" al pie.
 */

const LEADERBOARD_TTL_SECONDS = 300; // 5 min

export default async function RankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [points, accuracy, streak] = await Promise.all([
    cached(GLOBAL_LEADERBOARD_KEY, LEADERBOARD_TTL_SECONDS, loadGlobalLeaderboard),
    cached(
      ACCURACY_LEADERBOARD_KEY,
      LEADERBOARD_TTL_SECONDS,
      loadAccuracyLeaderboard,
    ),
    cached(STREAK_LEADERBOARD_KEY, LEADERBOARD_TTL_SECONDS, loadStreakLeaderboard),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight">Ranking</h1>
        <p className="text-sm text-foreground-muted">
          Los mejores del Mundialito, por la métrica que elijas. 🏆
        </p>
      </header>

      <RankingTabs
        currentUserId={user?.id ?? null}
        points={points}
        accuracy={accuracy}
        streak={streak}
      />

      {/* Con el flag apagado AdSlot es null: DOM idéntico a hoy (11.3). */}
      <AdSlot slot={AD_SLOTS.ranking} />

      {!user && <GuestCta />}
    </main>
  );
}
