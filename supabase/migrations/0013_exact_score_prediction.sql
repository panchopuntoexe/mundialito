-- ───────────────────────────────────────────────────────────────
-- 0013 — Marcador exacto (reemplaza el rango de goles)
-- ───────────────────────────────────────────────────────────────
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

alter table public.predictions
  add column home_goals_pred int,
  add column away_goals_pred int;

-- Rangos lenientes (la UI limita a 0–9; acá dejamos margen).
alter table public.predictions
  add constraint home_goals_pred_range
    check (home_goals_pred is null or (home_goals_pred >= 0 and home_goals_pred <= 20)),
  add constraint away_goals_pred_range
    check (away_goals_pred is null or (away_goals_pred >= 0 and away_goals_pred <= 20)),
  -- O ambos goles o ninguno: un marcador sin uno de los lados no tiene sentido.
  add constraint goals_pred_both_or_neither
    check ((home_goals_pred is null) = (away_goals_pred is null));
