/**
 * Backfill de API-Football — lógica pura (la consume scripts/backfill-api-football.ts).
 *
 * Resuelve dos huecos que el sync en vivo (5.4) no cubre:
 *
 * 1. MAPEO: el seed (3.3) deja `api_football_id` en null y el sync omite esas
 *    filas. Acá se matchea cada fila contra el fixture de la temporada de
 *    API-Football por kickoff (clave fuerte: ambos salen del calendario oficial)
 *    y, en kickoffs simultáneos, por nombres de equipo normalizados.
 *
 * 2. RESULTADOS PERDIDOS: `live=all` solo devuelve partidos EN CURSO; un partido
 *    que terminó mientras el sync estaba caído queda atascado en scheduled/live.
 *    Acá se repone status/score/winner desde el fixture de temporada para que
 *    Process Results (5.5) calcule los puntos (es idempotente).
 *
 * 3. HORARIOS DISCREPANTES: cuando los proveedores difieren en el kickoff, manda
 *    API-Football (ver MAX_KICKOFF_DRIFT_MS) — un horario atrasado en la DB deja
 *    pronosticar con el partido ya empezado.
 *
 * Sin imports de env/red/DB para que sea testeable sin Supabase ni Redis.
 * Las filas en estado terminal (finished/cancelled) NUNCA se tocan: su resultado
 * ya pudo alimentar puntos; corregirlas es una decisión manual, no de un backfill.
 */
import type { LiveScore } from "@/lib/external/apiFootball";
import type { MatchStatus, WinnerTeam } from "@/types/domain";

/** Fila mínima de `matches` que el backfill evalúa/actualiza. */
export interface BackfillRow {
  id: number;
  api_football_id: number | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: MatchStatus;
  score_home: number | null;
  score_away: number | null;
  winner_team: WinnerTeam;
  penalty_home: number | null;
  penalty_away: number | null;
}

/** Cambios a aplicar a una fila (solo los campos que difieren). */
export interface BackfillUpdate {
  id: number;
  /** Kickoff ORIGINAL de la fila — para invalidar el snapshot `fixtures:{day}`. */
  kickoff_at: string;
  fields: {
    api_football_id?: number;
    status?: MatchStatus;
    score_home?: number | null;
    score_away?: number | null;
    winner_team?: WinnerTeam;
    penalty_home?: number | null;
    penalty_away?: number | null;
    /** Corrección de horario: API-Football manda (ver MAX_KICKOFF_DRIFT_MS). */
    kickoff_at?: string;
  };
}

/**
 * Drift máximo de kickoff para (a) emparejar por nombres cuando los horarios
 * difieren y (b) corregir el horario en la DB. API-Football resultó más fiel al
 * calendario oficial que worldcup26.ir (caso Brazil–Haiti: 00:30Z vs 01:00Z;
 * FIFA confirma 00:30Z) y un kickoff atrasado deja la ventana de pronóstico
 * abierta con el partido ya empezado — inaceptable (regla de arquitectura 3).
 * Más allá de 24 h algo está estructuralmente mal: se avisa y no se toca.
 */
export const MAX_KICKOFF_DRIFT_MS = 24 * 60 * 60_000;

export interface BackfillPlan {
  updates: BackfillUpdate[];
  /** Pares fila↔fixture resueltos (incluye los que no requieren cambios). */
  matched: number;
  /** Filas/fixtures que quedaron sin par — se reportan, no se adivinan. */
  unmatchedRows: BackfillRow[];
  unmatchedFixtures: LiveScore[];
  warnings: string[];
}

// ── Normalización de nombres ───────────────────────────────────────
/** API-Football y worldcup26.ir nombran distinto a algunas selecciones. */
const NAME_ALIASES: Record<string, string> = {
  usa: "united states",
  "korea republic": "south korea",
  "korea dpr": "north korea",
  "ir iran": "iran",
  "cote d ivoire": "ivory coast",
};

/** minúsculas, sin diacríticos, solo [a-z0-9] separados por espacio simple. */
function normalizeName(raw: string): string {
  const flat = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return NAME_ALIASES[flat] ?? flat;
}

/** Tokens combinados de ambos equipos — para puntuar similitud de un par. */
function pairTokens(home: string, away: string): Set<string> {
  return new Set(`${normalizeName(home)} ${normalizeName(away)}`.split(" "));
}

/** Cantidad de tokens en común entre fila y fixture (0 = nada que ver). */
function nameOverlap(row: BackfillRow, fixture: LiveScore): number {
  const a = pairTokens(row.home_team, row.away_team);
  const b = pairTokens(fixture.home_name, fixture.away_name);
  let common = 0;
  for (const t of a) if (b.has(t)) common += 1;
  return common;
}

// ── Matcheo ────────────────────────────────────────────────────────
interface Pair {
  row: BackfillRow;
  fixture: LiveScore;
}

/**
 * Empareja filas con fixtures. Prioridad: (1) `api_football_id` ya mapeado,
 * (2) kickoff exacto único, (3) kickoff exacto múltiple desambiguado por nombres
 * (gana el mayor solapamiento, único y > 0), (4) rescate por par de nombres único
 * a ambos lados con drift de kickoff acotado — captura horarios discrepantes y
 * reprogramaciones. Lo ambiguo queda sin par y se reporta — nunca adivinar
 * (CLAUDE.md: no tragar errores).
 */
export function matchRowsToFixtures(
  rows: readonly BackfillRow[],
  fixtures: readonly LiveScore[],
): { pairs: Pair[]; unmatchedRows: BackfillRow[]; unmatchedFixtures: LiveScore[]; warnings: string[] } {
  const pairs: Pair[] = [];
  const warnings: string[] = [];
  const freeFixtures = new Set(fixtures);
  const unmatchedRows: BackfillRow[] = [];
  /** Filas sin fixture en su instante — su warning se decide tras el rescate (4). */
  const noKickoffMatch = new Set<number>();

  // (1) Filas ya mapeadas: par directo por id.
  const fixtureByApiId = new Map(fixtures.map((f) => [f.api_football_id, f]));
  const pendingRows: BackfillRow[] = [];
  for (const row of rows) {
    const byId = row.api_football_id !== null ? fixtureByApiId.get(row.api_football_id) : undefined;
    if (byId && freeFixtures.has(byId)) {
      pairs.push({ row, fixture: byId });
      freeFixtures.delete(byId);
    } else {
      pendingRows.push(row);
    }
  }

  // (2) y (3): agrupar lo pendiente por instante de kickoff.
  const fixturesByKickoff = new Map<number, LiveScore[]>();
  for (const f of freeFixtures) {
    const t = new Date(f.kickoff_at).getTime();
    fixturesByKickoff.set(t, [...(fixturesByKickoff.get(t) ?? []), f]);
  }

  for (const row of pendingRows) {
    const t = new Date(row.kickoff_at).getTime();
    const candidates = (fixturesByKickoff.get(t) ?? []).filter((f) => freeFixtures.has(f));

    let chosen: LiveScore | undefined;
    if (candidates.length === 1) {
      chosen = candidates[0];
    } else if (candidates.length > 1) {
      // Kickoffs simultáneos (p. ej. 3.ª fecha de grupos): decide el nombre.
      const scored = candidates
        .map((f) => ({ f, score: nameOverlap(row, f) }))
        .sort((a, b) => b.score - a.score);
      const [best, second] = scored;
      if (best.score > 0 && (!second || second.score < best.score)) {
        chosen = best.f;
      } else {
        warnings.push(
          `match ${row.id} (${row.home_team} vs ${row.away_team}, ${row.kickoff_at}): ` +
            `${candidates.length} fixtures simultáneos y nombres ambiguos — sin mapear.`,
        );
      }
    }

    if (chosen) {
      pairs.push({ row, fixture: chosen });
      freeFixtures.delete(chosen);
    } else {
      unmatchedRows.push(row);
      if (candidates.length === 0) noKickoffMatch.add(row.id);
    }
  }

  // (4) Rescate por nombres: si el par (home, away) es único a ambos lados y el
  // drift de kickoff es acotado, es el mismo partido con horario discrepante.
  const pairKey = (home: string, away: string): string =>
    `${normalizeName(home)}|${normalizeName(away)}`;
  const rowsByKey = new Map<string, BackfillRow[]>();
  for (const r of unmatchedRows) {
    const k = pairKey(r.home_team, r.away_team);
    rowsByKey.set(k, [...(rowsByKey.get(k) ?? []), r]);
  }
  const fixturesByKey = new Map<string, LiveScore[]>();
  for (const f of freeFixtures) {
    const k = pairKey(f.home_name, f.away_name);
    fixturesByKey.set(k, [...(fixturesByKey.get(k) ?? []), f]);
  }

  const rescuedIds = new Set<number>();
  for (const [key, rs] of rowsByKey) {
    const fs = fixturesByKey.get(key) ?? [];
    if (rs.length !== 1 || fs.length !== 1) continue;
    const [r] = rs;
    const [f] = fs;
    const drift = Math.abs(new Date(r.kickoff_at).getTime() - new Date(f.kickoff_at).getTime());
    if (drift > MAX_KICKOFF_DRIFT_MS) {
      warnings.push(
        `match ${r.id} (${r.home_team} vs ${r.away_team}): nombres coinciden pero el ` +
          `kickoff difiere demasiado (DB ${r.kickoff_at} vs API ${f.kickoff_at}) — sin mapear.`,
      );
      noKickoffMatch.delete(r.id);
      continue;
    }
    pairs.push({ row: r, fixture: f });
    freeFixtures.delete(f);
    rescuedIds.add(r.id);
  }
  const stillUnmatched = unmatchedRows.filter((r) => !rescuedIds.has(r.id));

  for (const r of stillUnmatched) {
    if (noKickoffMatch.has(r.id)) {
      warnings.push(
        `match ${r.id} (${r.home_team} vs ${r.away_team}): ningún fixture de API-Football ` +
          `con kickoff ${r.kickoff_at} ni par único por nombres — sin mapear.`,
      );
    }
  }

  return { pairs, unmatchedRows: stillUnmatched, unmatchedFixtures: [...freeFixtures], warnings };
}

/**
 * Calcula el plan de updates: completa `api_football_id` faltantes y repone
 * status/score/winner en filas NO terminales cuyo fixture trae novedades.
 * Idempotente: sobre una DB ya backfilleada devuelve cero updates.
 */
export function buildBackfillPlan(
  rows: readonly BackfillRow[],
  fixtures: readonly LiveScore[],
): BackfillPlan {
  const { pairs, unmatchedRows, unmatchedFixtures, warnings } = matchRowsToFixtures(rows, fixtures);

  const updates: BackfillUpdate[] = [];
  for (const { row, fixture } of pairs) {
    const fields: BackfillUpdate["fields"] = {};

    if (row.api_football_id === null) {
      fields.api_football_id = fixture.api_football_id;
    } else if (row.api_football_id !== fixture.api_football_id) {
      warnings.push(
        `match ${row.id}: api_football_id en DB (${row.api_football_id}) difiere del ` +
          `fixture matcheado (${fixture.api_football_id}) — no se pisa.`,
      );
    }

    const terminal = row.status === "finished" || row.status === "cancelled";
    const resultChanged =
      row.status !== fixture.status ||
      row.score_home !== fixture.score_home ||
      row.score_away !== fixture.score_away ||
      row.winner_team !== fixture.winner_team ||
      row.penalty_home !== fixture.penalty_home ||
      row.penalty_away !== fixture.penalty_away;
    if (!terminal && resultChanged) {
      fields.status = fixture.status;
      fields.score_home = fixture.score_home;
      fields.score_away = fixture.score_away;
      fields.winner_team = fixture.winner_team;
      fields.penalty_home = fixture.penalty_home;
      fields.penalty_away = fixture.penalty_away;
    }

    const kickoffDrift =
      new Date(row.kickoff_at).getTime() - new Date(fixture.kickoff_at).getTime();
    if (!terminal && kickoffDrift !== 0 && Math.abs(kickoffDrift) <= MAX_KICKOFF_DRIFT_MS) {
      fields.kickoff_at = fixture.kickoff_at;
      warnings.push(
        `match ${row.id} (${row.home_team} vs ${row.away_team}): kickoff corregido ` +
          `${row.kickoff_at} → ${fixture.kickoff_at} (manda API-Football).`,
      );
    }

    if (Object.keys(fields).length > 0) {
      updates.push({ id: row.id, kickoff_at: row.kickoff_at, fields });
    }
  }

  return { updates, matched: pairs.length, unmatchedRows, unmatchedFixtures, warnings };
}
