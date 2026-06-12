"use client";

import { useState } from "react";
import { BadgeIcon } from "@/components/icons";
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
              className={`peer flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-center sm:flex-row sm:items-start sm:gap-2.5 sm:p-3 sm:text-left ${
                has
                  ? "border-border bg-surface"
                  : "border-border/50 bg-surface/40 opacity-60"
              }`}
            >
              <span
                aria-hidden
                className={`text-xl leading-none ${
                  has ? "text-brand" : "text-foreground-muted"
                }`}
              >
                <BadgeIcon type={def.type} />
              </span>
              <span className="flex min-w-0 flex-col items-center sm:items-start">
                <span className="text-[10px] font-semibold leading-tight sm:text-sm">
                  {def.label}
                </span>
                <span className="hidden text-xs text-foreground-muted sm:block">
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
              <span className="sm:hidden">{def.description} · </span>
              {def.funFact}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
