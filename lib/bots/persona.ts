/**
 * Personas de bots — lógica pura y determinista (tarea 9.2).
 *
 * Una persona es una FUNCIÓN PURA del user id: no hay tabla de perfiles. El id
 * se hashea (FNV-1a) a la semilla de un PRNG (mulberry32) del que se derivan
 * los rasgos. Mismo id → misma persona, siempre; re-correr el job de bots no
 * cambia conducta (idempotencia byte a byte junto con la semilla por partido).
 *
 * Los rasgos están calibrados para que los bots sean MEDIOCRES a propósito
 * (decisión de producto: un humano comprometido debe poder superarlos).
 */

/** Hash FNV-1a de 32 bits. Estable entre runtimes (solo aritmética entera). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** PRNG mulberry32: rápido, determinista, suficiente para pesos de elección. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BotPersona {
  /**
   * Qué tanto pesa el favoritismo (tier de equipos) en su elección.
   * [0.2, 0.55], sesgado hacia abajo: la mayoría ronda 0.3 (mediocre).
   */
  skill: number;
  /** Multiplicador del peso del empate en grupos. [0.4, 1.6]. */
  drawAffinity: number;
  /** Sesgo fijo a favor del local. [-0.05, 0.08]. */
  homeBias: number;
  /** Corrimiento de la distribución de goles (− = pocos goles). [-0.15, 0.15]. */
  goalsTilt: number;
  /** 0 = pronostica a último momento; 1 = madrugador (~36 h antes). [0, 1]. */
  earliness: number;
}

/** Deriva la persona de un bot a partir de su user id. Pura y determinista. */
export function personaFor(userId: string): BotPersona {
  const rng = mulberry32(fnv1a(userId));
  return {
    // Exponente >1 sesga la masa hacia skill bajo (mediocridad mayoritaria).
    skill: 0.2 + 0.35 * rng() ** 1.6,
    drawAffinity: 0.4 + 1.2 * rng(),
    homeBias: -0.05 + 0.13 * rng(),
    goalsTilt: -0.15 + 0.3 * rng(),
    earliness: rng(),
  };
}
