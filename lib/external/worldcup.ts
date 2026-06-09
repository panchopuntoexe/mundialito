/**
 * Cliente de worldcup26.ir — fixture estático del Mundial 2026 (tarea 3.1).
 *
 * Trae el fixture completo (partidos, equipos, grupos) y lo devuelve PARSEADO al
 * shape que consume el seed (3.3): cada fila lleva ya `external_ref`, `phase`
 * granular y `macro_round`. La identidad del partido la posee nuestra PK
 * sintética; este cliente solo aporta `external_ref` (ADR 0002).
 *
 * Diseño (reglas de arquitectura 1 y 2):
 * - El frontend NUNCA llama acá; solo el seed/los jobs server-side lo usan.
 * - La lógica de parseo (`deriveStage`, `parseFixture`) es PURA y testeable sin
 *   red ni env. Solo `fetchFixture` hace HTTP, y recibe la URL inyectada (el
 *   seed la lee de `serverEnv.WORLDCUP_FIXTURE_URL`).
 *
 * ⚠️ Contrato del proveedor: worldcup26.ir no publica un schema estable
 * documentado. El shape crudo de abajo (`fixtureResponseSchema`) es el contrato
 * ASUMIDO; se valida con Zod y, si el proveedor difiere, solo cambian el schema y
 * `deriveStage` — el resto del stack (seed, DB, endpoint) no se entera.
 */
import { z } from "zod";
import type { MacroRound } from "@/types/domain";

// ── Shape crudo asumido de worldcup26.ir (validado con Zod) ─────────
const rawTeamSchema = z.object({
  name: z.string().trim().min(1),
  // URL de la bandera; opcional/ausente según el proveedor.
  flag: z.string().trim().min(1).nullish(),
});

const rawMatchSchema = z.object({
  // ID del proveedor → nuestro `external_ref`. Aceptamos number o string.
  id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  home: rawTeamSchema,
  away: rawTeamSchema,
  // Letra del grupo ('A'..'L') en fase de grupos; ausente/null en knockout.
  group: z.string().trim().min(1).nullish(),
  // Etiqueta de fase del proveedor; ver `deriveStage` para los alias aceptados.
  stage: z.string().trim().min(1),
  // Kickoff en ISO 8601.
  kickoff: z.string().trim().min(1),
});

const fixtureResponseSchema = z.object({
  matches: z.array(rawMatchSchema),
});

// ── Salida parseada (lo que consume el seed 3.3) ───────────────────
export interface ParsedFixtureMatch {
  external_ref: string;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  /** Fase granular: 'group_a'..'group_l', 'round_32', 'round_16', 'quarter', 'semi', 'third_place', 'final'. */
  phase: string;
  /** Macro-ronda: límite de freeze/Wrapped (CONTEXT.md). */
  macro_round: MacroRound;
  /** Kickoff normalizado a ISO 8601 UTC. */
  kickoff_at: string;
}

// ── Mapeo de fase ──────────────────────────────────────────────────
/**
 * Knockout: clave normalizada → fase granular + macro-ronda. El tercer puesto
 * cae en la macro-ronda 'final' (no tiene una propia, CONTEXT.md).
 */
const KNOCKOUT_STAGES: Record<string, { phase: string; macroRound: MacroRound }> = {
  round_of_32: { phase: "round_32", macroRound: "round_32" },
  round_32: { phase: "round_32", macroRound: "round_32" },
  r32: { phase: "round_32", macroRound: "round_32" },
  round_of_16: { phase: "round_16", macroRound: "round_16" },
  round_16: { phase: "round_16", macroRound: "round_16" },
  r16: { phase: "round_16", macroRound: "round_16" },
  quarter_finals: { phase: "quarter", macroRound: "quarter" },
  quarter_final: { phase: "quarter", macroRound: "quarter" },
  quarterfinals: { phase: "quarter", macroRound: "quarter" },
  quarter: { phase: "quarter", macroRound: "quarter" },
  qf: { phase: "quarter", macroRound: "quarter" },
  semi_finals: { phase: "semi", macroRound: "semi" },
  semi_final: { phase: "semi", macroRound: "semi" },
  semifinals: { phase: "semi", macroRound: "semi" },
  semi: { phase: "semi", macroRound: "semi" },
  sf: { phase: "semi", macroRound: "semi" },
  third_place: { phase: "third_place", macroRound: "final" },
  third_place_playoff: { phase: "third_place", macroRound: "final" },
  final: { phase: "final", macroRound: "final" },
};

const GROUP_STAGE_KEYS = new Set(["group", "groups", "group_stage"]);

/** Normaliza una etiqueta libre a clave: minúsculas, separadores → '_'. */
function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * Deriva `phase` (granular) y `macro_round` desde la etiqueta de fase del
 * proveedor y, en grupos, la letra del grupo. La letra puede venir en `group`
 * ("A") o embebida en `stage` ("Group A"). Lanza si la fase es desconocida o un
 * partido de grupo no trae letra válida — nunca tragar el error (CLAUDE.md).
 */
export function deriveStage(
  rawStage: string,
  group?: string | null,
): { phase: string; macroRound: MacroRound } {
  const key = normalizeKey(rawStage);

  if (GROUP_STAGE_KEYS.has(key) || key.startsWith("group_")) {
    const fromStage = key.startsWith("group_") ? key.slice("group_".length) : "";
    const letter = (group ?? fromStage).trim().toLowerCase();
    if (!/^[a-l]$/.test(letter)) {
      throw new Error(
        `worldcup26.ir: partido de grupo sin letra válida (stage="${rawStage}", group="${group ?? ""}")`,
      );
    }
    return { phase: `group_${letter}`, macroRound: "group_stage" };
  }

  const mapped = KNOCKOUT_STAGES[key];
  if (!mapped) {
    throw new Error(`worldcup26.ir: fase desconocida "${rawStage}"`);
  }
  return mapped;
}

/**
 * Valida y mapea la respuesta cruda del fixture a `ParsedFixtureMatch[]`.
 * Pura: sin red ni env. Lanza `ZodError` si el shape no coincide, o `Error` si
 * una fase/kickoff es inválida.
 */
export function parseFixture(raw: unknown): ParsedFixtureMatch[] {
  const data = fixtureResponseSchema.parse(raw);

  return data.matches.map((m) => {
    const { phase, macroRound } = deriveStage(m.stage, m.group);

    const kickoff = new Date(m.kickoff);
    if (Number.isNaN(kickoff.getTime())) {
      throw new Error(
        `worldcup26.ir: kickoff inválido en el partido ${m.id}: "${m.kickoff}"`,
      );
    }

    return {
      external_ref: m.id,
      home_team: m.home.name,
      away_team: m.away.name,
      home_flag: m.home.flag ?? null,
      away_flag: m.away.flag ?? null,
      phase,
      macro_round: macroRound,
      kickoff_at: kickoff.toISOString(),
    };
  });
}

/**
 * Trae el fixture completo desde worldcup26.ir y lo devuelve parseado.
 *
 * `url` se inyecta (el seed la pasa desde `serverEnv.WORLDCUP_FIXTURE_URL`) para
 * no acoplar este módulo a la validación de env y mantenerlo testeable.
 * `fetchImpl` se inyecta en tests.
 */
export async function fetchFixture(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedFixtureMatch[]> {
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(
      `worldcup26.ir respondió ${res.status} ${res.statusText} al pedir el fixture (${url})`,
    );
  }
  const json: unknown = await res.json();
  return parseFixture(json);
}
