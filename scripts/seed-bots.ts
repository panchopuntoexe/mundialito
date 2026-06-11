/**
 * Seed de bots (tarea 9.3).
 *
 *   npm run bots:seed
 *
 * Crea los ~50 bots del roster: primero el usuario de auth
 * (`auth.admin.createUser`) y después su perfil en `public.users` con
 * `is_bot=true`. Idempotente por username: re-correrlo saltea los ya creados
 * y repara perfiles a medio crear (auth sí, public.users no).
 *
 * Los bots NUNCA pueden loguearse: password aleatorio descartado + ban de
 * 10 años. El email usa plus-addressing del admin
 * (…+mundibot-{username}@gmail.com): único, válido, y cualquier correo
 * perdido cae en la casilla del admin.
 *
 * Cliente admin inline a propósito (mismo patrón que seed-fixtures.ts):
 * `lib/supabase/server.ts` arrastra `next/headers`, que no existe acá.
 */
import { createClient } from "@supabase/supabase-js";
import { BOT_ROSTER } from "@/lib/bots/roster";
import { env, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const EMAIL_PREFIX = "franciscojavgm+mundibot-";
const EMAIL_DOMAIN = "@gmail.com";

function botEmail(username: string): string {
  return `${EMAIL_PREFIX}${username}${EMAIL_DOMAIN}`;
}

async function main(): Promise<void> {
  const admin = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: existing, error: existingErr } = await admin
    .from("users")
    .select("username")
    .in(
      "username",
      BOT_ROSTER.map((b) => b.username),
    );
  if (existingErr) {
    throw new Error(`[bots:seed] Error leyendo usernames: ${existingErr.message}`);
  }
  const alreadySeeded = new Set(existing?.map((u) => u.username));

  let created = 0;
  let repaired = 0;
  let skipped = 0;

  for (const bot of BOT_ROSTER) {
    if (alreadySeeded.has(bot.username)) {
      skipped++;
      continue;
    }

    const email = botEmail(bot.username);
    let authId: string;

    const { data: createdAuth, error: authErr } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        // Descartado a propósito: nadie conoce esta password jamás.
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        // 10 años: el bot no puede iniciar sesión ni recuperar cuenta.
        ban_duration: "87600h",
        user_metadata: { is_bot: true, username: bot.username },
      });

    if (authErr) {
      // Auth creado en una corrida anterior que murió antes del perfil:
      // recuperar su id por email y completar solo public.users.
      const recovered = await findAuthUserByEmail(admin, email);
      if (!recovered) {
        throw new Error(
          `[bots:seed] createUser falló para ${bot.username} y no se pudo recuperar por email: ${authErr.message}`,
        );
      }
      authId = recovered;
      repaired++;
    } else {
      authId = createdAuth.user.id;
      created++;
    }

    const { error: profileErr } = await admin.from("users").insert({
      id: authId,
      username: bot.username,
      display_name: bot.displayName,
      is_bot: true,
    });
    if (profileErr) {
      throw new Error(
        `[bots:seed] Falló el perfil de ${bot.username}: ${profileErr.message}`,
      );
    }
    console.info(`[bots:seed] ✓ ${bot.username} (${bot.displayName})`);
  }

  console.info(
    `[bots:seed] OK — creados: ${created}, reparados: ${repaired}, ya existentes: ${skipped}.`,
  );
}

/** Busca un auth user por email paginando listUsers (solo ruta de reparación). */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createClient<Database>>,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error(`[bots:seed] listUsers falló: ${error.message}`);
    }
    const match = data.users.find((u) => u.email === email);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

main().catch((err: unknown) => {
  console.error("[bots:seed] Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
