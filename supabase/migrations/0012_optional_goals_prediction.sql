-- ───────────────────────────────────────────────────────────────
-- 0012 — goals_range_pred opcional
-- ───────────────────────────────────────────────────────────────
-- El pronóstico mínimo es result_pred (quién gana). El rango de goles es
-- bonus opcional (+15 pts si se acierta junto con el resultado).

alter table public.predictions
  alter column goals_range_pred drop not null;
