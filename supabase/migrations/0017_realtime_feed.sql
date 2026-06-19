-- ───────────────────────────────────────────────────────────────
-- 0017 — REALTIME del feed en vivo (Bet 2)
-- ───────────────────────────────────────────────────────────────
-- Feedback en vivo cuando el cron procesa un partido o desbloquea una insignia:
-- la app muestra un toast ("Ganaste +18 pts" / "Nueva insignia") sin recargar.
-- Para que el WebSocket emita esos cambios, las tablas deben estar en la
-- publicación `supabase_realtime`. La RLS sigue aplicando al stream: cada cliente
-- solo recibe los cambios de las filas que puede VER —
--   · predictions: policy select-own → solo las predicciones propias (el cron
--     setea points_earned al puntuar → UPDATE).
--   · achievements: policy select-own → solo las insignias propias (INSERT).
-- Ver lib/supabase/realtime.ts (subscribeToProcessedPredictions /
-- subscribeToNewAchievements) y components/LiveFeedToasts.tsx.

alter publication supabase_realtime add table public.predictions;
alter publication supabase_realtime add table public.achievements;
