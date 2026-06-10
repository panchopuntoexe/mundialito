import {
  ACHIEVEMENT_DEFS,
  type AchievementType,
} from "@/lib/scoring/achievements";

/**
 * Grilla de insignias (logros). Muestra TODAS las definidas: las ganadas en color
 * y las pendientes en gris con su criterio de desbloqueo. Componente presentacional
 * (sin estado): recibe los tipos ya ganados del usuario.
 */
export function BadgeGrid({ earned }: { earned: AchievementType[] }) {
  const earnedSet = new Set(earned);

  return (
    <ul className="grid grid-cols-2 gap-2">
      {ACHIEVEMENT_DEFS.map((def) => {
        const has = earnedSet.has(def.type);
        return (
          <li
            key={def.type}
            className={`flex items-start gap-2.5 rounded-lg border p-3 ${
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
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">{def.label}</span>
              <span className="text-xs text-foreground-muted">
                {def.description}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
