import Link from "next/link";

/**
 * CTA para visitantes sin sesión en las páginas públicas (/ranking, /u/...).
 * Cierra el loop viral: quien llega por un link compartido queda a un tap de
 * jugar. Server Component, sin estado.
 */
export function GuestCta() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 p-5 text-center">
      <p className="text-sm font-semibold">¿Te animas a hacerlo mejor?</p>
      <p className="text-xs text-foreground-muted">
        Pronostica los partidos del Mundial 2026 y aparece en este ranking. Sin
        registro.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-background transition hover:bg-brand-strong"
      >
        ⚽ Jugar sin cuenta
      </Link>
    </section>
  );
}
