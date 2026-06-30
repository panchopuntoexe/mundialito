/**
 * Backfill de API-Football: mapeo de `api_football_id` + resultados perdidos.
 *
 *   npm run db:backfill
 *
 * El seed (3.3) deja `api_football_id` en null y el sync en vivo (5.4) omite esas
 * filas; además `live=all` no devuelve partidos ya terminados, así que un partido
 * que termina mientras el sync está caído queda atascado en scheduled/live. Este
 * script trae el fixture COMPLETO de la temporada desde API-Football, matchea
 * contra nuestras filas (kickoff + nombres — lib/matches/backfill.ts) y aplica
 * ids y resultados faltantes. Los puntos NO se calculan acá: al quedar una fila
 * `finished` con `processed=false`, Process Results (5.5) la levanta solo.
 *
 * Idempotente: re-correrlo sobre una DB ya backfilleada aplica cero updates.
 * Re-correrlo cuando se definan los cruces de knockout completa los mapeos que
 * hoy queden ambiguos (kickoffs simultáneos con equipos TBD).
 *
 * ⚠️ Si se re-corre `db:seed`, worldcup26.ir puede revertir un kickoff que este
 * backfill corrigió (el seed upsertea kickoff_at): correr `db:backfill` SIEMPRE
 * después de un re-seed.
 *
 * Cliente admin inline a propósito: no importamos `lib/supabase/server.ts`
 * porque arrastra `next/headers`, que no existe fuera del runtime de Next.
 */
import { createClient } from "@supabase/supabase-js";
import { BRACKET_CACHE_KEY } from "@/lib/bracket/types";
import { env, serverEnv } from "@/lib/env";
import { fetchSeasonFixtures } from "@/lib/external/apiFootball";
import { buildBackfillPlan, type BackfillRow } from "@/lib/matches/backfill";
import { del } from "@/lib/redis/client";
import { toTournamentDay } from "@/lib/scoring/streaks";
import type { Database } from "@/types/database";
import type { WinnerTeam } from "@/types/domain";

async function main(): Promise<void> {
  console.info("[backfill] Trayendo el fixture de la temporada desde API-Football …");
  const fixtures = await fetchSeasonFixtures({ apiKey: serverEnv.API_FOOTBALL_KEY });
  console.info(`[backfill] ${fixtures.length} fixtures recibidos.`);

  const admin = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin
    .from("matches")
    .select(
      "id, api_football_id, home_team, away_team, kickoff_at, status, score_home, score_away, winner_team, penalty_home, penalty_away",
    );
  if (error) {
    throw new Error(`[backfill] error leyendo matches: ${error.message}`);
  }

  const rows: BackfillRow[] = (data ?? []).map((r) => ({
    ...r,
    winner_team: r.winner_team as WinnerTeam,
  }));

  const plan = buildBackfillPlan(rows, fixtures);
  for (const w of plan.warnings) console.warn(`[backfill] ⚠ ${w}`);
  console.info(
    `[backfill] ${plan.matched}/${rows.length} filas matcheadas — ` +
      `${plan.updates.length} con cambios, ${plan.unmatchedRows.length} filas y ` +
      `${plan.unmatchedFixtures.length} fixtures sin par.`,
  );

  let applied = 0;
  const daysToInvalidate = new Set<string>();
  for (const u of plan.updates) {
    const { error: upErr } = await admin.from("matches").update(u.fields).eq("id", u.id);
    if (upErr) {
      console.error(`[backfill] error actualizando match ${u.id}: ${upErr.message}`);
      continue;
    }
    applied += 1;
    // Resultado u horario nuevos vuelven obsoleto el snapshot del día (mismo
    // contrato de invalidación que el sync 5.4); mapear el id no lo toca. Si el
    // kickoff cambió, el partido puede haberse movido de día: invalidar ambos.
    if (u.fields.status !== undefined || u.fields.kickoff_at !== undefined) {
      daysToInvalidate.add(toTournamentDay(new Date(u.kickoff_at)));
    }
    if (u.fields.kickoff_at !== undefined) {
      daysToInvalidate.add(toTournamentDay(new Date(u.fields.kickoff_at)));
    }
  }
  const keysToInvalidate = [...daysToInvalidate].map((d) => `fixtures:${d}`);
  // El backfill es el camino que repone resultados de knockout: refresca el cuadro.
  if (applied > 0) keysToInvalidate.push(BRACKET_CACHE_KEY);
  await del(...keysToInvalidate);

  console.info(`[backfill] OK — ${applied}/${plan.updates.length} updates aplicados.`);
  if (applied < plan.updates.length) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("[backfill] Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
