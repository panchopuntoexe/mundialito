# TASKS.md

Backlog granular para **Mundialito**. Cada tarea es del tamaño de un commit. Trabajar en orden — las fases dependen de las anteriores. Marcar `[x]` al completar.

**Formato de cada tarea:**

- **Objetivo**: qué se logra.
- **Archivos**: dónde se toca.
- **Aceptación**: cómo se sabe que está hecha.
- **Depende de**: tareas previas requeridas.

---

## FASE 0 — Setup del proyecto

### [x] 0.1 — Inicializar Next.js 16 con TypeScript

- **Objetivo**: Proyecto base corriendo con App Router y TS strict.
- **Archivos**: raíz del repo, `tsconfig.json`, `next.config.ts`.
- **Aceptación**: `npm run dev` levanta en :3000. `strict: true` en tsconfig. Alias `@/` configurado.
- **Depende de**: —

### [x] 0.2 — Configurar Tailwind CSS mobile-first

- **Objetivo**: Tailwind funcionando, tokens base de color/tipografía del proyecto.
- **Archivos**: `app/globals.css` (Tailwind v4 es CSS-first: tokens en `@theme`, sin `tailwind.config.ts`).
- **Aceptación**: Una página de prueba renderiza clases de Tailwind. Tema oscuro como base.
- **Depende de**: 0.1

### [x] 0.3 — Configurar ESLint, Prettier y scripts

- **Objetivo**: Linting y formato consistentes; scripts de package.json.
- **Archivos**: `eslint.config.mjs` (flat config), `.prettierrc`, `.prettierignore`, `package.json`.
- **Aceptación**: `npm run lint` y `npm run type-check` pasan en limpio.
- **Depende de**: 0.1

### [x] 0.4 — Setup de Vitest

- **Objetivo**: Framework de tests listo.
- **Archivos**: `vitest.config.ts`, un test dummy.
- **Aceptación**: `npm run test` corre y pasa el test dummy.
- **Depende de**: 0.1

### [x] 0.5 — Variables de entorno y validación

- **Objetivo**: `.env.example` completo y validación de env con Zod al boot.
- **Archivos**: `.env.example`, `lib/env.ts`.
- **Aceptación**: La app falla con error claro si falta una env var requerida.
- **Depende de**: 0.1

### [x] 0.6 — GitHub Actions CI

- **Objetivo**: CI que corre lint + type-check + test en cada PR.
- **Archivos**: `.github/workflows/ci.yml`.
- **Aceptación**: El workflow pasa en un PR de prueba.
- **Depende de**: 0.3, 0.4

---

## FASE 1 — Datos y persistencia

### [x] 1.1 — Proyecto Supabase + cliente

- **Objetivo**: Clientes de Supabase para server y client components.
- **Archivos**: `lib/supabase/server.ts`, `lib/supabase/client.ts`.
- **Aceptación**: Conexión verificada con una query trivial.
- **Depende de**: 0.5

### [x] 1.2 — Migración: tabla `users`

- **Objetivo**: Tabla users + RLS. Incluye `total_points int default 0` (total de torneo: fuente del leaderboard global y del ranking de ligas).
- **Archivos**: `supabase/migrations/0001_users.sql`.
- **Aceptación**: Migración aplica. RLS: cada user lee/edita su fila.
- **Depende de**: 1.1

### [x] 1.3 — Migración: tabla `matches`

- **Objetivo**: Tabla matches con enum status y columna generada total_goals. **PK sintética propia** (no la de API-Football) con `api_football_id` y `external_ref` como columnas unique de lookup (ADR 0002). Incluir `winner_team` ('home'|'away'|null, equipo que avanza en knockout) y `macro_round`.
- **Archivos**: `supabase/migrations/0002_matches.sql`.
- **Aceptación**: Migración aplica. Índices de kickoff y status creados. `api_football_id` y `external_ref` son unique. `total_goals` documentado como reg+alargue sin penales.
- **Depende de**: 1.1

### [x] 1.4 — Migración: tabla `predictions`

- **Objetivo**: Tabla predictions con enums y constraint unique (user, match).
- **Archivos**: `supabase/migrations/0003_predictions.sql`.
- **Aceptación**: No permite dos pronósticos del mismo user al mismo match.
- **Depende de**: 1.2, 1.3

### [x] 1.5 — Migración: `leagues` y `league_members`

- **Objetivo**: Tablas de ligas privadas. `league_members` **sin** contador `total_points`: el ranking de liga se calcula filtrando `users.total_points` por membresía (liga = filtro sobre el total global, no ledger aparte).
- **Archivos**: `supabase/migrations/0004_leagues.sql`.
- **Aceptación**: invite_code único. Borrar liga cascada a members. El ranking de liga refleja el total de torneo del usuario, incluido lo acumulado antes de unirse.
- **Depende de**: 1.2

### [x] 1.6 — Migración: `streaks` y `achievements`

- **Objetivo**: Tablas de gamificación.
- **Archivos**: `supabase/migrations/0005_gamification.sql`.
- **Aceptación**: achievements unique (user, type).
- **Depende de**: 1.2

### [x] 1.7 — Migración: `wrapped_cards`

- **Objetivo**: Tabla de tarjetas Wrapped.
- **Archivos**: `supabase/migrations/0006_wrapped.sql`.
- **Aceptación**: stats_json como jsonb.
- **Depende de**: 1.2

### [x] 1.8 — Tipos TypeScript generados de la DB

- **Objetivo**: Tipos de Supabase + tipos de dominio compartidos.
- **Archivos**: `types/database.ts`, `types/domain.ts`.
- **Aceptación**: `supabase gen types` produce tipos usados sin `any`.
- **Depende de**: 1.2–1.7

### [x] 1.9 — Cliente Upstash Redis + helpers cache-aside

- **Objetivo**: Cliente Redis y helper genérico `cached(key, ttl, fetcher)`.
- **Archivos**: `lib/redis/client.ts`, `lib/redis/cache.ts`.
- **Aceptación**: Test unitario del patrón cache-aside (hit/miss).
- **Depende de**: 0.5, 0.4

---

## FASE 2 — Autenticación

### [x] 2.1 — Auth con Supabase (Google + email)

- **Objetivo**: Login/logout funcional.
- **Archivos**: `app/(auth)/`, `lib/supabase/`.
- **Aceptación**: Usuario inicia sesión y persiste entre recargas.
- **Depende de**: 1.1, 1.2

### [x] 2.2 — Middleware de sesión y rutas protegidas

- **Objetivo**: Proteger rutas de `(main)` y API Routes.
- **Archivos**: `proxy.ts` (Next 16 renombró `middleware.ts` → `proxy.ts`), `lib/supabase/middleware.ts` (helper `updateSession`), helper `getServerUser()` en `lib/supabase/auth.ts`.
- **Aceptación**: Rutas protegidas redirigen a login sin sesión.
- **Depende de**: 2.1

### [x] 2.3 — Onboarding: elegir username

- **Objetivo**: Tras primer login, pedir username único.
- **Archivos**: `app/(auth)/onboarding/`, `app/api/users/route.ts`.
- **Aceptación**: username único validado server-side. No avanza sin uno.
- **Depende de**: 2.1, 1.2

---

## FASE 3 — Integración de datos de partidos

### [x] 3.1 — Cliente de worldcup26.ir (fixture estático)

- **Objetivo**: Cliente para traer fixture, equipos y grupos.
- **Archivos**: `lib/external/worldcup.ts`.
- **Aceptación**: Funciones tipadas que devuelven partidos parseados.
- **Depende de**: 0.5

### [x] 3.2 — Cliente de API-Football (live scores)

- **Objetivo**: Cliente para live scores y estadísticas.
- **Archivos**: `lib/external/apiFootball.ts`.
- **Aceptación**: Llamada a fixtures con league=1&season=2026 devuelve datos.
- **Depende de**: 0.5

### [x] 3.3 — Seed inicial del fixture a la DB

- **Objetivo**: Script que carga los 104 partidos a `matches`. La identidad la posee la PK sintética; matchear filas por `external_ref` (worldcup26.ir) y dejar `api_football_id` para que el sync (5.4) lo complete/matchee. Setear `macro_round` por partido.
- **Archivos**: `scripts/seed-fixtures.ts`.
- **Aceptación**: Tabla matches poblada con los partidos del Mundial. Re-correr el seed no duplica filas (upsert por `external_ref`).
- **Depende de**: 3.1, 1.3

### [x] 3.4 — Endpoint: partido(s) del día (con caché)

- **Objetivo**: GET de los partidos de hoy, cacheado.
- **Archivos**: `app/api/matches/route.ts`.
- **Aceptación**: Segunda llamada en <1h sirve desde Redis (verificable en logs).
- **Depende de**: 1.9, 3.3

---

## FASE 4 — Pronósticos (núcleo del producto)

### [x] 4.1 — Validaciones Zod de pronóstico

- **Objetivo**: Schema de input del pronóstico.
- **Archivos**: `lib/validations/prediction.ts`.
- **Aceptación**: Rechaza enums inválidos y campos faltantes.
- **Depende de**: 1.8

### [x] 4.2 — Endpoint: crear pronóstico (con ventana de tiempo)

- **Objetivo**: POST que valida kickoff y guarda pronóstico. Rechaza `draw` en partidos de knockout (422). Tras guardar, actualiza la **racha de participación** (ver 5.2 / ARCHITECTURE §4.5) — la racha vive aquí, no en el cron de resultados.
- **Archivos**: `app/api/predictions/route.ts`.
- **Aceptación**: Rechaza con 409 si el partido ya empezó. `draw` en knockout → 422. Upsert respeta unique. La racha avanza al completar los partidos abiertos del día.
- **Depende de**: 4.1, 2.2, 3.4

### [x] 4.3 — Endpoint: obtener mi pronóstico de un partido

- **Objetivo**: GET del pronóstico propio.
- **Archivos**: `app/api/predictions/[matchId]/route.ts`.
- **Aceptación**: Devuelve el pronóstico o 404 si no existe.
- **Depende de**: 4.2

### [x] 4.4 — UI: pantalla principal estilo Wordle

- **Objetivo**: Partido del día + selectores de resultado y rango de goles.
- **Archivos**: `app/(main)/page.tsx`, `components/MatchCard.tsx`, `components/PredictionForm.tsx`.
- **Aceptación**: Selección de resultado + goles, botón confirmar. Mobile-first.
- **Depende de**: 4.2, 3.4

### [x] 4.5 — UI: estado "ya pronosticaste" / "cerrado"

- **Objetivo**: Mostrar el pronóstico hecho y bloquear edición tras kickoff.
- **Archivos**: `components/PredictionForm.tsx`.
- **Aceptación**: Tras confirmar o tras kickoff, el form se bloquea.
- **Depende de**: 4.4, 4.3

### [x] 4.6 — UI: consenso de la comunidad (post-cierre)

- **Objetivo**: Tras el kickoff, mostrar % de usuarios por opción.
- **Archivos**: `app/api/matches/[id]/consensus/route.ts`, `components/Consensus.tsx`.
- **Aceptación**: Muestra distribución solo después del kickoff.
- **Depende de**: 4.2

---

## FASE 5 — Scoring y jobs (motor automático)

### [x] 5.1 — Lógica pura de cálculo de puntos

- **Objetivo**: Funciones puras `deriveResult`, `deriveGoalsRange`, `calculatePoints`. En knockout el resultado sale de `winner_team` (no del marcador, que puede empatar); `goals_range` cuenta reg+alargue sin penales. **Sin** multiplicador de racha (ADR 0001).
- **Archivos**: `lib/scoring/calculate.ts`.
- **Aceptación**: Tests cubren acierto, fallo, bonus de goles, resultado de knockout vía `winner_team`, y exclusión de la tanda de penales en `goals_range`. NO hay tests de multiplicador (no existe).
- **Depende de**: 1.8

### [x] 5.2 — Lógica de rachas (participación)

- **Objetivo**: Racha de **participación** (no de aciertos): avanzar/mantener/reiniciar `current`/`max` streak y consumir freeze **automáticamente**. Se invoca desde el endpoint de pronóstico (4.2), NO desde el cron de resultados. "Día" en zona horaria fija del torneo; freeze se recarga una vez por macro-ronda.
- **Archivos**: `lib/scoring/streaks.ts`.
- **Aceptación**: Tests: racha sube al completar los partidos abiertos del día, se mantiene en días consecutivos, freeze se auto-consume al saltar un día y se reinicia si no hay freeze. No depende de si el pronóstico fue correcto.
- **Depende de**: 1.8

### [x] 5.3 — Lógica de logros

- **Objetivo**: Evaluar y otorgar achievements.
- **Archivos**: `lib/scoring/achievements.ts`.
- **Aceptación**: Tests por cada tipo de logro.
- **Depende de**: 1.8

### [x] 5.4 — Cron: Match Sync

- **Objetivo**: Sincronizar scores en vivo cada 60s.
- **Archivos**: `app/api/cron/match-sync/route.ts`, `jobs/matchSync.ts`, `vercel.json`.
- **Aceptación**: Protegido con CRON_SECRET. Actualiza scores y caché.
- **Depende de**: 3.2, 1.9

### [x] 5.5 — Cron: Results Checker + Score Calc

- **Objetivo**: Procesar partidos finalizados e idempotentemente calcular puntos.
- **Archivos**: `app/api/cron/process-results/route.ts`, `jobs/processResults.ts`.
- **Aceptación**: Correr dos veces no duplica puntos (flag `processed` en la misma transacción). Actualiza `predictions`, suma a `users.total_points` y evalúa achievements. **NO toca rachas** (viven en el endpoint de pronóstico, 4.2/5.2).
- **Depende de**: 5.1, 5.3

### [x] 5.6 — Invalidación de caché de leaderboards

- **Objetivo**: Tras procesar, invalidar rankings en Redis.
- **Archivos**: `jobs/processResults.ts`, `lib/redis/cache.ts`.
- **Aceptación**: Leaderboards reflejan nuevos puntos tras el cron.
- **Depende de**: 5.5, 1.9

---

## FASE 6 — Ligas y leaderboards (motor viral)

### [x] 6.1 — Endpoint: crear liga

- **Objetivo**: POST que crea liga con invite_code único.
- **Archivos**: `app/api/leagues/route.ts`.
- **Aceptación**: Genera código único, crea creador como miembro.
- **Depende de**: 1.5, 2.2

### [x] 6.2 — Endpoint: unirse a liga por código

- **Objetivo**: POST para unirse con invite_code.
- **Archivos**: `app/api/leagues/join/route.ts`.
- **Aceptación**: Código inválido → 404. No duplica membresía.
- **Depende de**: 6.1

### [x] 6.3 — Endpoint: leaderboard global (cacheado)

- **Objetivo**: GET top global.
- **Archivos**: `app/api/leagues/global/route.ts`.
- **Aceptación**: Sirve desde Redis, TTL 5 min.
- **Depende de**: 5.6

### [x] 6.4 — Endpoint: leaderboard de liga (cacheado)

- **Objetivo**: GET ranking de una liga.
- **Archivos**: `app/api/leagues/[id]/route.ts`.
- **Aceptación**: Solo miembros lo ven. Cacheado.
- **Depende de**: 6.2, 5.6

### [x] 6.5 — Realtime: ranking en vivo

- **Objetivo**: Suscripción a cambios de puntos vía Supabase Realtime.
- **Archivos**: `components/Leaderboard.tsx`, `lib/supabase/realtime.ts`.
- **Aceptación**: El ranking se actualiza sin recargar al procesarse un partido.
- **Depende de**: 6.3, 6.4

### [x] 6.6 — UI: pantallas de ligas

- **Objetivo**: Crear, unirse, ver ligas y rankings.
- **Archivos**: `app/(main)/leagues/`.
- **Aceptación**: Flujo completo crear → compartir código → unirse → ver ranking.
- **Depende de**: 6.5

---

## FASE 7 — Wrapped (viralidad)

### [x] 7.1 — Agregación de stats por usuario

- **Objetivo**: Función que arma el snapshot de stats (% aciertos, racha, fallo épico, etc.).
- **Archivos**: `lib/scoring/wrappedStats.ts`.
- **Aceptación**: Tests del cálculo del "fallo épico" y agregados.
- **Depende de**: 5.5

### [x] 7.2 — Generación de imagen de la tarjeta

- **Objetivo**: Generar imagen server-side (ej. @vercel/og) con las stats.
- **Archivos**: `app/api/wrapped/image/route.tsx`.
- **Aceptación**: Devuelve imagen PNG con el diseño de la tarjeta.
- **Depende de**: 7.1

### [x] 7.3 — Cron: Wrapped Generator

- **Objetivo**: Generar Wrapped al final de cada fase y guardar en Storage.
- **Archivos**: `app/api/cron/generate-wrapped/route.ts`, `jobs/generateWrapped.ts`.
- **Aceptación**: Crea filas en wrapped_cards con image_url poblada.
- **Depende de**: 7.2, 1.7

### [x] 7.4 — UI: ver y compartir Wrapped

- **Objetivo**: Pantalla del Wrapped + botones de compartir (Web Share API).
- **Archivos**: `app/(main)/wrapped/`, `components/WrappedCard.tsx`.
- **Aceptación**: Comparte imagen/link a WhatsApp, Instagram, X.
- **Depende de**: 7.3

### [x] 7.5 — Mini-tarjeta compartible por partido

- **Objetivo**: Tras cada partido, tarjeta del resultado compartible (estilo cuadritos de Wordle).
- **Archivos**: `components/MatchResultCard.tsx`, endpoint de imagen.
- **Aceptación**: Compartible inmediatamente tras procesarse el partido.
- **Depende de**: 5.5

---

## FASE 8 — PWA y pulido

### [x] 8.1 — Manifest y configuración PWA

- **Objetivo**: App instalable en home screen.
- **Archivos**: `public/manifest.json`, `public/icons/*` (generados por `scripts/generate-icons.mjs`), metadata + viewport en `app/layout.tsx`, exclusión de `sw.js` en `proxy.ts`.
- **Aceptación**: Lighthouse PWA pasa. Instalable en móvil. Iconos 192/512 + maskable + apple-touch.
- **Depende de**: 4.4

### [x] 8.2 — Service Worker (offline + assets)

- **Objetivo**: Cache de assets y historial offline.
- **Archivos**: `public/sw.js`, `public/offline.html`, `components/ServiceWorkerRegister.tsx`.
- **Aceptación**: Historial visible sin conexión (navegaciones cacheadas + fallback offline). Estáticos con stale-while-revalidate. API/cross-origin nunca se cachean.
- **Depende de**: 8.1

### [x] 8.3 — Push notifications

- **Objetivo**: Notificar partido del día, cierre próximo, Wrapped listo.
- **Archivos**: `lib/notifications/` (server `webPush.ts` + client `client.ts`), `lib/validations/push.ts`, `app/api/notifications/{subscribe,test}/route.ts`, `components/PushOptIn.tsx`, migración `0009_push_subscriptions.sql`, handlers `push`/`notificationclick` en `public/sw.js`, env VAPID + `scripts/generate-vapid.mjs`.
- **Aceptación**: Llega notificación de prueba al dispositivo (`POST /api/notifications/test`). Push opcional: si faltan claves VAPID, la UI se autooculta.
- **Depende de**: 8.2

### [x] 8.4 — Rate limiting en endpoints sensibles

- **Objetivo**: Limitar crear pronóstico y crear liga.
- **Archivos**: `lib/redis/rateLimit.ts` (+ test), `rateLimit()` en `lib/redis/client.ts`, aplicado en `app/api/predictions/route.ts` (20/min) y `app/api/leagues/route.ts` (5/5min).
- **Aceptación**: Exceder el límite → 429 con header `Retry-After`.
- **Depende de**: 1.9, 4.2, 6.1

### [x] 8.5 — Auditoría de seguridad (RLS + secrets)

- **Objetivo**: Verificar RLS en todas las tablas y que no haya secrets en el bundle.
- **Archivos**: `docs/security-audit.md`, `lib/security/rls-audit.test.ts` (checks automatizados en CI).
- **Aceptación**: Ninguna service key en el cliente. RLS activo en las 9 tablas. Tests rompen el build ante una regresión.
- **Depende de**: todas las migraciones.

---

## Orden sugerido de ejecución

```
FASE 0 → FASE 1 → FASE 2 → FASE 3 → FASE 4 → FASE 5 → FASE 6 → FASE 7 → FASE 8
```

El MVP demo-able llega al terminar **FASE 4** (pronosticar funciona). El producto con gamificación completa llega al terminar **FASE 6**. La viralidad (Wrapped) llega en **FASE 7**.
