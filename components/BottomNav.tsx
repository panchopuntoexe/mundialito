"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaChartColumn,
  FaFutbol,
  FaTrophy,
  FaUserGroup,
} from "react-icons/fa6";

/**
 * Barra de navegación inferior fija (estilo app nativa). Reemplaza a las tabs
 * del header: queda al alcance del pulgar y marca la sección activa (cosa que
 * las tabs viejas no hacían). El padding inferior respeta el safe area de iOS
 * en modo standalone (viewportFit: "cover" en el root layout).
 */

const TABS = [
  { href: "/", label: "Hoy", icon: FaFutbol },
  { href: "/estadisticas", label: "Estadísticas", icon: FaChartColumn },
  { href: "/ranking", label: "Ranking", icon: FaTrophy },
  { href: "/leagues", label: "Ligas", icon: FaUserGroup },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-md">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition ${
                  active
                    ? "text-brand"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-12 items-center justify-center rounded-full text-base leading-none ${
                    active ? "bg-brand/15" : ""
                  }`}
                >
                  <tab.icon />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
