import type { Metadata } from "next";
import { Samy } from "@/components/Samy";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Mundialito · Pronosticá el Mundial",
};

/**
 * Mini-landing de entrada (tarea 2.1 + modo invitado). Server Component: lee un
 * posible `?error=` (devuelto por el callback o las actions) y delega la
 * interacción al form, cuya acción primaria es "Jugar sin cuenta".
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-brand">
          Mundial 2026
        </span>
        <span className="flex items-center gap-2">
          <Samy size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Mundialito</h1>
        </span>
        <p className="text-balance text-sm text-foreground-muted">
          Pronosticá los partidos del Mundial 2026, sumá puntos y competí con
          tus amigos.
        </p>
      </header>

      <LoginForm error={error} />
    </div>
  );
}
