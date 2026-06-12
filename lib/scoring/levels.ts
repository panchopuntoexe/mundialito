/**
 * Niveles por puntos — lógica pura.
 *
 * El nivel es una capa de status DERIVADA de `users.total_points` (fuente única):
 * no se persiste ni afecta el ranking, solo se calcula al vuelo donde se muestra
 * (header, tarjeta Wrapped, filas de leaderboard). Tema: "rol de jugador".
 *
 * El ícono de cada nivel vive en components/icons.tsx (<LevelIcon/>, mapeado
 * por `key`): acá solo datos serializables. Sin imports de env/red/DB: testeable.
 */

export type LevelKey = "suplente" | "titular" | "crack" | "leyenda" | "campeon" | "cesped";

export interface Level {
  key: LevelKey;
  /** Nombre visible, p.ej. "Crack". */
  name: string;
  /** Color del badge (alineado con la paleta de la tarjeta). */
  color: string;
  /** Cota inferior inclusiva de puntos para alcanzar el nivel. */
  minPoints: number;
}

/** Niveles ordenados por `minPoints` ascendente. El primero arranca en 0. */
export const LEVELS: readonly Level[] = [
  { key: "suplente", name: "Suplente", color: "#a1a1aa", minPoints: 0 },
  { key: "titular", name: "Titular", color: "#22c55e", minPoints: 25 },
  { key: "crack", name: "Crack", color: "#f59e0b", minPoints: 50 },
  { key: "leyenda", name: "Leyenda", color: "#eab308", minPoints: 100 },
  { key: "campeon", name: "Campeón", color: "#0ea5e9", minPoints: 150 },
  { key: "cesped", name: "Stop", color: "#ef4444", minPoints: 200 },

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
