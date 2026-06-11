/**
 * Estrategia de pronóstico de bots — lógica pura y determinista (tarea 9.2).
 *
 * `decidePrediction` elige resultado y rango de goles con pesos que mezclan:
 * tier estático del equipo (sin datos de cuotas), skill de la persona y sus
 * sesgos. Semilla por (userId, matchId): re-correr el job produce EXACTAMENTE
 * los mismos picks. Calibrada para ~30–45 % de acierto de resultado: mediocre
 * frente a un humano decente, pero creíble en el ranking.
 *
 * `predictAtFor` reparte el momento del pronóstico de cada bot en
 * [10 min, 36 h] antes del kickoff, según su `earliness`: 50 bots no
 * pronostican en ráfaga y el cron de 5 min nunca pierde la ventana.
 */
import { fnv1a, mulberry32, personaFor } from "@/lib/bots/persona";
import type { GoalsRange, ResultPred } from "@/types/domain";

/** Subconjunto de `matches` que necesita la estrategia. */
export interface BotMatch {
  id: number;
  home_team: string;
  away_team: string;
  macro_round: string;
  kickoff_at: string;
}

export interface BotPick {
  result_pred: ResultPred;
  goals_range_pred: GoalsRange;
}

/**
 * Tier futbolístico estático (1 = élite, 2 = fuerte, resto = 3). Claves con el
 * nombre EXACTO de `matches.home_team`/`away_team` (inglés, vía worldcup26.ir).
 * Los placeholders de knockout ("Winner Match 89") caen al tier 3 por defecto
 * → pesos casi uniformes, degradación elegante.
 */
export const TEAM_TIER: Readonly<Record<string, 1 | 2>> = {
  Argentina: 1,
  Brazil: 1,
  England: 1,
  France: 1,
  Germany: 1,
  Netherlands: 1,
  Portugal: 1,
  Spain: 1,
  Belgium: 2,
  Colombia: 2,
  Croatia: 2,
  Ecuador: 2,
  Japan: 2,
  Mexico: 2,
  Morocco: 2,
  Senegal: 2,
  "South Korea": 2,
  Switzerland: 2,
  "United States": 2,
  Uruguay: 2,
};

const DEFAULT_TIER = 3;

const MIN_OFFSET_MS = 10 * 60 * 1000; // ≥10 min: el cron de 5 min nunca llega tarde.
const MAX_OFFSET_MS = 36 * 60 * 60 * 1000;

/** Elección ponderada determinista. Los pesos no necesitan sumar 1. */
function weightedPick<T extends string>(
  rng: () => number,
  weights: ReadonlyArray<readonly [T, number]>,
): T {
  const total = weights.reduce((sum, [, w]) => sum + Math.max(w, 0), 0);
  let roll = rng() * total;
  for (const [value, weight] of weights) {
    roll -= Math.max(weight, 0);
    if (roll <= 0) return value;
  }
  return weights[weights.length - 1][0];
}

/**
 * Pick de un bot para un partido. Pura: mismo (userId, match) → mismo pick.
 * En knockout NUNCA elige empate (el endpoint humano lo rechaza con 422 y el
 * job de bots replica esa regla de dominio).
 */
export function decidePrediction(userId: string, match: BotMatch): BotPick {
  const persona = personaFor(userId);
  const rng = mulberry32(fnv1a(`${userId}:${match.id}`));

  const tierHome = TEAM_TIER[match.home_team] ?? DEFAULT_TIER;
  const tierAway = TEAM_TIER[match.away_team] ?? DEFAULT_TIER;
  // >0 → el local es favorito. El skill decide cuánto pesa ese favoritismo.
  const favEdge = tierAway - tierHome;
  const isGroupStage = match.macro_round === "group_stage";

  const result = weightedPick<ResultPred>(rng, [
    ["home", 0.38 + 0.1 * favEdge * persona.skill + persona.homeBias],
    ["draw", isGroupStage ? 0.28 * persona.drawAffinity : 0],
    ["away", 0.34 - 0.1 * favEdge * persona.skill],
  ]);

  // Distribución base realista de goles totales, corrida por el tilt personal.
  const t = persona.goalsTilt;
  const goals = weightedPick<GoalsRange>(rng, [
    ["0-1", 0.3 - t],
    ["2-3", 0.45],
    ["4-5", 0.2 + 0.7 * t],
    ["6+", 0.05 + 0.3 * t],
  ]);

  return { result_pred: result, goals_range_pred: goals };
}

/**
 * Instante en que este bot pronostica este partido: kickoff − offset
 * determinista en [10 min, 36 h], moldeado por `earliness` (madrugadores
 * tienden a offsets grandes; rezagados, a pequeños).
 */
export function predictAtFor(userId: string, match: BotMatch): Date {
  const persona = personaFor(userId);
  const rng = mulberry32(fnv1a(`${userId}:${match.id}:timing`));
  // Exponente <1 empuja hacia 1 (offset grande = pronostica temprano).
  const shaped = rng() ** (1.6 - 1.2 * persona.earliness);
  const offsetMs = MIN_OFFSET_MS + shaped * (MAX_OFFSET_MS - MIN_OFFSET_MS);
  return new Date(new Date(match.kickoff_at).getTime() - offsetMs);
}
