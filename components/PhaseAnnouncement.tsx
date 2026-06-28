import { FaBolt } from "react-icons/fa6";
import type { KnockoutAnnouncement } from "@/lib/matches/phase";

/**
 * Banner de anuncio de la fase de eliminación en el Home (el "mensaje inicial"
 * que avisa el arranque de los 16avos y las rondas siguientes).
 *
 * Color carmesí (`--knockout`) para diferenciar el mata-mata del verde de la
 * fase de grupos. Presentacional (server component): el copy ya viene resuelto
 * por `knockoutAnnouncement()`.
 */
export function PhaseAnnouncement({
  announcement,
}: {
  announcement: KnockoutAnnouncement;
}) {
  return (
    <section className="animate-fade-in-up flex items-start gap-3 rounded-xl border border-knockout/40 bg-knockout/10 px-4 py-3">
      <span className="mt-0.5 shrink-0 text-lg text-knockout" aria-hidden>
        <FaBolt />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="text-sm font-bold text-knockout">
            {announcement.title}
          </h2>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-knockout/80">
            {announcement.roundName}
          </span>
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          {announcement.message}
        </p>
      </div>
    </section>
  );
}
