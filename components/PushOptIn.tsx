"use client";

import { useEffect, useState } from "react";
import {
  getExistingSubscription,
  isPushSupported,
  isValidVapidPublicKey,
  subscribeToPush,
  PUSH_REASON_MESSAGES,
} from "@/lib/notifications/client";

/**
 * Tarjeta de opt-in de notificaciones push (tarea 8.3).
 *
 * Solo se muestra mientras la decisión está pendiente: se autooculta si el push
 * no está soportado por el navegador, si no hay clave VAPID pública configurada
 * (push deshabilitado), o cuando el usuario ya las activó o las negó (después
 * se gestionan desde la configuración del navegador).
 */
type Status = "loading" | "unsupported" | "off" | "on" | "denied";

export function PushOptIn() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Detección asíncrona: lee APIs del navegador (no disponibles en SSR) y la
    // suscripción existente. El setState ocurre en el callback diferido, no en
    // el cuerpo del efecto (evita cascadas de render).
    async function detect(): Promise<Status> {
      if (!vapidKey || !isValidVapidPublicKey(vapidKey) || !isPushSupported()) {
        return "unsupported";
      }
      if (Notification.permission === "denied") return "denied";
      const sub = await getExistingSubscription().catch(() => null);
      return sub ? "on" : "off";
    }

    detect().then((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  // Solo renderizar con la decisión pendiente ("off"): activadas, negadas,
  // sin soporte o sin clave → nada.
  if (status !== "off") return null;

  async function enable() {
    if (!vapidKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await subscribeToPush(vapidKey);
      if (result.ok) {
        // La tarjeta desaparece: la activación queda confirmada por su ausencia.
        setStatus("on");
        return;
      }
      if (result.reason === "denied") {
        setStatus("denied");
        return;
      }
      setMessage(PUSH_REASON_MESSAGES[result.reason]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Notificaciones</h2>
          <p className="text-xs text-foreground-muted">
            Activa avisos del partido del día y cierre próximo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
        >
          Activar
        </button>
      </div>

      {message && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {message}
        </p>
      )}
    </section>
  );
}
