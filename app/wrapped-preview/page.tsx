import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/ShareButtons";
import { WrappedCard } from "@/components/WrappedCard";
import { wrappedPhaseLabel } from "@/lib/wrapped/phases";
import {
  SAMPLE_LIVE_STATS,
  SAMPLE_MATCH_RESULT,
  SAMPLE_WRAPPED_STATS,
} from "@/lib/wrapped/samples";

/**
 * Preview dev del Wrapped con datos mock (sin login ni DB).
 *
 * Renderiza la experiencia completa de las tarjetas compartibles —la tarjeta Wrapped
 * (7.4) y la mini-tarjeta de resultado estilo Wordle (7.5)— usando los datos de
 * muestra (`lib/wrapped/samples`) y los endpoints públicos `?preview=1`, sin esperar
 * a que el cron cierre una fase ni sembrar `wrapped_cards`. Es solo para QA visual:
 * vive fuera de `(main)` (se salta el gate de onboarding), es pública en `proxy.ts`
 * y devuelve 404 en producción.
 */
export default function WrappedPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const phaseLabel = wrappedPhaseLabel(SAMPLE_WRAPPED_STATS.phase);
  const match = SAMPLE_MATCH_RESULT;
  const matchImage = "/api/matches/result-image?preview=1";
  const matchText = `Mi resultado en Mundialito 2026: ${match.homeTeam} ${match.scoreHome}-${match.scoreAway} ${match.awayTeam} — +${match.pointsEarned} pts ⚽`;
  const live = SAMPLE_LIVE_STATS;
  const liveImage = "/api/wrapped/live-image?preview=1";
  const liveText = `Llevo ${live.totalPoints} pts y ${live.accuracy}% de aciertos en Mundialito 2026 ⚽ ¿Me ganás?`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <span className="w-fit rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
          Preview · datos mock
        </span>
        <h1 className="text-lg font-bold tracking-tight">Estadísticas de prueba</h1>
        <p className="text-sm text-foreground-muted">
          Vista de las tarjetas compartibles con datos de muestra, sin login ni
          datos reales. Solo para QA visual.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold tracking-tight">
          Tarjeta Wrapped — {phaseLabel}
        </h2>
        <WrappedCard
          cardId="preview"
          phaseLabel={phaseLabel}
          accuracy={SAMPLE_WRAPPED_STATS.accuracy}
          imageUrl="/api/wrapped/image?preview=1"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold tracking-tight">
          Resultado de partido (estilo Wordle)
        </h2>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={matchImage}
            alt="Mini-tarjeta de resultado de partido — preview"
            className="w-full rounded-lg"
            loading="lazy"
          />
          <ShareButtons
            imageUrl={null}
            fallbackPath={matchImage}
            text={matchText}
            downloadName="resultado-preview"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold tracking-tight">
          Tarjeta de stats en vivo
        </h2>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={liveImage}
            alt="Tarjeta de stats en vivo — preview"
            className="w-full rounded-lg"
            loading="lazy"
          />
          <ShareButtons
            imageUrl={null}
            fallbackPath={liveImage}
            text={liveText}
            downloadName="stats-preview"
          />
        </div>
      </section>
    </main>
  );
}
