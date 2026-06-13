"use client";

import { useSyncExternalStore } from "react";
import { localKickoffLabel } from "@/lib/matches/local-kickoff";

/**
 * Hora de kickoff en la zona horaria del dispositivo (isla de cliente).
 *
 * El server no conoce la TZ del usuario, así que el snapshot de servidor es un
 * placeholder neutro y el cliente pinta la hora local en cuanto hidrata — sin
 * mismatch y sin mostrar nunca una hora de otra zona (el bug que esto arregla:
 * el kickoff en ET se leía como hora local). `useSyncExternalStore` es el
 * patrón de React para valores que solo existen en el cliente; el atributo
 * `dateTime` lleva siempre el instante ISO real.
 */

const emptySubscribe = () => () => {};

export function KickoffTime({
  kickoffAt,
  className,
}: {
  kickoffAt: string;
  className?: string;
}) {
  const label = useSyncExternalStore(
    emptySubscribe,
    () =>
      localKickoffLabel(
        kickoffAt,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    () => null,
  );

  return (
    <time dateTime={kickoffAt} className={className}>
      {label ?? "--:--"}
    </time>
  );
}
