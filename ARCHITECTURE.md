# ARCHITECTURE.md

Diseño técnico de **Prode Mundial**. Este documento es la fuente de verdad de la arquitectura. Si el código y este documento difieren, uno de los dos está mal — resolver antes de continuar.

---

## 1. Visión general del sistema

```
┌─────────────────────────────────────────────────────────┐
│  CLIENTE — PWA mobile-first (Next.js App Router)          │
│  React Query (cache datos) · Zustand (estado UI)          │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS (solo a nuestras API Routes)
┌───────────────────────────▼─────────────────────────────┐
│  API LAYER — Next.js API Routes                           │
│  /auth · /predictions · /matches · /leagues · /wrapped    │
│  Validación Zod · Auth middleware · Rate limit            │
└──────┬───────────────────────────────┬──────────────────┘
       │                               │
┌──────▼──────────┐          ┌─────────▼──────────┐
│  CACHÉ           │          │  BASE DE DATOS      │
│  Upstash Redis   │          │  Supabase Postgres  │
│  fixtures (1h)   │          │  + Realtime (WS)    │
│  scores (60s)    │          │  + Storage (cards)  │
│  ranking (5min)  │          └─────────┬──────────┘
└──────▲──────────┘                    │
       │                               │
┌──────┴───────────────────────────────▼──────────────────┐
│  BACKGROUND JOBS — Vercel Cron                            │
│  Match Sync · Results Checker · Score Calc · Wrapped Gen  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  APIs EXTERNAS                                            │
│  API-Football (live scores) · worldcup26.ir (fixtures)   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Schema de base de datos

```sql
-- ───────────────────────────────────────────────
-- USERS
-- ───────────────────────────────────────────────
create table users (
  id            uuid primary key references auth.users(id),
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  total_points  int default 0,                -- total de torneo; fuente del leaderboard global y del ranking de ligas
  created_at    timestamptz default now()
);

-- ───────────────────────────────────────────────
-- MATCHES — sincronizados desde APIs externas
-- ───────────────────────────────────────────────
create type match_status as enum ('scheduled', 'live', 'finished', 'cancelled');

create table matches (
  id              bigint generated always as identity primary key,  -- PK sintética propia (ADR 0002)
  api_football_id bigint unique,              -- lookup para el sync de live scores
  external_ref    text unique,                -- ref worldcup26.ir, usada por el seed del fixture
  home_team       text not null,
  away_team       text not null,
  home_flag       text,
  away_flag       text,
  phase           text not null,              -- 'group_a', 'round_16', 'final', etc.
  macro_round     text not null,              -- 'group_stage','round_32','round_16','quarter','semi','final' — límites de freeze/Wrapped
  kickoff_at      timestamptz not null,
  status          match_status default 'scheduled',
  score_home      int,                        -- marcador post-alargue, PRE-tanda de penales
  score_away      int,
  total_goals     int generated always as (score_home + score_away) stored,  -- reg + alargue, sin penales
  winner_team     text,                       -- 'home' | 'away' | null — equipo que avanza en knockout (null en grupos)
  processed       boolean default false,      -- ya se calcularon los puntos?
  updated_at      timestamptz default now()
);

create index idx_matches_kickoff on matches(kickoff_at);
create index idx_matches_status on matches(status);

-- ───────────────────────────────────────────────
-- PREDICTIONS
-- ───────────────────────────────────────────────
create type result_pred  as enum ('home', 'draw', 'away');
create type goals_range   as enum ('0-1', '2-3', '4-5', '6+');

create table predictions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id),
  match_id          bigint not null references matches(id),
  result_pred       result_pred not null,
  goals_range_pred  goals_range not null,
  -- resultados del cálculo (null hasta que el partido se procesa):
  result_correct    boolean,
  goals_correct     boolean,
  points_earned     int,
  created_at        timestamptz default now(),
  unique (user_id, match_id)        -- un solo pronóstico por usuario por partido
);

create index idx_predictions_user on predictions(user_id);
create index idx_predictions_match on predictions(match_id);

-- ───────────────────────────────────────────────
-- LEAGUES (ligas privadas con amigos)
-- ───────────────────────────────────────────────
create table leagues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text unique not null,          -- código corto para invitar
  created_by   uuid not null references users(id),
  created_at   timestamptz default now()
);

create table league_members (
  league_id     uuid not null references leagues(id) on delete cascade,
  user_id       uuid not null references users(id),
  joined_at     timestamptz default now(),
  primary key (league_id, user_id)
);
-- El ranking de liga se calcula filtrando users.total_points por membresía.
-- NO hay contador de puntos por liga desde la fecha de ingreso: una liga es un
-- filtro sobre el total global, no un ledger aparte (ver CONTEXT.md "Liga").

create index idx_league_members_user on league_members(user_id);

-- ───────────────────────────────────────────────
-- STREAKS (rachas de aciertos)
-- ───────────────────────────────────────────────
create table streaks (
  user_id            uuid primary key references users(id),
  current_streak     int default 0,
  max_streak         int default 0,
  freeze_available   boolean default true,    -- "congelar" 1 vez por fase
  last_predicted_at  timestamptz
);

-- ───────────────────────────────────────────────
-- ACHIEVEMENTS (logros)
-- ───────────────────────────────────────────────
create table achievements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id),
  type       text not null,                   -- 'group_master', 'streak_legend', etc.
  earned_at  timestamptz default now(),
  unique (user_id, type)
);

-- ───────────────────────────────────────────────
-- WRAPPED (tarjetas generadas por fase / torneo)
-- ───────────────────────────────────────────────
create table wrapped_cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id),
  phase         text not null,                -- 'group_stage', 'full_tournament'
  stats_json    jsonb not null,               -- snapshot de stats
  image_url     text,                          -- URL en Supabase Storage
  created_at    timestamptz default now()
);
```

**Row Level Security (RLS):** activar en todas las tablas. Reglas base:

- `users`: cada quien lee/edita su propia fila.
- `predictions`: el dueño lee/escribe las suyas; lecturas públicas solo después del kickoff.
- `league_members`: visible para miembros de la misma liga.

---

## 3. Sistema de puntuación

### Reglas

| Acierto                                                                              | Puntos |
| ------------------------------------------------------------------------------------ | ------ |
| Resultado correcto (Local/Empate/Visitante en grupos; equipo que avanza en knockout) | 10     |
| Rango de goles correcto (bonus, solo si acertaste el resultado)                      | +15    |

Los puntos son **solo precisión**. NO hay multiplicador por racha — la racha está
desacoplada de los puntos (ver ADR 0001). El resultado en knockout es el equipo que
avanza (no hay empate); el rango de goles cuenta reglamentario + alargue, **sin** la
tanda de penales.

### Algoritmo (pseudocódigo)

```
function calculatePoints(prediction, match):
    points = 0
    // Knockout: el resultado lo decide quién avanza (el marcador puede estar empatado).
    // Grupos: se deriva del marcador a 90'.
    actualResult = match.winner_team ?? deriveResult(match.score_home, match.score_away)
    // total_goals = reglamentario + alargue, SIN tanda de penales.
    actualGoalsRange = deriveGoalsRange(match.total_goals)

    resultCorrect = (prediction.result_pred == actualResult)
    goalsCorrect  = (prediction.goals_range_pred == actualGoalsRange)

    if resultCorrect:
        points += 10
        if goalsCorrect:
            points += 15

    // Sin multiplicador de racha (ADR 0001).
    return { points, resultCorrect, goalsCorrect }
```

**Idempotencia:** el calculador solo procesa `matches` con `status = 'finished'` y `processed = false`. Al terminar, marca `processed = true` en una transacción. Si corre dos veces, la segunda no encuentra partidos sin procesar.

---

## 4. Flujos críticos

### 4.1 Crear un pronóstico

```
POST /api/predictions
  1. Auth middleware verifica sesión
  2. Zod valida body { match_id, result_pred, goals_range_pred }
  3. Lee el match de caché/DB → verifica kickoff_at > now()
     └─ si ya empezó → 409 Conflict
     └─ si es knockout y result_pred = 'draw' → 422 (no hay empate en knockout)
  4. Upsert en predictions (unique user_id + match_id)
  5. Actualiza la racha de participación (ver 4.5) — aquí, NO en el cron de resultados
  6. Retorna 201 con el pronóstico guardado
```

### 4.2 Sincronización de scores (Cron — Match Sync)

```
Cada 60s (solo si hay partidos 'live'):
  1. Verifica si hay matches con status='live' o kickoff dentro de 5 min
  2. Si los hay → llama API-Football /fixtures?live=all
  3. Actualiza score y status en DB
  4. Escribe scores en Redis (TTL 60s)
  5. Si un match pasó a 'finished' → encola para Results Checker
```

### 4.3 Cálculo de puntos (Cron — Results Checker + Score Calc)

```
Cada 5 min:
  1. Busca matches con status='finished' AND processed=false
  2. Por cada match (en transacción):
     a. Trae todas las predictions de ese match
     b. Calcula puntos de cada una (ver sección 3)
     c. Actualiza predictions.points_earned, result_correct, goals_correct
     d. Suma puntos a users.total_points (fuente del leaderboard global y de ligas)
     e. Evalúa y otorga achievements
     f. Marca match.processed = true
  3. Invalida caché de leaderboards en Redis
  4. Supabase Realtime emite el cambio → clientes actualizan ranking

  Nota: las RACHAS no se tocan aquí. La racha es de participación y se actualiza al
  crear el pronóstico (ver 4.5 y ADR 0001), no al procesar el resultado.
```

### 4.4 Generación de Wrapped (Cron — Wrapped Gen)

```
Al final de cada fase (group_stage, round_16, ... final):
  1. Por cada usuario activo:
     a. Agrega stats: % aciertos, racha máx, puntos, fallo épico, logros
     b. "Fallo épico" = entre tus pronósticos incorrectos, aquel del partido que el
        MAYOR % de usuarios SÍ acertó ("todos lo vieron venir menos yo"). Se calcula
        con la distribución de consenso (endpoint /consensus, task 4.6).
     c. Guarda stats_json en wrapped_cards
     d. Genera imagen de la tarjeta (server-side, ej. @vercel/og)
     e. Sube imagen a Supabase Storage → guarda image_url
  2. Notifica a los usuarios que su Wrapped está listo
```

### 4.5 Racha de participación (al crear el pronóstico)

```
En POST /api/predictions, tras guardar (ver 4.1 paso 5):
  1. La racha mide PARTICIPACIÓN, no aciertos (ADR 0001). No afecta los puntos.
  2. "Día" se evalúa en una zona horaria fija del torneo (no la local del usuario).
  3. Un día cuenta como participado si el usuario pronosticó TODOS los partidos
     que aún estaban ABIERTOS (kickoff futuro) al momento de su primer pronóstico
     de ese día → así la racha siempre es alcanzable para quien se presenta.
  4. Si completó ese conjunto:
       - mismo día que last_predicted_at → sin cambio
       - día consecutivo → current_streak += 1 (y max_streak = max(...))
       - se saltó día(s) → si freeze_available: consume freeze automáticamente y
         mantiene la racha; si no: current_streak = 1 (se reinicia)
  5. freeze_available se recarga una vez por MACRO-RONDA (group_stage, round_32,
     round_16, quarter, semi, final), no por cada uno de los 12 grupos.
```

---

## 5. Estrategia de caché (Upstash Redis)

| Clave                     | Contenido          | TTL    | Quién la escribe       |
| ------------------------- | ------------------ | ------ | ---------------------- |
| `fixtures:{date}`         | Partidos de un día | 1 hora | Match Sync / on-demand |
| `match:live:{id}`         | Score en vivo      | 60 seg | Match Sync             |
| `leaderboard:global`      | Top global         | 5 min  | Score Calc (invalida)  |
| `leaderboard:league:{id}` | Ranking de liga    | 5 min  | Score Calc (invalida)  |

**Patrón de lectura (cache-aside):**

```
1. Buscar en Redis
2. Si hit → retornar
3. Si miss → leer DB (o API externa) → escribir Redis con TTL → retornar
```

---

## 6. Estimación de carga

- Mundial 2026 = **104 partidos en 39 días**.
- Polling cada 60s durante ~100 min por partido = **~100 requests por partido** a API-Football.
- Máximo ~4 partidos simultáneos en horas pico = **~400 req/hora**.
- **Plan API-Football Pro ($19/mes, 7,500 req/día) cubre esto con holgura.**
- El resto del tráfico (usuarios viendo rankings, perfiles) lo absorbe el caché de Redis — **cero llamadas a API externa por request de usuario**.

---

## 7. PWA

- `manifest.json` con iconos, theme color, display `standalone`.
- Service Worker para: cache de assets, funcionamiento offline del historial, y push notifications.
- Notificaciones push: "El partido del día ya está disponible", "Tu pronóstico cierra en 1 hora", "Tu Wrapped está listo".

---

## 8. Seguridad

- Endpoints de Cron protegidos con header `Authorization: Bearer ${CRON_SECRET}`.
- `SUPABASE_SERVICE_ROLE_KEY` y `API_FOOTBALL_KEY` solo en server, nunca en bundle del cliente.
- RLS en todas las tablas de Supabase.
- Rate limiting en API Routes sensibles (crear pronóstico, crear liga) vía Upstash.
