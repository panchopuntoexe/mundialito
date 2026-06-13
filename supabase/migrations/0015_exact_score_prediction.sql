-- ───────────────────────────────────────────────────────────────
-- 0015 — Marcador exacto (reemplaza el rango de goles)
-- ───────────────────────────────────────────────────────────────
-- (Antes 0013; renumerado a 0015 por colisión de versión con
-- 0013_username_change.sql. Esa colisión hacía que `supabase db push` tratara
-- la versión "0013" como ya aplicada y SALTARA esta migración, por lo que las
-- columnas home_goals_pred/away_goals_pred nunca se crearon en producción.)
--
-- El bonus de goles deja de ser un rango (goals_range_pred) y pasa a ser el
-- MARCADOR EXACTO pronosticado por equipo. Se puntúa por cercanía exponencial a
-- los goles reales de cada equipo (reg + alargue, sin penales). Ambas columnas
-- son opcionales pero van juntas: o las dos o ninguna.
--
-- goals_range_pred se CONSERVA (ya nullable desde 0012) para no romper las filas
-- históricas de partidos ya jugados; el código nuevo deja de escribirla/leerla.
-- No se toca la RLS (las políticas son por fila, no por columna) ni la RPC
-- apply_match_results (sigue escribiendo result_correct/goals_correct/points_earned;
-- goals_correct ahora significa "marcador exacto").

-- Idempotente (if not exists / guard en pg_constraint): re-aplicar esta
-- migración en un entorno que ya la corrió bajo el viejo número 0013 no falla.
alter table public.predictions
  add column if not exists home_goals_pred int,
  add column if not exists away_goals_pred int;

-- Rangos lenientes (la UI limita a 0–9; acá dejamos margen).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'home_goals_pred_range') then
    alter table public.predictions
      add constraint home_goals_pred_range
        check (home_goals_pred is null or (home_goals_pred >= 0 and home_goals_pred <= 20));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'away_goals_pred_range') then
    alter table public.predictions
      add constraint away_goals_pred_range
        check (away_goals_pred is null or (away_goals_pred >= 0 and away_goals_pred <= 20));
  end if;
  -- O ambos goles o ninguno: un marcador sin uno de los lados no tiene sentido.
  if not exists (select 1 from pg_constraint where conname = 'goals_pred_both_or_neither') then
    alter table public.predictions
      add constraint goals_pred_both_or_neither
        check ((home_goals_pred is null) = (away_goals_pred is null));
  end if;
end $$;
