import { NextResponse } from "next/server";
import { z } from "zod";
import { cached } from "@/lib/redis/client";
import { tournamentDayRangeUtc, tournamentToday } from "@/lib/matches/day";
import { createClient } from "@/lib/supabase/server";
import type { MatchRow } from "@/types/domain";

/**
 * GET /api/matches[?date=YYYY-MM-DD] — partido(s) del día (tarea 3.4).
 *
 * Devuelve TODOS los partidos cuyo kickoff cae en el día (TZ fija del torneo,
 * CONTEXT.md "Partido del día"). Sin `date`, usa el día de hoy del torneo.
 *
 * Caché (ARCHITECTURE §5): `fixtures:{date}` en Redis con TTL 1h. En un HIT el
 * fetcher NO corre, así que no aparece el log de "cache miss" — esa es la señal
 * verificable de que la segunda llamada en <1h se sirvió desde Redis.
 *
 * Regla de arquitectura 2: la lectura pasa por caché; el fetcher lee la DB, nunca
 * la API externa.
 */

const FIXTURES_TTL_SECONDS = 3600; // 1 hora

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD");

/** Columnas del partido que expone el endpoint (sin flags de proceso interno). */
type DayMatch = Pick<
  MatchRow,
  | "id"
  | "home_team"
  | "away_team"
  | "home_flag"
  | "away_flag"
  | "phase"
  | "macro_round"
  | "kickoff_at"
  | "status"
  | "score_home"
  | "score_away"
  | "winner_team"
>;

const DAY_MATCH_COLUMNS =
  "id, home_team, away_team, home_flag, away_flag, phase, macro_round, kickoff_at, status, score_home, score_away, winner_team";

async function loadMatchesForDay(day: string): Promise<DayMatch[]> {
  // Solo se loguea en un MISS (el fetcher no corre en un hit de caché).
  console.info(`[api/matches] cache miss → leyendo DB para ${day}`);

  const { startUtc, endUtc } = tournamentDayRangeUtc(day);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("matches")
    .select(DAY_MATCH_COLUMNS)
    .gte("kickoff_at", startUtc)
    .lt("kickoff_at", endUtc)
    .order("kickoff_at", { ascending: true });

  if (error) {
    console.error("[api/matches] error leyendo matches:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get("date");

  let day: string;
  if (rawDate === null) {
    day = tournamentToday();
  } else {
    const parsed = dateSchema.safeParse(rawDate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Parámetro 'date' inválido." },
        { status: 400 },
      );
    }
    day = parsed.data;
  }

  try {
    const matches = await cached(`fixtures:${day}`, FIXTURES_TTL_SECONDS, () =>
      loadMatchesForDay(day),
    );
    return NextResponse.json({ date: day, matches });
  } catch (err) {
    console.error("[api/matches] GET error:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener los partidos." },
      { status: 500 },
    );
  }
}
