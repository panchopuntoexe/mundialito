/**
 * Seed del fixture del Mundial 2026 a la tabla `matches` (tarea 3.3).
 *
 *   npm run db:seed
 *
 * Trae los 104 partidos desde worldcup26.ir (cliente 3.1) y los UPSERTEA por
 * `external_ref`. La identidad la posee la PK sintética (ADR 0002); este seed
 * solo siembra el fixture estático y deja `api_football_id` en null para que el
 * sync de live scores (5.4) lo complete/matchee.
 *
 * Idempotente: re-correrlo NO duplica filas (upsert por external_ref). El payload
 * omite `status`/`score`/`winner_team`/`api_football_id`, así que re-sembrar
 * refresca solo metadata del fixture (equipos, banderas, fase, kickoff) y nunca
 * pisa el estado en vivo de un partido ya empezado.
 *
 * Cliente admin inline a propósito: no importamos `lib/supabase/server.ts`
 * porque arrastra `next/headers`, que no existe fuera del runtime de Next.
 */
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";
import { fetchFixture } from "@/lib/external/worldcup";
import type { Database } from "@/types/database";

type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];

async function main(): Promise<void> {
  const url = serverEnv.WORLDCUP_FIXTURE_URL;
  if (!url) {
    throw new Error(
      "Falta WORLDCUP_FIXTURE_URL en el entorno (ver .env.example). Es el endpoint JSON del fixture de worldcup26.ir.",
    );
  }

  console.info(`[seed] Trayendo el fixture desde ${url} …`);
  const fixture = await fetchFixture(url);
  console.info(`[seed] ${fixture.length} partidos parseados.`);

  const rows: MatchInsert[] = fixture.map((m) => ({
    external_ref: m.external_ref,
    home_team: m.home_team,
    away_team: m.away_team,
    home_flag: m.home_flag,
    away_flag: m.away_flag,
    phase: m.phase,
    macro_round: m.macro_round,
    kickoff_at: m.kickoff_at,
    // api_football_id / status / score / winner_team: los puebla el sync (5.4),
    // no el seed. Se omiten para no pisarlos al re-sembrar.
  }));

  const admin = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin
    .from("matches")
    .upsert(rows, { onConflict: "external_ref" })
    .select("id");

  if (error) {
    throw new Error(`[seed] Falló el upsert de matches: ${error.message}`);
  }

  console.info(`[seed] OK — ${data?.length ?? 0} partidos sembrados/actualizados.`);
}

main().catch((err: unknown) => {
  console.error("[seed] Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
