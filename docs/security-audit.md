# Auditoría de seguridad — Mundialito (tarea 8.5)

Revisión transversal de seguridad antes del deploy. Cubre RLS en todas las
tablas y que ningún secreto llegue al bundle del cliente (ARCHITECTURE §8).

Los dos checks críticos están **automatizados** en
[`lib/security/rls-audit.test.ts`](../lib/security/rls-audit.test.ts): corren en
CI y rompen el build si se agrega una tabla sin RLS o se filtra un secreto a un
componente de cliente.

---

## 1. Row Level Security (RLS)

**Estado: ✅ RLS habilitado en las 9 tablas.**

| Tabla                | RLS | Política de lectura                          | Escritura                         |
| -------------------- | --- | -------------------------------------------- | --------------------------------- |
| `users`              | ✅  | propia (`auth.uid() = id`)                    | propia; leaderboards vía admin    |
| `matches`            | ✅  | pública (lectura)                             | solo sync/seed (service role)     |
| `predictions`        | ✅  | propias; ajenas solo post-kickoff            | propias (RLS revalida ventana)    |
| `leagues`            | ✅  | solo miembros                                | endpoint con admin                |
| `league_members`     | ✅  | miembros de la misma liga                    | endpoint con admin                |
| `streaks`            | ✅  | propia                                        | solo server (admin) — ADR 0001    |
| `achievements`       | ✅  | propia                                        | solo cron (admin)                 |
| `wrapped_cards`      | ✅  | propia (se comparte por image_url de Storage)| solo cron (admin)                 |
| `push_subscriptions` | ✅  | propia (select/delete)                        | endpoint con admin                |

Patrón de escritura sensible (rachas, logros, ligas, suscripciones): el cliente
**no** escribe directo. Va por API Routes que usan el **service role** y setean
`user_id`/`created_by` al usuario autenticado, nunca a un valor del body. La RLS
es defensa en profundidad, no la única barrera.

**Verificación manual en Supabase** (correr en el SQL Editor): no debe devolver
filas — lista tablas de `public` con RLS apagado:

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false;
```

---

## 2. Secretos y bundle del cliente

**Estado: ✅ ningún secreto server-only en código de cliente.**

- Los secretos viven en `serverEnv` ([`lib/env.ts`](../lib/env.ts)), que en el
  navegador es un Proxy que **lanza** si se lo intenta leer. Solo las
  `NEXT_PUBLIC_*` (URL/anon key de Supabase, clave VAPID **pública**) llegan al
  cliente — y son públicas por diseño.
- `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, `VAPID_PRIVATE_KEY`,
  `CRON_SECRET` y `UPSTASH_REDIS_REST_TOKEN` solo se usan server-side.
- `createAdminClient()` (service role, bypasea RLS) solo se importa desde route
  handlers, jobs y el seed — nunca desde un componente `"use client"`.
- Los endpoints de cron se protegen con `Authorization: Bearer ${CRON_SECRET}`
  ([`lib/cron/auth.ts`](../lib/cron/auth.ts)).

El test automatizado falla si un archivo `"use client"` menciona cualquiera de
esos tokens.

---

## 3. Otras barreras ya implementadas

- **Ventana de pronóstico server-side**: el POST revalida `kickoff_at > now()`
  (409 si ya empezó); la RLS de `predictions` lo reafirma.
- **Idempotencia de puntos**: `apply_match_results` hace claim transaccional
  con `processed` (migración 0007) — procesar dos veces no duplica.
- **Rate limiting** (8.4): crear pronóstico (20/min) y crear liga (5/5min) → 429.
- **Cron**: todos los `/api/cron/*` rechazan sin `CRON_SECRET`.

## 4. Pendientes / recomendaciones para producción

- [ ] Setear `VAPID_*` en Vercel si se quiere push en producción (opcional).
- [ ] Confirmar el bucket de Storage de Wrapped con políticas de solo-lectura
      pública para las imágenes y escritura solo por service role.
- [ ] Revisar las CORS/headers del proyecto Supabase (orígenes permitidos).
- [ ] Rotación: el `CRON_SECRET` y el service role no deben compartirse fuera
      de las env vars de Vercel.
