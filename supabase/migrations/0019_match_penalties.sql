-- ───────────────────────────────────────────────────────────────
-- 0019 — PENALES (marcador de la tanda en partidos de knockout)
-- ───────────────────────────────────────────────────────────────
-- `score_home`/`score_away` es reg + alargue PRE-tanda (0002) y `winner_team` ya
-- dice quién avanza, pero faltaba el marcador de la tanda en sí (ej. 4-2). API-
-- Football lo expone en `score.penalty`; lo guardamos para mostrar el drama del
-- desempate ("Avanza España por penales 4-2") en la tarjeta y al compartir.
--
-- Nullable: solo se setea cuando hubo tanda (empate tras los 120' en knockout);
-- null en grupos y en knockouts resueltos en tiempo reglamentario/alargue.

alter table public.matches
  add column penalty_home int,
  add column penalty_away int;
