"use client";

import { useEffect, useState } from "react";
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/notifications/client";

/**
 * Tarjeta de opt-in de notificaciones push (tarea 8.3).
 *
 * Se autooculta si el push no está soportado por el navegador o si no hay clave
 * VAPID pública configurada (push deshabilitado). Permite activar/desactivar y
 * mandar una notificación de prueba (/api/notifications/test).
 */
type Status = "loading" | "unsupported" | "off" | "on" | "denied";

export function PushOptIn() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Detección asíncrona: lee APIs del navegador (no disponibles en SSR) y la
    // suscripción existente. El setState ocurre en el callback diferido, no en
    // el cuerpo del efecto (evita cascadas de render).
    async function detect(): Promise<Status> {
      if (!vapidKey || !isPushSupported()) return "unsupported";
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

  // No renderizar nada si el push no aplica (soporte/clave/permiso bloqueado).
  if (status === "loading" || status === "unsupported") return null;

  async function enable() {
    if (!vapidKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const ok = await subscribeToPush(vapidKey);
      if (ok) {
        setStatus("on");
        setMessage("Listo, te avisaremos de los partidos del día.");
      } else {
        setStatus(Notification.permission === "denied" ? "denied" : "off");
        setMessage("No se pudo activar. Revisá los permisos del navegador.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      await unsubscribeFromPush();
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setMessage(
        res.ok
          ? "Notificación de prueba enviada."
          : (data?.error ?? "No se pudo enviar la prueba."),
      );
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
            {status === "denied"
              ? "Bloqueadas en el navegador. Habilitalas desde la configuración del sitio."
              : status === "on"
                ? "Activadas en este dispositivo."
                : "Activá avisos del partido del día y cierre próximo."}
          </p>
        </div>
        {status === "on" ? (
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            Desactivar
          </button>
        ) : status === "off" ? (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
          >
            Activar
          </button>
        ) : null}
      </div>

      {status === "on" && (
        <button
          type="button"
          onClick={sendTest}
          disabled={busy}
          className="mt-3 text-xs font-medium text-brand underline-offset-2 hover:underline disabled:opacity-50"
        >
          Enviar notificación de prueba
        </button>
      )}

      {message && (
        <p className="mt-2 text-xs text-foreground-muted">{message}</p>
      )}
    </section>
  );
}
