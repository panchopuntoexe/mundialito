-- ───────────────────────────────────────────────────────────────
-- 0005 — STREAKS y ACHIEVEMENTS (gamificación)
-- ───────────────────────────────────────────────────────────────
-- La RACHA es de PARTICIPACIÓN, no de aciertos (ADR 0001): mide días
-- consecutivos en que el usuario pronosticó todos los partidos abiertos del día.
-- No afecta los puntos. Se actualiza al crear el pronóstico (4.2 / lib 5.2),
-- nunca en el cron de resultados.

create table public.streaks (
  user_id               uuid primary key references public.users (id) on delete cascade,
  current_streak        int not null default 0,
  max_streak            int not null default 0,
  -- Salvavidas: se auto-consume si se salta un día. Se recarga 1 vez por
  -- macro-ronda (no por cada grupo).
  freeze_available      boolean not null default true,
  -- Día (en la zona horaria FIJA del torneo) de la última participación
  -- completa. Se usa para detectar días consecutivos vs. saltos.
  last_participated_on  date,
  -- Macro-ronda en la que se recargó el freeze por última vez (para recargar
  -- una sola vez al entrar a una nueva macro-ronda).
  freeze_refilled_round text,
  updated_at            timestamptz not null default now()
);

create trigger streaks_set_updated_at
  before update on public.streaks
  for each row
  execute function public.set_updated_at();

create table public.achievements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  type       text not null,
  earned_at  timestamptz not null default now(),
  unique (user_id, type)
);

create index idx_achievements_user on public.achievements (user_id);

-- ── Row Level Security ──────────────────────────────────────────
-- Solo lectura propia. La escritura va por el cliente admin (service role) en
-- el endpoint de pronóstico (rachas) y el cron de resultados (logros), para que
-- el cliente no pueda manipular su racha ni otorgarse logros.
alter table public.streaks enable row level security;

create policy "streaks_select_own"
  on public.streaks for select
  using (auth.uid() = user_id);

alter table public.achievements enable row level security;

create policy "achievements_select_own"
  on public.achievements for select
  using (auth.uid() = user_id);
