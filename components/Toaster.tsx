"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { FaBolt, FaCircleCheck, FaXmark } from "react-icons/fa6";

/**
 * Sistema de toasts ligero (Bet 2): provider + hook + UI, sin dependencias.
 *
 * El momento "gané puntos" es el pico de dopamina del día y hoy se pierde hasta
 * recargar. <LiveFeedToasts/> se suscribe a Supabase Realtime y dispara estos
 * toasts cuando el cron procesa un partido o desbloquea una insignia. Reutilizable
 * para cualquier feedback efímero. Respeta prefers-reduced-motion vía la capa de
 * movimiento de globals.css (animate-fade-in-up).
 */

export interface ToastInput {
  title: string;
  description?: string;
  variant?: "success" | "info";
}

interface Toast extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider/>.");
  }
  return ctx;
}

/** Cuánto vive un toast antes de auto-cerrarse. */
const TOAST_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Contador monotónico para keys estables (sin Math.random ni Date.now).
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = (nextId.current += 1);
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Apilados arriba de la BottomNav, centrados, sin bloquear el tap. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const isSuccess = toast.variant !== "info";
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
    >
      <span
        aria-hidden
        className={`mt-0.5 shrink-0 text-lg ${isSuccess ? "text-brand" : "text-accent"}`}
      >
        {isSuccess ? <FaCircleCheck /> : <FaBolt />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="truncate text-xs text-foreground-muted">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar"
        className="shrink-0 rounded-md p-1 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
      >
        <FaXmark aria-hidden />
      </button>
    </div>
  );
}
