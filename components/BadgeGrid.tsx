"use client";

import { useState } from "react";
import {
  ACHIEVEMENT_DEFS,
  type AchievementType,
} from "@/lib/scoring/achievements";

/**
 * Grilla de insignias (logros). Muestra TODAS las definidas: las ganadas en color
 * y las pendientes en gris. En móvil (<sm) solo se ve el ícono; el nombre y la
 * frase viven en el tooltip, que abre con hover/foco (CSS) o con tap (estado:
 * uno abierto a la vez). Recibe los tipos ya ganados del usuario.
 */
export function BadgeGrid({ earned }: { earned: AchievementType[] }) {
  const earnedSet = new Set(earned);
  const [open, setOpen] = useState<AchievementType | null>(null);

  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-2">
      {ACHIEVEMENT_DEFS.map((def) => {
        const has = earnedSet.has(def.type);
        const isOpen = open === def.type;
        return (
          <li key={def.type} className="relative">
            <button
              type="button"
              aria-describedby={`badge-tip-${def.type}`}
              onClick={() => setOpen(isOpen ? null : def.type)}
              onBlur={() => setOpen(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(null);
              }}
              className={`peer flex w-full items-start justify-center gap-2.5 rounded-lg border p-3 text-left sm:justify-start ${
                has
                  ? "border-border bg-surface"
                  : "border-border/50 bg-surface/40 opacity-60"
              }`}
            >
              <span
                aria-hidden
                className={`text-xl leading-none ${has ? "" : "grayscale"}`}
              >
                {def.icon}
              </span>
              <span className="hidden min-w-0 flex-col sm:flex">
                <span className="text-sm font-semibold">{def.label}</span>
                <span className="text-xs text-foreground-muted">
                  {def.description}
                </span>
              </span>
            </button>
            <span
              role="tooltip"
              id={`badge-tip-${def.type}`}
              className={`pointer-events-none absolute inset-x-0 bottom-full z-10 mb-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-1.5 text-xs shadow-lg transition-opacity ${
                isOpen
                  ? "opacity-100"
                  : "opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100"
              }`}
            >
              <span className="font-semibold sm:hidden">{def.label} · </span>
              {def.funFact}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
