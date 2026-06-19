"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FaArrowsRotate } from "react-icons/fa6";

/**
 * Botón "actualizar datos" de la tarjeta de un partido (isla de cliente).
 *
 * El cron de match-sync escribe los scores/estado frescos en la DB cada minuto;
 * la Home es un Server Component que lee la DB en cada render. Así que para traer
 * lo último basta con `router.refresh()`: re-ejecuta el Server Component, vuelve
 * a leer la DB y repinta las tarjetas SIN perder el estado de las islas de
 * cliente (el formulario de pronóstico). Mismo patrón que LiveFeedToasts.
 *
 * No pegamos a API-Football desde acá a propósito (regla de arquitectura 1): el
 * cron es el único que la consulta; abrirla a cada usuario quemaría la cuota.
 */
export function RefreshMatchButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-label="Actualizar datos del partido"
      title="Actualizar datos"
      className={`-my-1.5 -mr-1 rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
    >
      <FaArrowsRotate
        className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
        aria-hidden
      />
    </button>
  );
}
