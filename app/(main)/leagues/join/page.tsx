import Link from "next/link";
import { redirect } from "next/navigation";
import { FaFutbol, FaTrophy } from "react-icons/fa6";
import { signInAsGuest } from "@/app/(auth)/actions";
import { AutoJoinLeague } from "@/components/AutoJoinLeague";
import { getServerUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Deep link de invitación a liga (rediseño de usabilidad / viralidad):
 * /leagues/join?code=K7QMA9. Antes el invitado tenía que tipear el código a
 * mano; ahora el link compartido lo deja DENTRO de la liga en un toque:
 *
 *  - Con sesión: <AutoJoinLeague/> postea al endpoint existente y redirige.
 *  - Sin sesión (ruta pública en el proxy): landing "te invitaron a X" con
 *    "Unirme sin cuenta" (guest sign-in que vuelve acá con el code intacto).
 *
 * El nombre de la liga se resuelve con el cliente admin: la RLS oculta las
 * ligas a quien no es miembro, y el código ES la invitación.
 */
export default async function JoinLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code: rawCode } = await searchParams;
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) {
    redirect("/leagues");
  }

  const admin = createAdminClient();
  const { data: league } = await admin
    .from("leagues")
    .select("name")
    .eq("invite_code", code)
    .maybeSingle();

  const user = await getServerUser();

  if (!league) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-foreground-muted">
            Ese código de invitación no existe. Pedile a tu amigo que te
            comparta el link de nuevo.
          </p>
          <Link
            href={user ? "/leagues" : "/login"}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong"
          >
            {user ? "Ir a mis ligas" : "Jugar igual"}
          </Link>
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        <AutoJoinLeague code={code} leagueName={league.name} />
      </main>
    );
  }

  // Sin sesión: un toque y adentro. La action vuelve a esta misma URL con la
  // sesión de invitado creada → cae en la rama de auto-unión.
  const joinPath = `/leagues/join?code=${encodeURIComponent(code)}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl text-brand" aria-hidden>
          <FaTrophy />
        </span>
        <h1 className="text-lg font-bold tracking-tight">
          Te invitaron a la liga «{league.name}»
        </h1>
        <p className="text-sm text-foreground-muted">
          Pronostica los partidos del Mundial 2026, suma puntos y compite con
          tus amigos.
        </p>
      </header>

      <form
        action={signInAsGuest.bind(null, joinPath)}
        className="flex flex-col gap-2"
      >
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-background transition hover:bg-brand-strong"
        >
          <FaFutbol aria-hidden />
          Unirme sin cuenta
        </button>
        <p className="text-center text-xs text-foreground-muted">
          Sin registro. Después puedes guardar tu progreso con Google.
        </p>
      </form>

      <p className="text-center text-xs text-foreground-muted">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Inicia sesión
        </Link>{" "}
        y únete con el código{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {code}
        </span>
        .
      </p>
    </main>
  );
}
