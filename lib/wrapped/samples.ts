/**
 * Datos de muestra de las tarjetas compartibles (Wrapped y resultado de partido).
 *
 * Módulo de datos puro, sin dependencias de `next/og`: se puede importar tanto desde
 * los renderizadores (`card.tsx`, `matchCard.tsx`) y sus API Routes (`?preview=1`)
 * como desde una página/server component normal (la página de preview dev
 * `/wrapped-preview`) sin arrastrar el runtime de generación de imágenes.
 */
import type { WrappedStats } from "@/lib/scoring/wrappedStats";
import type { MatchResultCardData } from "./matchCard";

/** Stats de muestra para previsualizar el diseño del Wrapped (`?preview=1`). */
export const SAMPLE_WRAPPED_STATS: WrappedStats = {
  phase: "group_stage",
  totalPredictions: 12,
  correctPredictions: 8,
  perfectPredictions: 3,
  accuracy: 67,
  totalPoints: 145,
  maxStreak: 6,
  epicMiss: {
    matchId: 7,
    matchLabel: "BRA vs CRC",
    communityCorrectPct: 92,
  },
  achievements: ["first_win", "sharpshooter", "streak_3"],
  levelKey: "crack",
};

/** Datos de muestra para previsualizar la mini-tarjeta de resultado (`?preview=1`). */
export const SAMPLE_MATCH_RESULT: MatchResultCardData = {
  username: "tu_usuario",
  homeTeam: "Argentina",
  awayTeam: "México",
  scoreHome: 2,
  scoreAway: 1,
  resultCorrect: true,
  goalsCorrect: false,
  pointsEarned: 10,
};
