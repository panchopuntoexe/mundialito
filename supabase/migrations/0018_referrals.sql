-- ───────────────────────────────────────────────────────────────
-- 0018 — REFERRALS (Bet 1)
-- ───────────────────────────────────────────────────────────────
-- Atribución de "quién trajo a quién": cuando un usuario se registra con el
-- link de otro (?ref=<username> → cookie, ver A5/proxy.ts), su fila guarda
-- `referred_by` con el id del que invitó. La recompensa es la insignia
-- "Embajador" (status), otorgada al que invita cuando su invitado se registra
-- (app/api/users/route.ts). NO suma puntos: el ranking sigue reflejando SOLO
-- habilidad de pronóstico (decisión de producto + integridad del leaderboard).
--
-- `on delete set null`: si el invitado borra su cuenta, no se cae la fila del
-- que invitó. El índice acelera el conteo de referrals por usuario.

alter table public.users
  add column referred_by uuid references public.users (id) on delete set null;

create index users_referred_by_idx on public.users (referred_by);
