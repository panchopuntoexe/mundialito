-- ───────────────────────────────────────────────────────────────
-- 0014 — PUSH_NOTIFICATION_LOG (recordatorio de pronóstico — tarea 8.6)
-- ───────────────────────────────────────────────────────────────
-- Registro de notificaciones push enviadas por el server, para garantizar
-- "como máximo una vez" por (usuario, tipo, clave de deduplicación). El cron
-- de recordatorios hace un INSERT ... ON CONFLICT DO NOTHING como claim
-- atómico ANTES de enviar: si la fila ya existe, otra corrida ya avisó y se
-- omite. Preferimos perder un aviso (crash entre claim y envío) antes que
-- duplicarlo — un usuario molesto por spam no vuelve.
--
-- `dedupe_key` depende del tipo: para 'prediction-reminder' es el día del
-- torneo ('YYYY-MM-DD' en TZ del torneo) → máximo un recordatorio por día.

create table public.push_notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        text not null,
  dedupe_key  text not null,
  sent_at     timestamptz not null default now(),
  unique (user_id, kind, dedupe_key)
);

-- ── Row Level Security ──────────────────────────────────────────
-- Tabla interna del server: solo escriben/leen los crons con service role
-- (que bypasea RLS). Sin policies: ningún cliente puede tocarla.
alter table public.push_notification_log enable row level security;
