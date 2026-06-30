import { FaSitemap } from "react-icons/fa6";
import { BracketView } from "@/components/BracketView";
import { loadBracket } from "@/lib/bracket/loadBracket";
import { createClient } from "@/lib/supabase/server";

/**
 * Cuadro de eliminación (read-only). Muestra el bracket del torneo como se va
 * llenando, con los pronósticos PROPIOS marcados (✓/✗ resueltos, o el pick
 * pendiente). No se pronostica acá: eso vive en "Hoy" (partido del día).
 *
 * Server Component: trae el cuadro (cacheado) + los pronósticos del usuario en un
 * render. Visible también para invitados sin sesión (viralidad): sin marcas.
 */
export default async function CuadroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const columns = await loadBracket(user?.id ?? null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight">Cuadro de eliminación</h1>
        <p className="text-sm text-foreground-muted">
          El camino al título. Desliza cada ronda; tus pronósticos quedan marcados.
        </p>
      </header>

      {columns.length === 0 ? (
        <div className="animate-fade-in-up flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-6 text-center">
          <span className="text-2xl text-foreground-muted" aria-hidden>
            <FaSitemap />
          </span>
          <p className="text-sm font-semibold text-foreground">
            El cuadro todavía no está
          </p>
          <p className="text-sm text-foreground-muted">
            Aparece cuando arranca la eliminación directa. Por ahora, sigue la fase
            de grupos en Hoy.
          </p>
        </div>
      ) : (
        <BracketView columns={columns} hasUser={user !== null} />
      )}
    </main>
  );
}
