/**
 * Renderizador de la tarjeta de stats en vivo (mini-Wrapped permanente).
 *
 * A diferencia del Wrapped (snapshot inmutable al cierre de cada macro-ronda),
 * esta tarjeta muestra las stats ACUMULADAS del usuario al momento de pedirla:
 * puntos, precisión, racha actual, posición en el ranking y nivel. Compartible
 * en cualquier momento del torneo, sin esperar al fin de fase.
 *
 * Mismas restricciones de Satori que las otras tarjetas (lib/wrapped/card):
 * solo flexbox y estilos inline, sin emojis. Como la data es viva, se anula el
 * cache-control inmutable de un año que `ImageResponse` pone por defecto en
 * producción.
 */
import { ImageResponse } from "next/og";
import { APP_HOST, APP_URL } from "@/lib/appUrl";
import { levelByKey, type LevelKey } from "@/lib/scoring/levels";
import { qrDataUrl } from "@/lib/wrapped/qr";

/** Cuadrada 1:1, igual que la mini-tarjeta de resultado (feed/chat previews). */
export const LIVE_STATS_CARD_SIZE = 1080;

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

export interface LiveStatsCardData {
  username: string;
  totalPoints: number;
  levelKey: LevelKey;
  /** % de aciertos (0–100). */
  accuracy: number;
  correctPredictions: number;
  totalPredictions: number;
  /** Racha de participación actual, en días. */
  currentStreak: number;
  /** Posición en el ranking global por puntos (1-based). */
  rank: number;
  /** Total de participantes del ranking (`de N`). */
  rankTotal: number;
}

/** Stat grande con su etiqueta (racha / posición). Igual a la del Wrapped. */
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

export async function renderLiveStatsImage(
  data: LiveStatsCardData,
): Promise<ImageResponse> {
  const level = levelByKey(data.levelKey);
  // QR a la app (mismo de las otras tarjetas): quien ve la imagen compartida
  // queda a un escaneo de jugar.
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
          padding: 80,
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
                fontSize: 30,
                color: COLOR.brand,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 4,
              }}
            >
              Mundialito 2026
            </div>
            {/* <div style={{ fontSize: 52, fontWeight: 800, marginTop: 8 }}>
              Mis stats
            </div> */}
            <div style={{ fontSize: 38, color: COLOR.muted, marginTop: 4 }}>
              {`@${data.username}`}
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
              {String(data.totalPoints)}
            </div>
          </div>
        </div>

        {/* Accuracy gigante */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: 180, fontWeight: 800, color: COLOR.brand }}>
            {`${data.accuracy}%`}
          </div>
          <div
            style={{
              fontSize: 36,
              color: COLOR.muted,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            {`de aciertos · ${data.correctPredictions}/${data.totalPredictions}`}
          </div>
        </div>

        {/* Fila de stats: racha actual + posición en el ranking */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            marginTop: 32,
            backgroundColor: COLOR.surface,
            borderRadius: 28,
            border: `2px solid ${COLOR.border}`,
            padding: "28px 24px",
          }}
        >
          <StatBlock
            value={String(data.currentStreak)}
            label="Racha actual"
            color={COLOR.accent}
          />
          <StatBlock
            value={`#${data.rank}`}
            label={`de ${data.rankTotal} jugando`}
            color={COLOR.brand}
          />
        </div>

        {/* Footer: nivel (izq) · QR + nombre de la app (der) */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-end",
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
              width={110}
              height={110}
              alt=""
              style={{ borderRadius: 14, backgroundColor: "#ffffff" }}
            />
            <div style={{ fontSize: 26, color: COLOR.muted }}>{APP_HOST}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: LIVE_STATS_CARD_SIZE,
      height: LIVE_STATS_CARD_SIZE,
      // Data viva: sin esto, ImageResponse manda `immutable, max-age=31536000`
      // en producción y la tarjeta quedaría congelada en CDN/navegador.
      headers: {
        "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

/** Datos de muestra (`?preview=1`), compartidos con la página de preview dev. */
export { SAMPLE_LIVE_STATS } from "./samples";
