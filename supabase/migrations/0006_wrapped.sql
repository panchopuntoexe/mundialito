-- ───────────────────────────────────────────────────────────────
-- 0006 — WRAPPED_CARDS (tarjetas generadas por macro-ronda / torneo)
-- ───────────────────────────────────────────────────────────────
-- El cron de Wrapped (7.3) genera una tarjeta por usuario y fase, guarda el
-- snapshot de stats en stats_json y la imagen en Supabase Storage (image_url).

create table public.wrapped_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  -- 'group_stage', 'round_32', ... 'final', o 'full_tournament'.
  phase       text not null,
  stats_json  jsonb not null,
  image_url   text,
  created_at  timestamptz not null default now(),
  unique (user_id, phase)
);

create index idx_wrapped_cards_user on public.wrapped_cards (user_id);

-- ── Row Level Security ──────────────────────────────────────────
-- Lectura propia. (Las tarjetas se comparten vía la image_url pública de
-- Storage, no leyendo esta fila.) La escritura va por el cron admin.
alter table public.wrapped_cards enable row level security;

create policy "wrapped_cards_select_own"
  on public.wrapped_cards for select
  using (auth.uid() = user_id);
