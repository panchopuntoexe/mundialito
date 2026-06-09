"use client";

import { useEffect, useState } from "react";
import type { ResultPred } from "@/types/domain";

/**
 * Consenso de la comunidad (tarea 4.6). Tras el kickoff muestra el % de usuarios
 * por opción de resultado. Antes del kickoff no renderiza nada: la distribución
 * es secreta hasta que el partido empieza (el endpoint responde `available:false`).
 */

interface ConsensusData {
  total: number;
  counts: Record<ResultPred, number>;
  percentages: Record<ResultPred, number>;
}

export function Consensus({
  matchId,
  kickoffAt,
  homeTeam,
  awayTeam,
}: {
  matchId: number;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const [data, setData] = useState<ConsensusData | null>(null);
  // Evaluado una vez al montar (lazy init): el consenso se pide solo si el
  // partido ya arrancó. Calcularlo en el cuerpo del render rompería la pureza.
  const [started] = useState(() => Date.now() >= new Date(kickoffAt).getTime());

  useEffect(() => {
    if (!started) return;
    const controller = new AbortController();
    fetch(`/api/matches/${matchId}/consensus`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { available?: boolean } & Partial<ConsensusData>) => {
        if (json.available && typeof json.total === "number") {
          setData(json as ConsensusData);
        }
      })
      .catch(() => {
        // Abortado o error de red: simplemente no se muestra el consenso.
      });
    return () => controller.abort();
  }, [matchId, started]);

  if (!started || !data || data.total === 0) return null;

  const labels: Record<ResultPred, string> = {
    home: homeTeam,
    draw: "Empate",
    away: awayTeam,
  };
  const order: ResultPred[] = ["home", "draw", "away"];

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
        Consenso · {data.total} {data.total === 1 ? "pronóstico" : "pronósticos"}
      </p>
      <ul className="flex flex-col gap-1.5">
        {order
          .filter((key) => data.counts[key] > 0)
          .map((key) => (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate text-foreground-muted">
                {labels[key]}
              </span>
              <span
                className="h-2 rounded-full bg-brand/70"
                style={{ width: `${Math.max(data.percentages[key], 2)}%` }}
                aria-hidden
              />
              <span className="ml-auto tabular-nums text-foreground-muted">
                {data.percentages[key]}%
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
