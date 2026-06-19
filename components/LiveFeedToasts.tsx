"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/Toaster";
import { ACHIEVEMENT_BY_TYPE } from "@/lib/scoring/achievements";
import {
  subscribeToNewAchievements,
  subscribeToProcessedPredictions,
} from "@/lib/supabase/realtime";

/**
 * Feedback en vivo (Bet 2): isla de cliente que escucha Supabase Realtime y
 * dispara toasts cuando el cron procesa un partido (puntos) o desbloquea una
 * insignia. Al puntuar un partido también refresca la pantalla (router.refresh)
 * para que la card pase a mostrar la tarjeta de resultado, sin recargar.
 *
 * Solo lectura: NO toca el cálculo de puntos. Si el usuario no está en la app
 * cuando se procesa, no hay toast (el estado ya quedó persistido y lo ve al
 * volver) — es feedback en el momento, no un buzón.
 */
export function LiveFeedToasts({
  userId,
  matchNames,
}: {
  userId: string;
  /** id de partido → "Local vs Visitante", para nombrar el toast de puntos. */
  matchNames: Record<number, string>;
}) {
  const { toast } = useToast();
  const router = useRouter();

  // matchNames vive en un ref para no re-suscribir en cada router.refresh (que
  // recrea el objeto). `seen` evita un toast doble si el stream re-entrega.
  const matchNamesRef = useRef(matchNames);
  useEffect(() => {
    matchNamesRef.current = matchNames;
  }, [matchNames]);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    const unsubPoints = subscribeToProcessedPredictions(userId, (row) => {
      // points_earned null = guardado de pick (aún sin procesar): se ignora.
      if (row.points_earned == null) return;
      if (seen.current.has(row.match_id)) return;
      seen.current.add(row.match_id);

      toast({
        variant: "success",
        title: `Ganaste +${row.points_earned} pts`,
        description: matchNamesRef.current[row.match_id],
      });
      router.refresh();
    });

    const unsubBadges = subscribeToNewAchievements(userId, (row) => {
      const def =
        ACHIEVEMENT_BY_TYPE[row.type as keyof typeof ACHIEVEMENT_BY_TYPE];
      toast({
        variant: "info",
        title: "Nueva insignia desbloqueada",
        description: def?.label ?? undefined,
      });
    });

    return () => {
      unsubPoints();
      unsubBadges();
    };
  }, [userId, toast, router]);

  return null;
}
