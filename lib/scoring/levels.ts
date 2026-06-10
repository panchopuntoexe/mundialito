/**
 * Niveles por puntos — lógica pura.
 *
 * El nivel es una capa de status DERIVADA de `users.total_points` (fuente única):
 * no se persiste ni afecta el ranking, solo se calcula al vuelo donde se muestra
 * (header, tarjeta Wrapped, filas de leaderboard). Tema: "rol de jugador".
 *
 * `emoji` se usa SOLO en la web UI (el renderer Satori de la tarjeta no soporta
 * emojis: ahí se usa `color` + `name`). Sin imports de env/red/DB: testeable.
 */

export type LevelKey = "suplente" | "titular" | "crack" | "leyenda";

export interface Level {
  key: LevelKey;
  /** Nombre visible, p.ej. "Crack". */
  name: string;
  /** Emoji para la web UI (NO usar en la imagen Satori). */
  emoji: string;
  /** Color del badge (alineado con la paleta de la tarjeta). */
  color: string;
  /** Cota inferior inclusiva de puntos para alcanzar el nivel. */
  minPoints: number;
}

/** Niveles ordenados por `minPoints` ascendente. El primero arranca en 0. */
export const LEVELS: readonly Level[] = [
  { key: "suplente", name: "Suplente", emoji: "🪑", color: "#a1a1aa", minPoints: 0 },
  { key: "titular", name: "Titular", emoji: "👕", color: "#22c55e", minPoints: 100 },
  { key: "crack", name: "Crack", emoji: "⭐", color: "#f59e0b", minPoints: 300 },
  { key: "leyenda", name: "Leyenda", emoji: "👑", color: "#eab308", minPoints: 700 },
] as const;

/** El nivel correspondiente a una cantidad de puntos (el mayor `minPoints` ≤ points). */
export function levelForPoints(points: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.minPoints) current = level;
    else break;
  }
  return current;
}

/** El siguiente nivel a alcanzar, o `null` si ya está en el máximo. */
export function nextLevel(points: number): Level | null {
  for (const level of LEVELS) {
    if (points < level.minPoints) return level;
  }
  return null;
}

/** Busca un nivel por su `key` (para snapshots de la tarjeta). */
export function levelByKey(key: LevelKey): Level {
  return LEVELS.find((l) => l.key === key) ?? LEVELS[0];
}
