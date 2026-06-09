-- ───────────────────────────────────────────────────────────────
-- 0003 — PREDICTIONS (pronósticos)
-- ───────────────────────────────────────────────────────────────
-- Un solo pronóstico por usuario por partido. Inmutable tras el kickoff.
-- Las columnas de resultado (result_correct, goals_correct, points_earned) las
-- escribe el cron de cálculo (5.5) con el cliente admin; quedan null hasta ahí.

create type result_pred as enum ('home', 'draw', 'away');
create type goals_range as enum ('0-1', '2-3', '4-5', '6+');

create table public.predictions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  match_id          bigint not null references public.matches (id) on delete cascade,
  result_pred       result_pred not null,
  goals_range_pred  goals_range not null,
  result_correct    boolean,
  goals_correct     boolean,
  points_earned     int,
  created_at        timestamptz not null default now(),
  unique (user_id, match_id)
);

create index idx_predictions_user on public.predictions (user_id);
create index idx_predictions_match on public.predictions (match_id);

-- ── Row Level Security ──────────────────────────────────────────
alter table public.predictions enable row level security;

-- El dueño ve siempre sus pronósticos.
create policy "predictions_select_own"
  on public.predictions for select
  using (auth.uid() = user_id);

-- Cualquiera puede ver los pronósticos de un partido YA empezado (consenso 4.6).
create policy "predictions_select_after_kickoff"
  on public.predictions for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at <= now()
    )
  );

-- Solo se inserta el propio pronóstico y SOLO antes del kickoff (defensa en
-- profundidad: el endpoint 4.2 también re-valida la ventana server-side).
create policy "predictions_insert_own_before_kickoff"
  on public.predictions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );

-- Editar el propio pronóstico, también solo antes del kickoff (upsert previo a
-- que empiece el partido).
create policy "predictions_update_own_before_kickoff"
  on public.predictions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );
