"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "¿Cómo se juega?" — la única educación explícita de las reglas (rediseño de
 * usabilidad). Antes los puntos, el bonus, la racha y los niveles solo se
 * descubrían jugando; para una app viral el loop tiene que entenderse en
 * segundos.
 *
 * Hoja modal de 3 pasos (patrón dialog de <DayCompleteCelebration/>). Se abre
 * sola en la PRIMERA visita (flag en localStorage) y queda siempre accesible
 * desde el botón "¿Cómo se juega?" que este mismo componente renderiza.
 */

const STORAGE_KEY = "mundialito:howto-seen";

const STEPS = [
  {
    icon: "⚽",
    title: "Pronostica los partidos del día",
    body: "Antes de cada kickoff, toca quién gana. Un toque y queda guardado (puedes cambiarlo hasta que empiece). Acertar el resultado suma 10 pts.",
  },
  {
    icon: "💎",
    title: "Suma el bonus de goles",
    body: "Si además pronosticas el rango de goles totales del partido y aciertas las dos cosas, es PLENO: 25 pts. Los penales no cuentan.",
  },
  {
    icon: "🔥",
    title: "Racha, niveles y amigos",
    body: "Pronostica TODOS los partidos del día y tu racha suma un día. Con puntos subes de nivel: 🪑 Suplente → 👕 Titular (100) → ⭐ Crack (300) → 👑 Leyenda (700). Compite en el ranking o crea una liga con amigos.",
  },
] as const;

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-apertura solo la primera vez, con una pausa corta para que primero
  // se vea la pantalla. En modo privado (sin localStorage) no forzamos nada:
  // queda el botón como entrada.
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage no disponible: no auto-abrimos.
    }
    if (seen) return;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setStep(0);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Sin localStorage se re-abrirá la próxima visita: aceptable.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start py-1 text-xs font-medium text-foreground-muted underline-offset-2 transition hover:text-foreground hover:underline"
      >
        ❓ ¿Cómo se juega?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="howto-title"
          onClick={close}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="absolute right-3 top-3 rounded-md px-2 py-1 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
            >
              ✕
            </button>

            <div className="text-5xl" aria-hidden>
              {current.icon}
            </div>
            <h2
              id="howto-title"
              className="mt-3 text-lg font-bold tracking-tight"
            >
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
              {current.body}
            </p>

            <div className="mt-4 flex items-center justify-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Paso ${i + 1}`}
                  aria-current={i === step ? "step" : undefined}
                  className={`h-2 rounded-full transition-all ${
                    i === step ? "w-5 bg-brand" : "w-2 bg-surface-muted"
                  }`}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => (isLast ? close() : setStep(step + 1))}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong"
              >
                {isLast ? "¡A jugar!" : "Siguiente"}
              </button>
              {!isLast && (
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-foreground-muted transition hover:text-foreground"
                >
                  Saltar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
