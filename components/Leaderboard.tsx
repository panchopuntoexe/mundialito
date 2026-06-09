"use client";

import { useCallback, useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/leaderboards/rankings";
import { subscribeToPointsChange } from "@/lib/supabase/realtime";

/**
 * Ranking en vivo (tareas 6.4/6.5). Renderiza el leaderboard que le pasa la
 * página server (render inicial rápido, funciona sin JS) y se suscribe a Supabase
 * Realtime: cuando los puntos del usuario cambian al procesarse un partido,
 * re-fetchea el ranking completo desde `endpoint` sin recargar la página.
 *
 * `endpoint` es `/api/leagues/global` o `/api/leagues/{id}` — ambos devuelven
 * `{ leaderboard }` cacheado (la invalidación del cron 5.6 garantiza datos frescos
 * tras procesar). `currentUserId` resalta tu fila y define a quién escuchar.
 */
export function Leaderboard({
  endpoint,
  initial,
  currentUserId,
}: {
  endpoint: string;
  initial: LeaderboardEntry[];
  currentUserId: string;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const json: { leaderboard?: LeaderboardEntry[] } = await res.json();
      if (Array.isArray(json.leaderboard)) setEntries(json.leaderboard);
    } catch {
      // Error de red: se mantiene el último ranking conocido.
    }
  }, [endpoint]);

  useEffect(() => {
    return subscribeToPointsChange(currentUserId, refetch);
  }, [currentUserId, refetch]);

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
        Todavía no hay puntos. Pronosticá los partidos del día para aparecer acá.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry) => {
        const isMe = entry.user_id === currentUserId;
        return (
          <li
            key={entry.user_id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
              isMe
                ? "border-brand bg-brand/10"
                : "border-border bg-surface"
            }`}
          >
            <span className="w-6 shrink-0 text-center font-semibold tabular-nums text-foreground-muted">
              {entry.rank}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {entry.display_name ?? `@${entry.username}`}
              {isMe && (
                <span className="ml-1.5 text-xs text-brand">· vos</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums font-semibold">
              {entry.total_points}
              <span className="ml-1 text-xs font-normal text-foreground-muted">
                pts
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
