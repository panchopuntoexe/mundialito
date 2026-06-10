/**
 * Cron — Wrapped Generator (tarea 7.3, ARCHITECTURE §4.4).
 *
 * Al completarse una macro-ronda (y el torneo entero al terminar la final),
 * genera la tarjeta Wrapped de cada usuario que pronosticó en esa fase:
 *   1. agrega sus stats (lógica pura 7.1) + el "fallo épico" usando el consenso
 *      por partido (7.3 helpers),
 *   2. inserta la fila en wrapped_cards (idempotente vía unique(user_id, phase)),
 *   3. renderiza la imagen (7.2) y la sube a Supabase Storage,
 *   4. guarda la image_url pública en la fila.
 *
 * La lógica pura vive en `lib/scoring/wrappedStats` y `lib/wrapped/generate`
 * (testeadas); acá solo el cableado con Supabase y Storage.
 */
import {
  buildWrappedStats,
  type WrappedPhase,
  type WrappedPrediction,
} from "@/lib/scoring/wrappedStats";
import type { AchievementType } from "@/lib/scoring/achievements";
import { createAdminClient } from "@/lib/supabase/server";
import { renderWrappedImage } from "@/lib/wrapped/card";
import {
  actualResult,
  communityCorrectPct,
  isMacroRoundComplete,
} from "@/lib/wrapped/generate";
import type { Json } from "@/types/database";
import {
  MACRO_ROUNDS,
  type MatchStatus,
  type ResultPred,
  type WinnerTeam,
} from "@/types/domain";

const STORAGE_BUCKET = "wrapped";

type Admin = ReturnType<typeof createAdminClient>;

/** Partido finalizado con resultado, listo para puntuar el Wrapped. */
interface ResolvedMatch {
  id: number;
  label: string;
  actual: ResultPred;
}

interface PredictionRow {
  user_id: string;
  match_id: number;
  result_pred: ResultPred;
  result_correct: boolean | null;
  goals_correct: boolean | null;
  points_earned: number | null;
}

export interface GenerateWrappedSummary {
  phases: WrappedPhase[];
  cardsCreated: number;
  skippedExisting: number;
}

/**
 * Genera los Wrapped pendientes. Sin `targetPhase` (uso del cron) autodetecta las
 * macro-rondas completas; con `targetPhase` (disparo manual) genera solo esa.
 */
export async function runGenerateWrapped(
  targetPhase?: WrappedPhase,
): Promise<GenerateWrappedSummary> {
  const admin = createAdminClient();
  await ensureBucket(admin);

  const { data: allMatches, error } = await admin
    .from("matches")
    .select(
      "id, home_team, away_team, macro_round, status, score_home, score_away, winner_team",
    );
  if (error) {
    throw new Error(`[generateWrapped] error leyendo partidos: ${error.message}`);
  }
  const matches = allMatches ?? [];

  const phases = targetPhase ? [targetPhase] : detectPhases(matches);

  let cardsCreated = 0;
  let skippedExisting = 0;
  for (const phase of phases) {
    // Para una macro-ronda, solo sus partidos; para el torneo, todos.
    const scope =
      phase === "full_tournament"
        ? matches
        : matches.filter((m) => m.macro_round === phase);
    const res = await generateForPhase(admin, phase, scope);
    cardsCreated += res.cardsCreated;
    skippedExisting += res.skippedExisting;
  }

  console.info(
    `[generateWrapped] fases=${phases.join(",")} creadas=${cardsCreated} omitidas=${skippedExisting}`,
  );
  return { phases, cardsCreated, skippedExisting };
}

/** Macro-rondas completas + 'full_tournament' si la final ya terminó. */
function detectPhases(
  matches: { macro_round: string; status: MatchStatus }[],
): WrappedPhase[] {
  const byRound = new Map<string, MatchStatus[]>();
  for (const m of matches) {
    const arr = byRound.get(m.macro_round) ?? [];
    arr.push(m.status);
    byRound.set(m.macro_round, arr);
  }

  const phases: WrappedPhase[] = MACRO_ROUNDS.filter((r) =>
    isMacroRoundComplete(byRound.get(r) ?? []),
  );
  // Torneo completo: cuando la final está cerrada.
  if (isMacroRoundComplete(byRound.get("final") ?? [])) {
    phases.push("full_tournament");
  }
  return phases;
}

interface MatchRow {
  id: number;
  home_team: string;
  away_team: string;
  status: MatchStatus;
  score_home: number | null;
  score_away: number | null;
  winner_team: string | null;
}

/** Genera (y sube) las tarjetas de una fase para los usuarios que faltan. */
async function generateForPhase(
  admin: Admin,
  phase: WrappedPhase,
  scope: MatchRow[],
): Promise<{ cardsCreated: number; skippedExisting: number }> {
  // Solo partidos con resultado utilizable.
  const resolved = new Map<number, ResolvedMatch>();
  for (const m of scope) {
    if (m.status !== "finished" || m.score_home === null || m.score_away === null) {
      continue;
    }
    resolved.set(m.id, {
      id: m.id,
      label: `${m.home_team} vs ${m.away_team}`,
      actual: actualResult({
        score_home: m.score_home,
        score_away: m.score_away,
        winner_team: m.winner_team as WinnerTeam,
      }),
    });
  }
  if (resolved.size === 0) return { cardsCreated: 0, skippedExisting: 0 };

  const { data: predsData, error: predErr } = await admin
    .from("predictions")
    .select(
      "user_id, match_id, result_pred, result_correct, goals_correct, points_earned",
    )
    .in("match_id", [...resolved.keys()]);
  if (predErr) {
    throw new Error(
      `[generateWrapped] error leyendo predicciones (${phase}): ${predErr.message}`,
    );
  }
  const predictions = (predsData ?? []) as PredictionRow[];

  // Consenso por partido: % de la comunidad que acertó el resultado.
  const correctPctByMatch = computeConsensus(predictions, resolved);

  // Predicciones agrupadas por usuario.
  const byUser = new Map<string, PredictionRow[]>();
  for (const p of predictions) {
    const arr = byUser.get(p.user_id) ?? [];
    arr.push(p);
    byUser.set(p.user_id, arr);
  }
  const userIds = [...byUser.keys()];
  if (userIds.length === 0) return { cardsCreated: 0, skippedExisting: 0 };

  const [existing, usernames, streaks, achievements, totalPoints] =
    await Promise.all([
      existingCardUsers(admin, phase, userIds),
      loadUsernames(admin, userIds),
      loadMaxStreaks(admin, userIds),
      loadAchievements(admin, userIds),
      loadTotalPoints(admin, userIds),
    ]);

  let cardsCreated = 0;
  let skippedExisting = 0;
  for (const userId of userIds) {
    if (existing.has(userId)) {
      skippedExisting += 1;
      continue;
    }

    const wrappedPreds: WrappedPrediction[] = byUser.get(userId)!.map((p) => {
      const match = resolved.get(p.match_id)!;
      return {
        matchId: p.match_id,
        matchLabel: match.label,
        pointsEarned: p.points_earned ?? 0,
        resultCorrect: p.result_correct ?? false,
        goalsCorrect: p.goals_correct ?? false,
        communityCorrectPct: correctPctByMatch.get(p.match_id) ?? 0,
      };
    });

    const stats = buildWrappedStats({
      phase,
      predictions: wrappedPreds,
      maxStreak: streaks.get(userId) ?? 0,
      achievements: achievements.get(userId) ?? [],
      userTotalPoints: totalPoints.get(userId) ?? 0,
    });

    const ok = await persistCard(
      admin,
      userId,
      phase,
      stats,
      usernames.get(userId) ?? "jugador",
    );
    if (ok) cardsCreated += 1;
  }

  return { cardsCreated, skippedExisting };
}

/** Por partido, % de la comunidad que acertó el resultado real. */
function computeConsensus(
  predictions: readonly PredictionRow[],
  resolved: Map<number, ResolvedMatch>,
): Map<number, number> {
  const predsByMatch = new Map<number, ResultPred[]>();
  for (const p of predictions) {
    const arr = predsByMatch.get(p.match_id) ?? [];
    arr.push(p.result_pred);
    predsByMatch.set(p.match_id, arr);
  }
  const out = new Map<number, number>();
  for (const [matchId, match] of resolved) {
    out.set(
      matchId,
      communityCorrectPct(predsByMatch.get(matchId) ?? [], match.actual),
    );
  }
  return out;
}

/**
 * Inserta la fila, renderiza+sube la imagen y guarda la image_url. Devuelve si la
 * tarjeta se creó en ESTA corrida (false si otra carrera ganó el unique).
 */
async function persistCard(
  admin: Admin,
  userId: string,
  phase: WrappedPhase,
  stats: ReturnType<typeof buildWrappedStats>,
  username: string,
): Promise<boolean> {
  const { data: inserted, error: insErr } = await admin
    .from("wrapped_cards")
    .insert({ user_id: userId, phase, stats_json: stats as unknown as Json })
    .select("id")
    .maybeSingle();
  if (insErr) {
    // 23505 = unique violation: otra corrida ya creó la tarjeta (idempotente).
    if (insErr.code !== "23505") {
      console.error(`[generateWrapped] error insertando tarjeta de ${userId}:`, insErr);
    }
    return false;
  }
  if (!inserted) return false;

  const path = `${inserted.id}.png`;
  try {
    const image = await renderWrappedImage({ username, stats });
    const bytes = await image.arrayBuffer();
    const { error: upErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const { error: updErr } = await admin
      .from("wrapped_cards")
      .update({ image_url: pub.publicUrl })
      .eq("id", inserted.id);
    if (updErr) throw new Error(updErr.message);
  } catch (err) {
    // La fila queda creada con stats; la imagen se puede re-servir en vivo desde
    // /api/wrapped/image?card=<id> aunque image_url quede null.
    console.error(`[generateWrapped] error generando imagen de ${userId}:`, err);
  }
  return true;
}

/** Usuarios que YA tienen tarjeta de esta fase (para no regenerarla). */
async function existingCardUsers(
  admin: Admin,
  phase: WrappedPhase,
  userIds: string[],
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("wrapped_cards")
    .select("user_id")
    .eq("phase", phase)
    .in("user_id", userIds);
  if (error) {
    console.error("[generateWrapped] error leyendo tarjetas existentes:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.user_id));
}

async function loadUsernames(
  admin: Admin,
  userIds: string[],
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("users")
    .select("id, username")
    .in("id", userIds);
  if (error) {
    console.error("[generateWrapped] error leyendo usuarios:", error);
    return new Map();
  }
  return new Map((data ?? []).map((u) => [u.id, u.username ?? "jugador"]));
}

async function loadMaxStreaks(
  admin: Admin,
  userIds: string[],
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("streaks")
    .select("user_id, max_streak")
    .in("user_id", userIds);
  if (error) {
    console.error("[generateWrapped] error leyendo rachas:", error);
    return new Map();
  }
  return new Map((data ?? []).map((s) => [s.user_id, s.max_streak ?? 0]));
}

/** Total acumulado de torneo por usuario (define el nivel de la tarjeta). */
async function loadTotalPoints(
  admin: Admin,
  userIds: string[],
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("users")
    .select("id, total_points")
    .in("id", userIds);
  if (error) {
    console.error("[generateWrapped] error leyendo puntos totales:", error);
    return new Map();
  }
  return new Map((data ?? []).map((u) => [u.id, u.total_points ?? 0]));
}

async function loadAchievements(
  admin: Admin,
  userIds: string[],
): Promise<Map<string, AchievementType[]>> {
  const { data, error } = await admin
    .from("achievements")
    .select("user_id, type")
    .in("user_id", userIds);
  if (error) {
    console.error("[generateWrapped] error leyendo logros:", error);
    return new Map();
  }
  const out = new Map<string, AchievementType[]>();
  for (const a of data ?? []) {
    const arr = out.get(a.user_id) ?? [];
    arr.push(a.type as AchievementType);
    out.set(a.user_id, arr);
  }
  return out;
}

/** Crea el bucket público de Wrapped si no existe (idempotente). */
async function ensureBucket(admin: Admin): Promise<void> {
  const { error } = await admin.storage.createBucket(STORAGE_BUCKET, {
    public: true,
  });
  // Ya existe → no-op. Otros errores se loguean pero no abortan el job.
  if (error && !/already exists|exists/i.test(error.message)) {
    console.error("[generateWrapped] error asegurando bucket:", error);
  }
}
