"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/leaderboards/rankings";
import { levelForPoints } from "@/lib/scoring/levels";
import { subscribeToPointsChange } from "@/lib/supabase/realtime";

/**
 * Sección de Ranking con filtros orientados a datos (Puntos / Precisión / Racha).
 *
 * Recibe las 3 listas pre-cargadas y cacheadas por la página server (render inicial
 * rápido, funciona sin JS). Al cambiar de pestaña muestra la lista correspondiente;
 * cuando los puntos del usuario cambian (Realtime) re-fetchea la métrica activa
 * desde `/api/ranking?metric=...`. `currentUserId` resalta tu fila.
 */

type Metric = "points" | "accuracy" | "streak";

const TABS: { key: Metric; label: string }[] = [
  { key: "points", label: "Puntos" },
  { key: "accuracy", label: "Precisión" },
  { key: "streak", label: "Racha" },
];

function metricLabel(metric: Metric, entry: LeaderboardEntry): string {
  switch (metric) {
    case "accuracy":
      return `${entry.accuracy ?? 0}%`;
    case "streak":
      return `${entry.max_streak ?? 0} días`;
    default:
      return `${entry.total_points} pts`;
  }
}

const EMPTY_HINT: Record<Metric, string> = {
  points: "Todavía no hay puntos. Pronostica los partidos del día para aparecer aquí.",
  accuracy:
    "Todavía no hay suficientes pronósticos para rankear por precisión.",
  streak: "Todavía no hay rachas. Pronostica varios días seguidos para aparecer aquí.",
};

export function RankingTabs({
  currentUserId,
  points,
  accuracy,
  streak,
}: {
  /** null = visitante sin sesión: sin fila resaltada ni realtime. */
  currentUserId: string | null;
  points: LeaderboardEntry[];
  accuracy: LeaderboardEntry[];
  streak: LeaderboardEntry[];
}) {
  const [metric, setMetric] = useState<Metric>("points");
  const [lists, setLists] = useState<Record<Metric, LeaderboardEntry[]>>({
    points,
    accuracy,
    streak,
  });

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/ranking?metric=${metric}`);
      if (!res.ok) return;
      const json: { leaderboard?: LeaderboardEntry[] } = await res.json();
      if (Array.isArray(json.leaderboard)) {
        setLists((prev) => ({ ...prev, [metric]: json.leaderboard! }));
      }
    } catch {
      // Error de red: se mantiene la última lista conocida.
    }
  }, [metric]);

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeToPointsChange(currentUserId, refetch);
  }, [currentUserId, refetch]);

  const entries = lists[metric];

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        className="flex gap-1 rounded-lg border border-border bg-surface p-1"
      >
        {TABS.map((tab) => {
          const active = tab.key === metric;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setMetric(tab.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-background"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
          {EMPTY_HINT[metric]}
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {entries.map((entry) => {
            const isMe = entry.user_id === currentUserId;
            const level = levelForPoints(entry.total_points);
            return (
              <li key={entry.user_id}>
                <Link
                  href={`/u/${encodeURIComponent(entry.username)}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                    isMe
                      ? "border-brand bg-brand/10 hover:bg-brand/15"
                      : "border-border bg-surface hover:border-foreground-muted/40"
                  }`}
                >
                  <span className="w-6 shrink-0 text-center font-semibold tabular-nums text-foreground-muted">
                    {entry.rank}
                  </span>
                  <span aria-hidden className="shrink-0" title={`Nivel: ${level.name}`}>
                    {level.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    @{entry.username}
                    {isMe && <span className="ml-1.5 text-xs text-brand">· tú</span>}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {metricLabel(metric, entry)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
