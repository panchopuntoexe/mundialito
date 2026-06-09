import { z } from "zod";

/**
 * Validación de variables de entorno con Zod (tarea 0.5).
 *
 * Falla rápido y con mensaje claro si falta una env var requerida.
 *
 * Dos exports:
 * - `env`        → variables públicas (`NEXT_PUBLIC_*`), validadas siempre.
 * - `serverEnv`  → secretos de servidor, validados solo en el server. En el
 *                  cliente, acceder a uno lanza un error (nunca deben leerse ahí).
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  API_FOOTBALL_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  // Endpoint del fixture estático (worldcup26.ir). Solo lo usa el seed (3.3),
  // por eso es opcional: no se fuerza en cada boot de la app.
  WORLDCUP_FIXTURE_URL: z.url().optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

function loadClientEnv() {
  // Referencias estáticas para que Next inline las NEXT_PUBLIC_*.
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `❌ Variables de entorno públicas inválidas o faltantes:\n${format(
        parsed.error,
      )}\n→ Revisa tu .env.local (ver .env.example).`,
    );
  }
  return parsed.data;
}

function loadServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    // En el cliente los secretos no existen: proxy que lanza si se accede.
    return new Proxy({} as ServerEnv, {
      get(_target, prop) {
        throw new Error(
          `Intento de leer la variable de servidor "${String(
            prop,
          )}" en el cliente. Los secretos son server-only.`,
        );
      },
    });
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `❌ Variables de entorno de servidor inválidas o faltantes:\n${format(
        parsed.error,
      )}\n→ Revisa tu .env.local (ver .env.example).`,
    );
  }
  return parsed.data;
}

export const env = loadClientEnv();
export const serverEnv = loadServerEnv();

export type Env = typeof env;
export type { ServerEnv };
