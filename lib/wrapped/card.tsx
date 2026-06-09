/**
 * Renderizador de la imagen de la tarjeta Wrapped (tarea 7.2).
 *
 * `renderWrappedImage` arma la PNG server-side con @vercel/og (`next/og`) a partir
 * del snapshot de stats (7.1). Es compartido por:
 *  - la API Route `/api/wrapped/image` (sirve la imagen en vivo desde la DB), y
 *  - el cron de Wrapped (7.3), que la pre-renderiza y sube a Supabase Storage.
 *
 * Restricciones de Satori: solo flexbox y estilos inline (sin Tailwind). Cada div
 * con varios hijos lleva `display: flex` explícito. Sin emojis (evita fetch de
 * sprites en el cron) — se usan color y texto.
 */
import { ImageResponse } from "next/og";
import type { WrappedStats } from "@/lib/scoring/wrappedStats";
import { wrappedPhaseLabel } from "@/lib/wrapped/phases";

/** Formato vertical 4:5, ideal para stories/feed de redes. */
export const WRAPPED_IMAGE_WIDTH = 1080;
export const WRAPPED_IMAGE_HEIGHT = 1350;

const COLOR = {
  background: "#0a0a0b",
  surface: "#161618",
  surfaceMuted: "#1f1f23",
  border: "#2a2a2f",
  foreground: "#ededed",
  muted: "#a1a1aa",
  brand: "#22c55e",
  accent: "#f59e0b",
  danger: "#ef4444",
} as const;

/** Stat grande con su etiqueta (puntos / racha / plenos). */
function StatBlock({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
      }}
    >
      <div style={{ fontSize: 80, fontWeight: 800, color }}>{value}</div>
      <div
        style={{
          fontSize: 30,
          color: COLOR.muted,
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function renderWrappedImage(params: {
  username: string;
  stats: WrappedStats;
}): ImageResponse {
  const { username, stats } = params;
  const achievementsCount = stats.achievements.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLOR.background,
          color: COLOR.foreground,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 32,
              color: COLOR.brand,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            Prode Mundial 2026
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, marginTop: 8 }}>
            {wrappedPhaseLabel(stats.phase)}
          </div>
          <div style={{ fontSize: 40, color: COLOR.muted, marginTop: 4 }}>
            {`@${username}`}
          </div>
        </div>

        {/* Accuracy gigante */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 48,
          }}
        >
          <div style={{ fontSize: 240, fontWeight: 800, color: COLOR.brand }}>
            {`${stats.accuracy}%`}
          </div>
          <div
            style={{
              fontSize: 36,
              color: COLOR.muted,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            {`de aciertos · ${stats.correctPredictions}/${stats.totalPredictions}`}
          </div>
        </div>

        {/* Fila de stats */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            marginTop: 56,
            backgroundColor: COLOR.surface,
            borderRadius: 28,
            border: `2px solid ${COLOR.border}`,
            padding: "40px 24px",
          }}
        >
          <StatBlock
            value={String(stats.totalPoints)}
            label="Puntos"
            color={COLOR.foreground}
          />
          <StatBlock
            value={String(stats.maxStreak)}
            label="Racha máx"
            color={COLOR.accent}
          />
          <StatBlock
            value={String(stats.perfectPredictions)}
            label="Plenos"
            color={COLOR.brand}
          />
        </div>

        {/* Fallo épico */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 48,
            backgroundColor: COLOR.surfaceMuted,
            borderRadius: 28,
            borderLeft: `10px solid ${COLOR.danger}`,
            padding: 40,
          }}
        >
          <div
            style={{
              fontSize: 30,
              color: COLOR.danger,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Tu fallo épico
          </div>
          {stats.epicMiss ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 52, fontWeight: 700, marginTop: 10 }}>
                {stats.epicMiss.matchLabel}
              </div>
              <div style={{ fontSize: 34, color: COLOR.muted, marginTop: 6 }}>
                {`${stats.epicMiss.communityCorrectPct}% lo vio venir… menos vos`}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 44, fontWeight: 700, marginTop: 10 }}>
              Sin fallos épicos. Impecable.
            </div>
          )}
        </div>

        {/* Footer: logros */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 40,
          }}
        >
          <div style={{ fontSize: 34, color: COLOR.foreground }}>
            {`${achievementsCount} ${achievementsCount === 1 ? "logro" : "logros"}`}
          </div>
          <div style={{ fontSize: 30, color: COLOR.muted }}>
            prode-mundial.app
          </div>
        </div>
      </div>
    ),
    { width: WRAPPED_IMAGE_WIDTH, height: WRAPPED_IMAGE_HEIGHT },
  );
}

/** Stats de muestra para previsualizar el diseño (`?preview=1`). */
export const SAMPLE_WRAPPED_STATS: WrappedStats = {
  phase: "group_stage",
  totalPredictions: 12,
  correctPredictions: 8,
  perfectPredictions: 3,
  accuracy: 67,
  totalPoints: 145,
  maxStreak: 6,
  epicMiss: {
    matchId: 7,
    matchLabel: "BRA vs CRC",
    communityCorrectPct: 92,
  },
  achievements: ["first_win", "sharpshooter", "streak_3"],
};
