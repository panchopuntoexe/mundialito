-- ───────────────────────────────────────────────────────────────
-- 0002 — MATCHES (fixture + scores sincronizados desde APIs externas)
-- ───────────────────────────────────────────────────────────────
-- PK SINTÉTICA propia (ADR 0002): los IDs de proveedor son columnas de lookup
-- re-apuntables, no la PK. Cambiar de proveedor de scores = UPDATE de columna,
-- no migración de PK referenciada por cada predicción.
--   · external_ref    → ref worldcup26.ir, usada por el seed del fixture (3.3)
--   · api_football_id → lookup para el sync de live scores (5.4)

create type match_status as enum ('scheduled', 'live', 'finished', 'cancelled');

create table public.matches (
  id              bigint generated always as identity primary key,
  api_football_id bigint unique,
  external_ref    text unique,
  home_team       text not null,
  away_team       text not null,
  home_flag       text,
  away_flag       text,
  -- Fase granular: 'group_a'..'group_l', 'round_32', 'round_16', 'quarter',
  -- 'semi', 'final'.
  phase           text not null,
  -- Macro-ronda: límites de freeze/Wrapped. NO es la fase granular (CONTEXT.md).
  macro_round     text not null,
  kickoff_at      timestamptz not null,
  status          match_status not null default 'scheduled',
  -- Marcador POST-alargue, PRE-tanda de penales (puede quedar empatado en
  -- knockout aunque haya un equipo que avanza).
  score_home      int,
  score_away      int,
  -- Goles del partido: reglamentario + alargue, SIN tanda de penales.
  total_goals     int generated always as (score_home + score_away) stored,
  -- Equipo que avanza en knockout ('home'|'away'); null en grupos (el resultado
  -- se deriva del marcador). Necesario porque el marcador puede empatar.
  winner_team     text,
  -- ¿Ya se calcularon los puntos de este partido? (idempotencia del cron 5.5)
  processed       boolean not null default false,
  updated_at      timestamptz not null default now(),
  constraint macro_round_valid check (
    macro_round in (
      'group_stage', 'round_32', 'round_16', 'quarter', 'semi', 'final'
    )
  ),
  constraint winner_team_valid check (winner_team in ('home', 'away'))
);

create index idx_matches_kickoff on public.matches (kickoff_at);
create index idx_matches_status on public.matches (status);

-- updated_at automático en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
  before update on public.matches
  for each row
  execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────
-- Los partidos son lectura pública (fixture y scores). La escritura es solo del
-- cliente admin (service role) en el seed y los crons, que bypasea RLS: no se
-- define ninguna policy de INSERT/UPDATE/DELETE.
alter table public.matches enable row level security;

create policy "matches_select_all"
  on public.matches for select
  using (true);
