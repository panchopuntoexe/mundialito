-- ───────────────────────────────────────────────────────────────
-- 0009 — PUSH_SUBSCRIPTIONS (Web Push / PWA — tarea 8.3)
-- ───────────────────────────────────────────────────────────────
-- Guarda las suscripciones Web Push del navegador/dispositivo de cada usuario.
-- Un usuario puede tener varias (varios dispositivos). El `endpoint` es único
-- por suscripción: un re-subscribe del mismo navegador hace upsert, no duplica.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  endpoint    text unique not null,
  -- Claves de cifrado del cliente (del PushSubscription.keys del navegador).
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_push_subscriptions_user on public.push_subscriptions (user_id);

-- ── Row Level Security ──────────────────────────────────────────
-- El dueño puede VER y BORRAR las suyas (defensa en profundidad). La escritura
-- real (upsert al suscribirse) va por el endpoint con cliente admin, que setea
-- user_id = usuario autenticado, nunca un valor del body. El envío de pushes lo
-- hace el server (crons / endpoint de prueba) leyendo con service role.
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
