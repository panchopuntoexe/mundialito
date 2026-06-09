import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión · Prode Mundial",
};

/**
 * Pantalla de login (tarea 2.1). Server Component: lee un posible `?error=`
 * (devuelto por el callback o las actions) y delega la interacción al form.
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
        <h1 className="text-2xl font-bold tracking-tight">Prode Mundial</h1>
        <p className="text-balance text-sm text-foreground-muted">
          Pronostica los partidos del día y competí con tus amigos.
        </p>
      </header>

      <LoginForm error={error} />
    </div>
  );
}
