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
import { APP_HOST, APP_URL } from "@/lib/appUrl";
import { levelByKey } from "@/lib/scoring/levels";
import type { WrappedStats } from "@/lib/scoring/wrappedStats";
import { wrappedPhaseLabel } from "@/lib/wrapped/phases";
import { qrDataUrl } from "@/lib/wrapped/qr";

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

/** Stat grande con su etiqueta (racha / plenos). */
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

export async function renderWrappedImage(params: {
  username: string;
  stats: WrappedStats;
}): Promise<ImageResponse> {
  const { username, stats } = params;
  const achievementsCount = stats.achievements.length;
  const level = stats.levelKey ? levelByKey(stats.levelKey) : null;
  const qr = await qrDataUrl(APP_URL);

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
        {/* Header: branding a la izquierda, puntos estilo HP de Pokémon a la derecha */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
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
              Mundialito 2026
            </div>
            <div style={{ fontSize: 60, fontWeight: 800, marginTop: 8 }}>
              {wrappedPhaseLabel(stats.phase)}
            </div>
            <div style={{ fontSize: 40, color: COLOR.muted, marginTop: 4 }}>
              {`@${username}`}
            </div>
          </div>
          {/* Satori no soporta alignItems baseline: se simula con flex-end + margen. */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: COLOR.muted,
                letterSpacing: 2,
                marginRight: 12,
                marginBottom: 14,
              }}
            >
              PTS
            </div>
            <div style={{ fontSize: 88, fontWeight: 800, color: COLOR.foreground }}>
              {String(stats.totalPoints)}
            </div>
          </div>
        </div>

        {/* Accuracy gigante */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 28,
          }}
        >
          <div style={{ fontSize: 210, fontWeight: 800, color: COLOR.brand }}>
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
            marginTop: 36,
            backgroundColor: COLOR.surface,
            borderRadius: 28,
            border: `2px solid ${COLOR.border}`,
            padding: "36px 24px",
          }}
        >
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
            marginTop: 32,
            backgroundColor: COLOR.surfaceMuted,
            borderRadius: 28,
            borderLeft: `10px solid ${COLOR.danger}`,
            padding: 36,
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

        {/* Footer: nivel + logros (izq) · QR + nombre de la app (der) */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {level ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  backgroundColor: COLOR.surface,
                  border: `2px solid ${level.color}`,
                  borderRadius: 9999,
                  padding: "10px 22px",
                  fontSize: 34,
                  fontWeight: 700,
                  color: level.color,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {level.name}
              </div>
            ) : null}
            <div style={{ fontSize: 34, color: COLOR.foreground }}>
              {`${achievementsCount} ${achievementsCount === 1 ? "logro" : "logros"}`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              width={132}
              height={132}
              alt=""
              style={{ borderRadius: 16, backgroundColor: "#ffffff" }}
            />
            <div style={{ fontSize: 26, color: COLOR.muted }}>{APP_HOST}</div>
          </div>
        </div>
      </div>
    ),
    { width: WRAPPED_IMAGE_WIDTH, height: WRAPPED_IMAGE_HEIGHT },
  );
}

/** Stats de muestra (`?preview=1`), compartidas con la página de preview dev. */
export { SAMPLE_WRAPPED_STATS } from "./samples";
