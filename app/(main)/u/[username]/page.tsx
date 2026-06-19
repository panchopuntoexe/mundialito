import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeGrid } from "@/components/BadgeGrid";
import { GuestCta } from "@/components/GuestCta";
import { LevelIcon } from "@/components/icons";
import { ProfilePredictions } from "@/components/ProfilePredictions";
import { APP_URL } from "@/lib/appUrl";
import { loadProfilePredictions, loadPublicProfile } from "@/lib/profiles/load";
import { ACHIEVEMENT_DEFS } from "@/lib/scoring/achievements";
import { levelForPoints } from "@/lib/scoring/levels";
import { createClient } from "@/lib/supabase/server";

/**
 * OG dinámico (Bet 3): un link de perfil compartido en WhatsApp/X muestra una
 * tarjeta rica (username + nivel + puntos + precisión) en vez de un preview
 * pobre. La `og:image` reusa la imagen Satori de stats en vivo (pública). Sube el
 * click-through de cada share — el motor de la viralidad.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadPublicProfile(
    decodeURIComponent(username).toLowerCase(),
  );
  if (!profile) {
    return { title: "Perfil no encontrado · Mundialito 2026" };
  }

  const level = levelForPoints(profile.total_points);
  const title = `@${profile.username} · ${level.name} · Mundialito 2026`;
  const description = `${profile.total_points} pts y ${profile.accuracy}% de aciertos en el Mundial 2026. ¿Le ganas?`;
  const image = `${APP_URL}/api/wrapped/live-image?user=${profile.user_id}`;
  const url = `${APP_URL}/u/${encodeURIComponent(profile.username)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      images: [{ url: image, width: 1080, height: 1080, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/**
 * Perfil público de un usuario: la tarjeta de estadísticas detrás de cada fila
 * del ranking. URL compartible (/u/<username>) — pieza de viralidad: se puede
 * pegar en redes/WhatsApp y quien la abre la ve SIN sesión (ruta pública en el
 * proxy), con el CTA de "Jugar sin cuenta" al pie.
 *
 * Server Component dentro de (main): hereda header/nav. Los datos los trae un
 * loader server-only con service role (la RLS solo deja leer la fila propia).
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await loadPublicProfile(
    decodeURIComponent(username).toLowerCase(),
  );
  if (!profile) {
    notFound();
  }

  const level = levelForPoints(profile.total_points);
  const isMe = profile.user_id === user?.id;
  const predictions = await loadProfilePredictions(profile.user_id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col items-center gap-2 text-center">
        {profile.avatar_url ? (
          // Avatar viene como URL del proveedor OAuth; <img> simple basta acá.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-xl font-bold uppercase text-foreground-muted"
          >
            {profile.username[0]}
          </span>
        )}
        <h1 className="text-lg font-bold tracking-tight">
          @{profile.username}
          {isMe && (
            <span className="ml-1.5 text-xs font-normal text-brand">· tú</span>
          )}
        </h1>
        <span
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium"
          style={{ color: level.color }}
        >
          <LevelIcon level={level.key} />
          {level.name}
        </span>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <Stat value={`${profile.total_points}`} label="Puntos" />
        <Stat value={`${profile.accuracy}%`} label="Precisión" />
        <Stat value={`${profile.max_streak}`} label="Racha máx." />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight">
          Logros{" "}
          <span className="font-normal text-foreground-muted">
            · {profile.earned.length}/{ACHIEVEMENT_DEFS.length}
          </span>
        </h2>
        <BadgeGrid earned={profile.earned} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight">Pronósticos</h2>
        <ProfilePredictions predictions={predictions} />
      </section>

      {!user && <GuestCta />}
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-surface p-3">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
    </div>
  );
}
