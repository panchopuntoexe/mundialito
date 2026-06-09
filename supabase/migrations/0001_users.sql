-- ───────────────────────────────────────────────────────────────
-- 0001 — USERS (perfil de jugador)
-- ───────────────────────────────────────────────────────────────
-- La fila se vincula 1:1 con auth.users. `total_points` es el TOTAL de torneo
-- del usuario: fuente única del leaderboard global y del ranking de ligas
-- (una liga es un filtro sobre este total, no un ledger aparte — ver CONTEXT.md).

create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  total_points  int not null default 0,
  created_at    timestamptz not null default now(),
  constraint username_len check (char_length(username) between 3 and 20)
);

-- ── Row Level Security ──────────────────────────────────────────
-- Cada usuario lee/edita SOLO su propia fila. Las lecturas para leaderboards
-- (nombres y puntos de otros) se hacen server-side con el cliente admin
-- (service role), nunca directo desde el cliente.
alter table public.users enable row level security;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
