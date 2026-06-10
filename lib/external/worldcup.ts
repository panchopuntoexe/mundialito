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
 * ⚠️ Contrato del proveedor (worldcup26.ir):
 *   - `GET /get/games`  → { games: [...] }  (los 104 partidos)
 *   - `GET /get/teams`  → { teams: [...] }  (banderas por id de equipo)
 *   `WORLDCUP_FIXTURE_URL` apunta al endpoint de games; la URL de teams se deriva
 *   de ella (mismo host, segmento `/games` → `/teams`).
 *
 * ⚠️ ZONA HORARIA (crítico para las ventanas de pronóstico):
 *   El proveedor entrega `local_date` como "MM/DD/YYYY HH:mm" SIN offset, en la
 *   hora LOCAL DEL ESTADIO (verificado: la final en MetLife/NY dice 15:00 = 19:00
 *   UTC; el debut en el Azteca dice 13:00 = 19:00 UTC). Como las 16 sedes cruzan
 *   4 husos (México, ET, CT, PT), convertimos cada partido a UTC con la TZ de su
 *   estadio (`STADIUM_TZ_BY_ID`), DST-aware vía `Intl`. Si esta suposición fuera
 *   falsa, el único punto a corregir es `wallTimeToUtc` / el mapa de TZ.
 */
import { z } from "zod";
import type { MacroRound } from "@/types/domain";

// ── Shape crudo del proveedor (validado con Zod) ───────────────────
// worldcup26.ir manda TODOS los campos como string. Solo tipamos lo que usamos.
const rawTeamSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  flag: z.string().trim().min(1).nullish(),
});

const rawGameSchema = z.object({
  // id del partido (1..104) → nuestro `external_ref`.
  id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  // Fase del proveedor: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'.
  type: z.string().trim().min(1),
  // Letra de grupo ('A'..'L') en fase de grupos; 'R32'/'FINAL'/etc. en knockout.
  group: z.string().trim().nullish(),
  // Hora local del estadio: "MM/DD/YYYY HH:mm" (ver nota de zona horaria arriba).
  local_date: z.string().trim().min(1),
  // id de la sede (1..16) → TZ vía STADIUM_TZ_BY_ID.
  stadium_id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  // Equipos: en grupos vienen los nombres; en knockout, ids '0' y un label TBD.
  home_team_id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).nullish(),
  away_team_id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).nullish(),
  home_team_name_en: z.string().trim().nullish(),
  away_team_name_en: z.string().trim().nullish(),
  home_team_label: z.string().trim().nullish(),
  away_team_label: z.string().trim().nullish(),
});

const gamesResponseSchema = z.object({ games: z.array(rawGameSchema) });
const teamsResponseSchema = z.object({ teams: z.array(rawTeamSchema) });

// ── Zona horaria por estadio (worldcup26.ir stadium_id → IANA TZ) ──
// El proveedor da ciudad pero no TZ; la fijamos por id de sede (GET /get/stadiums
// confirma el mapeo id→ciudad). Junio/julio 2026: EE.UU./Canadá en horario de
// verano; México sin DST. `Intl` aplica el offset correcto en cada instante.
const STADIUM_TZ_BY_ID: Record<string, string> = {
  "1": "America/Mexico_City", //  Estadio Azteca — Ciudad de México
  "2": "America/Mexico_City", //  Estadio Akron — Guadalajara
  "3": "America/Monterrey", //    Estadio BBVA — Monterrey
  "4": "America/Chicago", //      AT&T Stadium — Dallas
  "5": "America/Chicago", //      NRG Stadium — Houston
  "6": "America/Chicago", //      Arrowhead — Kansas City
  "7": "America/New_York", //     Mercedes-Benz — Atlanta
  "8": "America/New_York", //     Hard Rock — Miami
  "9": "America/New_York", //     Gillette — Boston
  "10": "America/New_York", //    Lincoln Financial — Philadelphia
  "11": "America/New_York", //    MetLife — Nueva York / Nueva Jersey
  "12": "America/Toronto", //     BMO Field — Toronto
  "13": "America/Vancouver", //   BC Place — Vancouver
  "14": "America/Los_Angeles", // Lumen Field — Seattle
  "15": "America/Los_Angeles", // Levi's — San Francisco Bay Area
  "16": "America/Los_Angeles", // SoFi — Los Ángeles
};

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
 * cae en la macro-ronda 'final' (no tiene una propia, CONTEXT.md). Se aceptan
 * tanto los códigos del proveedor ('r32','qf','third'…) como etiquetas largas.
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
  third: { phase: "third_place", macroRound: "final" },
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
 * proveedor (`type`) y, en grupos, la letra del grupo. La letra puede venir en
 * `group` ("A") o embebida en `type` ("Group A"). Lanza si la fase es desconocida
 * o un partido de grupo no trae letra válida — nunca tragar el error (CLAUDE.md).
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
        `worldcup26.ir: partido de grupo sin letra válida (type="${rawStage}", group="${group ?? ""}")`,
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

// ── Conversión de hora local de estadio → UTC (DST-aware) ──────────
/** Offset (ms) entre la hora local de `timeZone` y UTC en el instante `date`. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const at: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") at[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute, at.second);
  return asUtc - date.getTime();
}

/**
 * Interpreta una hora de pared (`y-mo-d h:mi`) EN `timeZone` y la devuelve como
 * instante UTC. DST-aware: corrige con el offset real de la TZ en ese instante.
 * En junio/julio 2026 no hay transiciones de DST en estas sedes, así que la
 * corrección única es exacta.
 */
function wallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  timeZone: string,
): Date {
  const guessUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset = tzOffsetMs(new Date(guessUtc), timeZone);
  return new Date(guessUtc - offset);
}

/**
 * Parsea `local_date` ("MM/DD/YYYY HH:mm", hora local del estadio) a ISO 8601 UTC
 * usando la TZ de `stadiumId`. Lanza si el formato o el estadio son inválidos.
 */
export function parseLocalDate(localDate: string, stadiumId: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(localDate.trim());
  if (!m) {
    throw new Error(`worldcup26.ir: local_date con formato inesperado: "${localDate}"`);
  }
  const timeZone = STADIUM_TZ_BY_ID[stadiumId];
  if (!timeZone) {
    throw new Error(`worldcup26.ir: stadium_id sin zona horaria conocida: "${stadiumId}"`);
  }
  const [, mo, d, y, h, mi] = m.map(Number) as unknown as number[];
  const utc = wallTimeToUtc(y, mo, d, h, mi, timeZone);
  if (Number.isNaN(utc.getTime())) {
    throw new Error(`worldcup26.ir: local_date inválido: "${localDate}"`);
  }
  return utc.toISOString();
}

/** Nombre del equipo: nombre real en grupos, label TBD en knockout. */
function teamName(name?: string | null, label?: string | null): string {
  return name?.trim() || label?.trim() || "Por definir";
}

/**
 * Valida y mapea las respuestas crudas (games + teams) a `ParsedFixtureMatch[]`.
 * Pura: sin red ni env. `teamsRaw` aporta las banderas por id de equipo; en
 * knockout los ids son '0' (sin equipo aún) → bandera null.
 * Lanza `ZodError` si el shape no coincide, o `Error` si una fase/fecha es inválida.
 */
export function parseFixture(gamesRaw: unknown, teamsRaw?: unknown): ParsedFixtureMatch[] {
  const { games } = gamesResponseSchema.parse(gamesRaw);

  const flagByTeamId = new Map<string, string | null>();
  if (teamsRaw !== undefined) {
    const { teams } = teamsResponseSchema.parse(teamsRaw);
    for (const t of teams) flagByTeamId.set(t.id, t.flag ?? null);
  }

  return games.map((g) => {
    const { phase, macroRound } = deriveStage(g.type, g.group);
    const homeId = g.home_team_id ?? "0";
    const awayId = g.away_team_id ?? "0";

    return {
      external_ref: g.id,
      home_team: teamName(g.home_team_name_en, g.home_team_label),
      away_team: teamName(g.away_team_name_en, g.away_team_label),
      home_flag: homeId === "0" ? null : flagByTeamId.get(homeId) ?? null,
      away_flag: awayId === "0" ? null : flagByTeamId.get(awayId) ?? null,
      phase,
      macro_round: macroRound,
      kickoff_at: parseLocalDate(g.local_date, g.stadium_id),
    };
  });
}

/** Deriva la URL de `/get/teams` desde la de `/get/games`. */
function teamsUrlFrom(gamesUrl: string): string {
  return gamesUrl.replace(/games(\/?)(\?.*)?$/i, "teams$1$2");
}

/**
 * Trae el fixture completo desde worldcup26.ir (games + teams) y lo devuelve
 * parseado. `gamesUrl` se inyecta (el seed la pasa desde
 * `serverEnv.WORLDCUP_FIXTURE_URL`); la URL de teams se deriva de ella.
 * `fetchImpl` se inyecta en tests.
 */
export async function fetchFixture(
  gamesUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedFixtureMatch[]> {
  const get = async (url: string): Promise<unknown> => {
    const res = await fetchImpl(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(
        `worldcup26.ir respondió ${res.status} ${res.statusText} al pedir ${url}`,
      );
    }
    return res.json();
  };

  const [gamesRaw, teamsRaw] = await Promise.all([
    get(gamesUrl),
    get(teamsUrlFrom(gamesUrl)),
  ]);
  return parseFixture(gamesRaw, teamsRaw);
}
