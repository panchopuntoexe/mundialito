"use client";

import { useCallback, useEffect, useState } from "react";
import type { IconType } from "react-icons";
import {
  FaBell,
  FaCircleCheck,
  FaCircleQuestion,
  FaFire,
  FaFutbol,
  FaGem,
  FaXmark,
} from "react-icons/fa6";
import {
  getExistingSubscription,
  isPushSupported,
  isValidVapidPublicKey,
  subscribeToPush,
  PUSH_REASON_MESSAGES,
} from "@/lib/notifications/client";

/**
 * "¿Cómo se juega?" — la única educación explícita de las reglas (rediseño de
 * usabilidad). Antes los puntos, el bonus, la racha y los niveles solo se
 * descubrían jugando; para una app viral el loop tiene que entenderse en
 * segundos.
 *
 * Hoja modal de pasos (patrón dialog de <DayCompleteCelebration/>). Se abre
 * sola en la PRIMERA visita (flag en localStorage) y queda siempre accesible
 * desde el botón "¿Cómo se juega?" que este mismo componente renderiza.
 *
 * El último paso es el opt-in de notificaciones (tarea 8.6/8.7): pedir el
 * permiso al final del tutorial, en un momento de intención, convierte mucho
 * mejor que una tarjeta suelta. Solo aparece si el push está soportado y
 * configurado (clave VAPID); si no, el tutorial se queda en los pasos de reglas.
 */

const STORAGE_KEY = "mundialito:howto-seen";

interface StepDef {
  kind: "info" | "push";
  icon: IconType;
  title: string;
  body: string;
}

const INFO_STEPS: StepDef[] = [
  {
    kind: "info",
    icon: FaFutbol,
    title: "Pronostica los partidos del día",
    body: "Antes de cada kickoff, toca quién gana. Un toque y queda guardado (puedes cambiarlo hasta que empiece). Acertar el resultado suma 10 pts.",
  },
  {
    kind: "info",
    icon: FaGem,
    title: "Suma el bonus de goles",
    body: "Si además pronosticas el rango de goles totales del partido y aciertas las dos cosas, es PLENO: 25 pts. Los penales no cuentan.",
  },
  {
    kind: "info",
    icon: FaFire,
    title: "Racha, niveles y amigos",
    body: "Pronostica TODOS los partidos del día y tu racha suma un día. Con puntos subes de nivel: Suplente → Titular (100) → Crack (300) → Leyenda (700). Compite en el ranking o crea una liga con amigos.",
  },
];

const PUSH_STEP: StepDef = {
  kind: "push",
  icon: FaBell,
  title: "Activa las notificaciones",
  body: "Te avisamos si se te olvida pronosticar (como máximo una vez al día, sin spam) y cuando tu Wrapped esté listo para compartir.",
};

/** loading/unavailable → el paso no se muestra; off/on/denied → sí. */
type PushStatus = "loading" | "unavailable" | "off" | "on" | "denied";

export function HowToPlay() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const [pushStatus, setPushStatus] = useState<PushStatus>("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  // Detección asíncrona del push (igual que <PushOptIn/>): lee APIs del
  // navegador (no hay en SSR) y la suscripción existente. Decide si el paso de
  // notificaciones forma parte del tutorial.
  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<PushStatus> {
      if (!vapidKey || !isValidVapidPublicKey(vapidKey) || !isPushSupported()) {
        return "unavailable";
      }
      if (Notification.permission === "denied") return "denied";
      const sub = await getExistingSubscription().catch(() => null);
      return sub ? "on" : "off";
    }
    detect().then((next) => {
      if (!cancelled) setPushStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

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

  async function enablePush() {
    if (!vapidKey) return;
    setPushBusy(true);
    setPushMessage(null);
    try {
      const result = await subscribeToPush(vapidKey);
      if (result.ok) {
        setPushStatus("on");
        return;
      }
      if (result.reason === "denied") {
        setPushStatus("denied");
        return;
      }
      setPushMessage(PUSH_REASON_MESSAGES[result.reason]);
    } finally {
      setPushBusy(false);
    }
  }

  // El paso de notificaciones solo entra si el push está disponible.
  const showPushStep = pushStatus === "off" || pushStatus === "on" || pushStatus === "denied";
  const steps = showPushStep ? [...INFO_STEPS, PUSH_STEP] : INFO_STEPS;

  // El estado del push puede resolverse con el modal ya abierto en un paso que
  // dejó de existir: acotar el índice evita un current indefinido.
  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep];
  const isLast = safeStep === steps.length - 1;
  const isPushOff = current.kind === "push" && pushStatus === "off";

  // El botón primario hace doble función: en el paso de push pendiente, activa;
  // en cualquier otro, avanza o cierra.
  const primaryLabel = isPushOff
    ? pushBusy
      ? "Activando…"
      : "Activar notificaciones"
    : isLast
      ? "¡A jugar!"
      : "Siguiente";

  function onPrimary() {
    if (isPushOff) {
      void enablePush();
      return;
    }
    if (isLast) {
      close();
      return;
    }
    setStep(safeStep + 1);
  }

  // Secundario: saltar pasos intermedios, o declinar el push sin bloquear.
  const showSecondary = !isLast || isPushOff;
  const secondaryLabel = isPushOff ? "Ahora no" : "Saltar";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 self-start py-1 text-xs font-medium text-foreground-muted underline-offset-2 transition hover:text-foreground hover:underline"
      >
        <FaCircleQuestion aria-hidden />
        ¿Cómo se juega?
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
              <FaXmark aria-hidden />
            </button>

            <div
              className="flex justify-center text-5xl text-brand"
              aria-hidden
            >
              <current.icon />
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

            {current.kind === "push" && pushStatus === "on" && (
              <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-brand">
                <FaCircleCheck aria-hidden />
                ¡Listas! Te avisaremos cuando haga falta.
              </p>
            )}
            {current.kind === "push" && pushStatus === "denied" && (
              <p className="mt-3 text-sm text-foreground-muted">
                {PUSH_REASON_MESSAGES.denied}
              </p>
            )}
            {pushMessage && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {pushMessage}
              </p>
            )}

            <div className="mt-4 flex items-center justify-center gap-1.5">
              {steps.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Paso ${i + 1}`}
                  aria-current={i === safeStep ? "step" : undefined}
                  className={`h-2 rounded-full transition-all ${
                    i === safeStep ? "w-5 bg-brand" : "w-2 bg-surface-muted"
                  }`}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={onPrimary}
                disabled={pushBusy}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
              >
                {primaryLabel}
              </button>
              {showSecondary && (
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-foreground-muted transition hover:text-foreground"
                >
                  {secondaryLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
