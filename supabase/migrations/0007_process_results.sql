-- ───────────────────────────────────────────────────────────────
-- 0007 — APPLY MATCH RESULTS (cron de resultados, tarea 5.5)
-- ───────────────────────────────────────────────────────────────
-- Persiste los puntos de un partido finalizado en UNA transacción, idempotente.
-- Los puntos los calcula la lógica PURA de TS (lib/scoring/calculate.ts, tarea
-- 5.1) — fuente de verdad del scoring; esta función solo los APLICA atómicamente.
--
-- Idempotencia (regla de arquitectura 4): el "claim" atómico de `processed`
-- (false→true) garantiza que dos corridas no dupliquen puntos. Como todo ocurre
-- dentro de la transacción de la función, un fallo a mitad de camino revierte
-- también el flag → nunca quedan puntos a medias ni un partido marcado sin sumar.
--
-- NO toca rachas: son de participación y viven en el endpoint de pronóstico
-- (4.2/5.2 — ADR 0001).
--
-- `p_results`: jsonb array de
--   { prediction_id uuid, user_id uuid, points int,
--     result_correct bool, goals_correct bool }

create or replace function public.apply_match_results(
  p_match_id bigint,
  p_results  jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed int;
  v_entry   jsonb;
begin
  -- Claim atómico: solo la corrida que pasa processed de false→true continúa.
  update public.matches
     set processed = true
   where id = p_match_id
     and status = 'finished'
     and processed = false;

  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    -- Ya procesado (o no finalizado): no-op idempotente.
    return false;
  end if;

  -- Aplica cada predicción y suma al total de torneo del usuario.
  for v_entry in select * from jsonb_array_elements(p_results)
  loop
    update public.predictions
       set result_correct = (v_entry ->> 'result_correct')::boolean,
           goals_correct  = (v_entry ->> 'goals_correct')::boolean,
           points_earned  = (v_entry ->> 'points')::int
     where id = (v_entry ->> 'prediction_id')::uuid;

    update public.users
       set total_points = total_points + (v_entry ->> 'points')::int
     where id = (v_entry ->> 'user_id')::uuid;
  end loop;

  return true;
end;
$$;

-- Solo el service role (crons server-side) la ejecuta; nunca anon/authenticated.
revoke all on function public.apply_match_results(bigint, jsonb) from public;
revoke all on function public.apply_match_results(bigint, jsonb) from anon, authenticated;
grant execute on function public.apply_match_results(bigint, jsonb) to service_role;
