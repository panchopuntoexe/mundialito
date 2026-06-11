-- ───────────────────────────────────────────────────────────────
-- 0011 — BOTS (tarea 9.1)
-- ───────────────────────────────────────────────────────────────
-- Marca de usuario bot: usuarios sintéticos que pronostican vía cron para que
-- la app se sienta viva al arrancar el Mundial. Trazables y borrables en
-- bloque (borrar su auth.users cascadea todo su rastro: users, predictions,
-- streaks, achievements, league_members).
--
-- Sin cambios de RLS: los bots se escriben SOLO con el cliente admin
-- (service role), que ya ignora RLS. Las políticas self-only siguen intactas.

alter table public.users
  add column is_bot boolean not null default false;

-- Índice parcial: solo indexa los true (listar/borrar bots, filtro del job).
create index idx_users_is_bot on public.users (is_bot) where is_bot;
