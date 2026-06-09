/**
 * Autorización de los endpoints de Cron (ARCHITECTURE §8).
 *
 * Vercel Cron envía `Authorization: Bearer ${CRON_SECRET}` en cada disparo. Los
 * route handlers de `/api/cron/*` rechazan con 401 si el header no coincide, para
 * que nadie pueda gatillar los jobs (sync de scores, cálculo de puntos) desde
 * afuera. Server-only: lee el secreto de `serverEnv`.
 */
import { serverEnv } from "@/lib/env";

export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get("authorization");
  return header === `Bearer ${serverEnv.CRON_SECRET}`;
}
