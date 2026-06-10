import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Auditoría de seguridad automatizada (tarea 8.5).
 *
 * Convierte dos criterios de la auditoría en checks que corren en CI, para que
 * una regresión futura (una tabla nueva sin RLS, un secreto filtrado al bundle)
 * rompa los tests en vez de llegar a producción:
 *
 *  1. RLS: toda tabla creada en `supabase/migrations/` activa Row Level Security.
 *  2. Secretos: ningún módulo "use client" referencia secretos server-only.
 *
 * Ver docs/security-audit.md para el detalle de la revisión manual.
 */

const ROOT = process.cwd();

function listSqlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => join(dir, f));
}

/** Recorre un árbol y devuelve los .ts/.tsx (ignorando node_modules/.next). */
function walkSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSource(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("auditoría: RLS en todas las tablas (8.5)", () => {
  const dir = join(ROOT, "supabase", "migrations");
  const sql = listSqlFiles(dir)
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  const created = new Set(
    [...sql.matchAll(/create table\s+(?:if not exists\s+)?public\.(\w+)/gi)].map(
      (m) => m[1],
    ),
  );
  const rlsEnabled = new Set(
    [
      ...sql.matchAll(
        /alter table\s+public\.(\w+)\s+enable row level security/gi,
      ),
    ].map((m) => m[1]),
  );

  it("hay tablas para auditar", () => {
    expect(created.size).toBeGreaterThan(0);
  });

  it("cada tabla creada tiene RLS habilitado", () => {
    const missing = [...created].filter((t) => !rlsEnabled.has(t));
    expect(missing, `Tablas sin RLS: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("auditoría: sin secretos en el cliente (8.5)", () => {
  // Tokens que jamás deben aparecer en un módulo de cliente (irían al bundle).
  const FORBIDDEN = [
    "serverEnv",
    "createAdminClient",
    "SUPABASE_SERVICE_ROLE_KEY",
    "API_FOOTBALL_KEY",
    "VAPID_PRIVATE_KEY",
    "CRON_SECRET",
    "UPSTASH_REDIS_REST_TOKEN",
  ];

  const clientFiles = [join(ROOT, "app"), join(ROOT, "components"), join(ROOT, "lib")]
    .flatMap(walkSource)
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
    .map((f) => ({ file: f, content: readFileSync(f, "utf8") }))
    .filter(({ content }) => /^\s*["']use client["']/.test(content));

  it("hay componentes de cliente para auditar", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it("ningún módulo 'use client' referencia secretos server-only", () => {
    const leaks: string[] = [];
    for (const { file, content } of clientFiles) {
      for (const token of FORBIDDEN) {
        if (content.includes(token)) {
          leaks.push(`${file} → ${token}`);
        }
      }
    }
    expect(leaks, `Filtraciones: ${leaks.join("; ")}`).toEqual([]);
  });
});
