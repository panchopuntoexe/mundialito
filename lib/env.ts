import { z } from "zod";

/**
 * Validación de variables de entorno con Zod (tarea 0.5).
 *
 * Falla rápido y con mensaje claro si falta una env var requerida.
 *
 * División cliente/servidor:
 * - Las `NEXT_PUBLIC_*` se inlinean en el bundle, así que se referencian
 *   estáticamente y se validan siempre.
 * - Los secretos de servidor solo existen en el server; se validan solo cuando
 *   `typeof window === "undefined"` para no romper el render del cliente.
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
});

// Referencias estáticas para que Next inline las NEXT_PUBLIC_*.
const clientRaw = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

const clientParsed = clientSchema.safeParse(clientRaw);
if (!clientParsed.success) {
  throw new Error(
    `❌ Variables de entorno públicas inválidas o faltantes:\n${format(
      clientParsed.error,
    )}\n→ Revisa tu .env.local (ver .env.example).`,
  );
}

const isServer = typeof window === "undefined";

const serverParsed = isServer
  ? serverSchema.safeParse(process.env)
  : ({ success: true, data: {} as z.infer<typeof serverSchema> } as const);

if (isServer && !serverParsed.success) {
  throw new Error(
    `❌ Variables de entorno de servidor inválidas o faltantes:\n${format(
      serverParsed.error,
    )}\n→ Revisa tu .env.local (ver .env.example).`,
  );
}

/**
 * Env validado y tipado. En el cliente, las claves de servidor están vacías
 * (jamás se envían al bundle); accederlas server-side está garantizado.
 */
export const env = {
  ...clientParsed.data,
  ...serverParsed.data,
};

export type Env = typeof env;
