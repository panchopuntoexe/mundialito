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
