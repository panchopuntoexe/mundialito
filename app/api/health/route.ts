import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis/client";

/**
 * GET /api/health — liveness check (tarea 10.3).
 *
 * Público y sin secretos en la respuesta: pinguea DB (select trivial con el
 * cliente ANON, matches es de lectura pública) y Redis. 503 si algo falla.
 * Cubre el modo de fallo que el email no ve: crons que directamente no corren
 * (apuntar un monitor externo tipo UptimeRobot acá).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = { db: false, redis: false };

  try {
    const anon = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { error } = await anon.from("matches").select("id").limit(1);
    checks.db = !error;
  } catch {
    checks.db = false;
  }

  try {
    checks.redis = (await redis.ping()) === "PONG";
  } catch {
    checks.redis = false;
  }

  const ok = checks.db && checks.redis;
  return NextResponse.json(
    { ok, ...checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
