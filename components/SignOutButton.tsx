"use client";

import { signOut } from "@/app/(auth)/actions";

/**
 * Botón de cerrar sesión del header. Para invitados (sesión anónima) pide
 * confirmación antes del POST: salir sin guardar la cuenta pierde el progreso
 * para siempre (la sesión anónima no se puede recuperar). Con `showLabel`
 * muestra el texto "Salir" junto al ícono (usado en la barra de invitado).
 */
export function SignOutButton({
  isAnonymous,
  showLabel = false,
}: {
  isAnonymous: boolean;
  showLabel?: boolean;
}) {
  return (
    <form
      action={signOut}
      onSubmit={(e) => {
        if (
          isAnonymous &&
          !window.confirm(
            "Estás jugando como invitado: si sales, pierdes tu progreso para siempre. ¿Salir igual?",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        aria-label="Salir"
        title={isAnonymous ? "Salir (pierdes tu progreso)" : "Salir"}
        className={
          showLabel
            ? "flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
            : "flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {showLabel && <span>Salir</span>}
      </button>
    </form>
  );
}
