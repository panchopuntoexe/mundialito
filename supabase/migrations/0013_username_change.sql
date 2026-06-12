-- ───────────────────────────────────────────────────────────────
-- 0013 — CAMBIO DE USERNAME (una sola vez)
-- ───────────────────────────────────────────────────────────────
-- Un invitado que guarda su cuenta (linkIdentity) conserva su username
-- auto-generado `invitado_xxxxxx`. Esta migración le permite elegir un nombre
-- propio UNA sola vez (regla de producto: evita squatting/rotación de nombres
-- en los rankings).
--
-- La regla vive en un trigger y no solo en la API porque la RLS
-- `users_update_own` (0001) permite al dueño actualizar su propia fila directo
-- contra PostgREST: sin el trigger, un cliente avispado podría renombrarse
-- infinitas veces salteando el endpoint.

alter table public.users
  add column username_changed_at timestamptz;

create or replace function public.enforce_single_username_change()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    if old.username_changed_at is not null then
      raise exception 'username ya fue cambiado una vez';
    end if;
    new.username_changed_at := now();
  end if;
  -- El timestamp lo administra solo este trigger: ignorar intentos de
  -- escribirlo o limpiarlo a mano.
  if new.username is not distinct from old.username then
    new.username_changed_at := old.username_changed_at;
  end if;
  return new;
end;
$$;

create trigger users_single_username_change
  before update on public.users
  for each row
  execute function public.enforce_single_username_change();
