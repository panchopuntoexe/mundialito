import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerProfile, getServerUser } from "@/lib/supabase/auth";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = {
  title: "Elige tu username · Mundialito",
};

/**
 * Onboarding (tarea 2.3). Gate server-side:
 *  - sin sesión → /login (el middleware ya lo cubre; defensivo).
 *  - con perfil ya creado → /  (no se vuelve a onboarding).
 *  - si no, se pide el username.
 */
export default async function OnboardingPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const profile = await getServerProfile();
  if (profile) redirect("/");

  const suggested =
    (user.user_metadata?.name as string | undefined)
      ?.toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) ?? "";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Elige tu username</h1>
        <p className="text-balance text-sm text-foreground-muted">
          Así te van a ver tus amigos en los rankings y ligas. Después no se
          puede cambiar fácil, piénsalo bien.
        </p>
      </header>

      <OnboardingForm initialUsername={suggested} />
    </div>
  );
}
