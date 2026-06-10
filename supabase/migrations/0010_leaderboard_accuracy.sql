-- ───────────────────────────────────────────────────────────────
-- 0010 — Vista de PRECISIÓN para el ranking por % de aciertos
-- ───────────────────────────────────────────────────────────────
-- El ranking público (sección "Ranking") suma una vista por Precisión además del
-- total de puntos y la racha. Agrega por usuario sobre las predicciones YA
-- procesadas (result_correct no nulo). La leen los loaders con el cliente admin
-- (service role), igual que el resto de leaderboards.

create view public.user_accuracy as
select
  p.user_id,
  count(*) filter (where p.result_correct is not null) as total_predictions,
  count(*) filter (where p.result_correct) as correct_predictions,
  case
    when count(*) filter (where p.result_correct is not null) = 0 then 0
    else round(
      100.0 * count(*) filter (where p.result_correct)
        / count(*) filter (where p.result_correct is not null)
    )::int
  end as accuracy
from public.predictions p
group by p.user_id;
