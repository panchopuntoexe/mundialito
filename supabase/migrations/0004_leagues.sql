-- ───────────────────────────────────────────────────────────────
-- 0004 — LEAGUES y LEAGUE_MEMBERS (ligas privadas con amigos)
-- ───────────────────────────────────────────────────────────────
-- Una liga es un FILTRO sobre el total de torneo del usuario, NO un ledger de
-- puntos aparte (CONTEXT.md "Liga"): por eso league_members no tiene total_points.
-- El ranking de liga = users.total_points filtrado por membresía → incluye lo
-- acumulado antes de unirse.

create table public.leagues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text unique not null,
  created_by   uuid not null references public.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint league_name_len check (char_length(name) between 1 and 40)
);

create table public.league_members (
  league_id  uuid not null references public.leagues (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index idx_league_members_user on public.league_members (user_id);

-- Helper SECURITY DEFINER: comprueba membresía SIN aplicar RLS, evitando la
-- recursión infinita de una policy sobre league_members que consulta
-- league_members (footgun clásico de RLS en Postgres).
create or replace function public.is_league_member(
  p_league_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id
  );
$$;

-- ── RLS: leagues ────────────────────────────────────────────────
alter table public.leagues enable row level security;

-- Ver una liga solo si sos miembro. (Unirse por invite_code se resuelve
-- server-side con el cliente admin en 6.2, antes de ser miembro.)
create policy "leagues_select_member"
  on public.leagues for select
  using (public.is_league_member(id, auth.uid()));

create policy "leagues_insert_own"
  on public.leagues for insert
  with check (auth.uid() = created_by);

create policy "leagues_modify_creator"
  on public.leagues for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "leagues_delete_creator"
  on public.leagues for delete
  using (auth.uid() = created_by);

-- ── RLS: league_members ─────────────────────────────────────────
alter table public.league_members enable row level security;

-- Ver los miembros de las ligas a las que pertenecés.
create policy "league_members_select_same_league"
  on public.league_members for select
  using (public.is_league_member(league_id, auth.uid()));

-- Sumarte a vos mismo a una liga (creador al crear, o al unirte por código).
create policy "league_members_insert_self"
  on public.league_members for insert
  with check (auth.uid() = user_id);

-- Salir de una liga (borrar tu propia membresía).
create policy "league_members_delete_self"
  on public.league_members for delete
  using (auth.uid() = user_id);
