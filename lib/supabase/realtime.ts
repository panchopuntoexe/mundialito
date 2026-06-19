import { createClient } from "@/lib/supabase/client";

/**
 * Suscripción a cambios de puntos para el ranking en vivo (tarea 6.5).
 *
 * Supabase Realtime emite los UPDATE de `public.users` por WebSocket. La RLS
 * aplica también al stream: un cliente solo recibe los cambios de las filas que
 * puede VER (policy `users_select_own` → su propia fila). Por eso filtramos por
 * `id=eq.{userId}`: cuando el cron de resultados (5.5) suma puntos al usuario, su
 * fila cambia y este callback dispara → el componente re-fetchea el ranking
 * completo desde el backend (que sí lee a todos con service role).
 *
 * Requiere que `public.users` esté en la publicación `supabase_realtime`
 * (migración 0008). Devuelve una función para desuscribirse (limpieza en effect).
 */
export function subscribeToPointsChange(
  userId: string,
  onChange: () => void,
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`leaderboard:points:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "users",
        filter: `id=eq.${userId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Fila de `predictions` que llega por el stream (solo los campos que usamos). */
export interface ProcessedPredictionRow {
  match_id: number;
  points_earned: number | null;
  result_correct: boolean | null;
}

/**
 * Suscripción a los UPDATE de las predicciones PROPIAS (Bet 2). Cuando el cron
 * de resultados (5.5) puntúa un partido, la fila del usuario cambia
 * (`points_earned` pasa de null a un número) y este callback dispara → toast en
 * vivo + refresh de la card, sin recargar. La RLS de `predictions` (select own)
 * aplica también al stream: solo llegan las filas del propio usuario. Requiere
 * `predictions` en la publicación `supabase_realtime` (migración 0017).
 */
export function subscribeToProcessedPredictions(
  userId: string,
  onChange: (row: ProcessedPredictionRow) => void,
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`predictions:processed:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "predictions",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onChange(payload.new as ProcessedPredictionRow),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Suscripción a las insignias nuevas del usuario (Bet 2). El cron inserta en
 * `achievements` al desbloquear un logro; este callback dispara un toast "Nueva
 * insignia". RLS select own → solo las propias. Requiere `achievements` en la
 * publicación `supabase_realtime` (migración 0017).
 */
export function subscribeToNewAchievements(
  userId: string,
  onNew: (row: { type: string }) => void,
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`achievements:new:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "achievements",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNew(payload.new as { type: string }),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
