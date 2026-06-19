-- ───────────────────────────────────────────────────────────────
-- 0016 — ELIMINAR BOTS (revierte 0011)
-- ───────────────────────────────────────────────────────────────
-- Decisión de producto: se retira por completo la feature de bots. Esta
-- migración borra los usuarios sintéticos vivos y elimina el flag `is_bot`.
--
-- 1) Borrar los auth.users de los bots: el FK public.users.id → auth.users
--    (on delete cascade, 0001) arrastra users, predictions, streaks,
--    achievements y league_members. Cero filas huérfanas.
--    (Los leaderboards en Redis se reconstruyen al expirar su TTL.)
delete from auth.users
  where id in (select id from public.users where is_bot);

-- 2) Quitar el índice parcial y la columna que introdujo 0011.
drop index if exists public.idx_users_is_bot;

alter table public.users
  drop column if exists is_bot;
