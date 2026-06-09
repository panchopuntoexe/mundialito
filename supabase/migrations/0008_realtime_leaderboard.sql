-- ───────────────────────────────────────────────────────────────
-- 0008 — REALTIME del leaderboard (tarea 6.5)
-- ───────────────────────────────────────────────────────────────
-- El ranking en vivo (Supabase Realtime) escucha cambios de `users.total_points`.
-- Para que el WebSocket emita esos cambios, la tabla debe estar en la publicación
-- `supabase_realtime`. La RLS sigue aplicando: cada cliente solo recibe los
-- cambios de las filas que puede VER (policy `users_select_own` → su propia fila),
-- así que un usuario es notificado cuando SUS puntos cambian al procesarse un
-- partido, y el componente re-fetchea el ranking completo (que arma el backend con
-- service role). Ver components/Leaderboard.tsx y lib/supabase/realtime.ts.

alter publication supabase_realtime add table public.users;
