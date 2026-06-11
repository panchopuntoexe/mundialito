/**
 * Cron — Pronósticos de bots (tarea 9.5).
 *
 * Corre piggyback en la invocación de process-results (cada 5 min; sin cron
 * nuevo, Vercel limita la cantidad). Por cada bot y partido próximo:
 *   1. calcula su instante de pronóstico (predictAtFor, determinista),
 *   2. si ya venció y el partido NO empezó (re-validación server-side,
 *      regla de arquitectura 3), genera el pick (decidePrediction),
 *   3. bulk upsert con ignoreDuplicates → idempotente, nunca pisa,
 *   4. avanza la racha de cada bot con predicción nueva por el MISMO código
 *      que los humanos (lib/predictions/updateStreak, 9.4).
 *
 * Determinista de punta a punta: re-correr produce exactamente los mismos
 * picks y cero inserciones nuevas. Bonus: los picks de bots alimentan el
 * consenso post-kickoff.
 */
import { decidePrediction, predictAtFor } from "@/lib/bots/strategy";
import { updateParticipationStreak } from "@/lib/predictions/updateStreak";
import { createAdminClient } from "@/lib/supabase/server";
import type { MacroRound } from "@/types/domain";

const LOOKAHEAD_MS = 36 * 60 * 60 * 1000; // máximo offset de predictAtFor

export interface BotPredictionsSummary {
  /** No había partidos próximos: no se tocó nada. */
  skipped: boolean;
  /** Pares (bot, partido) cuyo instante de pronóstico ya venció. */
  due: number;
  /** Predicciones nuevas insertadas en esta corrida. */
  inserted: number;
  /** Bots cuya racha se actualizó (≥1 predicción nueva). */
  botsWithNewPredictions: number;
}

export async function runBotPredictions(
  now: Date = new Date(),
): Promise<BotPredictionsSummary> {
  const admin = createAdminClient();
  const summary: BotPredictionsSummary = {
    skipped: false,
    due: 0,
    inserted: 0,
    botsWithNewPredictions: 0,
  };

  // Partidos aún no empezados con kickoff dentro de la ventana de lookahead.
  const { data: matches, error: matchErr } = await admin
    .from("matches")
    .select("id, home_team, away_team, macro_round, kickoff_at")
    .eq("status", "scheduled")
    .gt("kickoff_at", now.toISOString())
    .lte("kickoff_at", new Date(now.getTime() + LOOKAHEAD_MS).toISOString());
  if (matchErr) {
    throw new Error(`[botPredictions] error leyendo partidos: ${matchErr.message}`);
  }
  if (!matches || matches.length === 0) {
    summary.skipped = true;
    return summary;
  }

  const { data: bots, error: botsErr } = await admin
    .from("users")
    .select("id")
    .eq("is_bot", true);
  if (botsErr) {
    throw new Error(`[botPredictions] error leyendo bots: ${botsErr.message}`);
  }
  if (!bots || bots.length === 0) {
    summary.skipped = true;
    return summary;
  }

  // Pares vencidos: el bot "decidió" pronosticar en un instante ya pasado,
  // y el partido sigue sin empezar (kickoff > now garantizado por la query).
  const due: { botId: string; match: (typeof matches)[number] }[] = [];
  for (const bot of bots) {
    for (const match of matches) {
      if (predictAtFor(bot.id, match).getTime() <= now.getTime()) {
        due.push({ botId: bot.id, match });
      }
    }
  }
  summary.due = due.length;
  if (due.length === 0) return summary;

  // Filtrar los que ya existen (corridas anteriores): consulta por los bots
  // involucrados acotada a los partidos próximos.
  const dueBotIds = [...new Set(due.map((d) => d.botId))];
  const { data: existing, error: existErr } = await admin
    .from("predictions")
    .select("user_id, match_id")
    .in("user_id", dueBotIds)
    .in(
      "match_id",
      matches.map((m) => m.id),
    );
  if (existErr) {
    throw new Error(
      `[botPredictions] error leyendo predicciones existentes: ${existErr.message}`,
    );
  }
  const already = new Set((existing ?? []).map((p) => `${p.user_id}:${p.match_id}`));

  const rows = due
    .filter((d) => !already.has(`${d.botId}:${d.match.id}`))
    .map((d) => ({
      user_id: d.botId,
      match_id: d.match.id,
      ...decidePrediction(d.botId, d.match),
    }));
  if (rows.length === 0) return summary;

  // ignoreDuplicates: si otra corrida concurrente ya insertó, no pisa nada.
  const { error: upsertErr } = await admin
    .from("predictions")
    .upsert(rows, { onConflict: "user_id,match_id", ignoreDuplicates: true });
  if (upsertErr) {
    throw new Error(
      `[botPredictions] error insertando predicciones: ${upsertErr.message}`,
    );
  }
  summary.inserted = rows.length;

  // Racha: una vez por bot con predicción nueva, mismo código que los humanos.
  // La macro-ronda del día viene de cualquiera de sus partidos pronosticados.
  const byBot = new Map<string, MacroRound>();
  for (const row of rows) {
    if (!byBot.has(row.user_id)) {
      const match = matches.find((m) => m.id === row.match_id);
      byBot.set(row.user_id, (match?.macro_round ?? "group_stage") as MacroRound);
    }
  }
  for (const [botId, macroRound] of byBot) {
    await updateParticipationStreak({ userId: botId, macroRound, now });
  }
  summary.botsWithNewPredictions = byBot.size;

  console.info(
    `[botPredictions] ${summary.inserted} predicciones nuevas de ${byBot.size} bots (${summary.due} pares vencidos).`,
  );
  return summary;
}
