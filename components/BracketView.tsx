import { BracketCell } from "@/components/BracketCell";
import { phaseLabel } from "@/components/MatchCard";
import type { BracketColumn } from "@/lib/bracket/types";

/**
 * El cuadro de eliminación: una tira horizontal de columnas (una por ronda), cada
 * una con sus partidos apilados. En mobile (max-w-md) un árbol con líneas no es
 * legible, así que va con scroll horizontal + snap, que es el patrón usable y
 * reconocible. Presentacional (server component): el scroll es solo CSS.
 *
 * `-mx-4 px-4` hace que la tira sangre hasta los bordes de la pantalla dentro del
 * `p-4` del main (se ve que hay más rondas hacia los lados).
 */
export function BracketView({
  columns,
  hasUser,
}: {
  columns: BracketColumn[];
  hasUser: boolean;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex snap-x snap-mandatory gap-3">
        {columns.map((col) => (
          <section
            key={col.phase}
            className="flex w-56 shrink-0 snap-start flex-col gap-2"
          >
            <h2 className="text-xs font-bold uppercase tracking-wide text-foreground-muted">
              {phaseLabel(col.phase)}
              <span className="ml-1 font-normal normal-case">
                · {col.matches.length}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {col.matches.map((m) => (
                <li key={m.id}>
                  <BracketCell cell={m} hasUser={hasUser} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
