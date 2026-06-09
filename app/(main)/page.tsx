/**
 * Home de la app principal (protegida). Placeholder hasta la FASE 4, donde se
 * construye la pantalla de pronóstico del día (tareas 4.4–4.6).
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-brand">
        Mundial 2026
      </span>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Prode Mundial
      </h1>
      <p className="max-w-sm text-balance text-foreground-muted">
        Pronostica los partidos del día, suma puntos y compite con amigos.
      </p>
    </main>
  );
}
