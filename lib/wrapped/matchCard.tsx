/**
 * Renderizador de la mini-tarjeta de resultado de un partido (tarea 7.5).
 *
 * Estilo "cuadritos de Wordle": dos cuadros que resumen el pronóstico del usuario
 * frente al resultado real — Resultado y Goles, verde si acertó, gris si no — más
 * los puntos ganados. Compartible apenas el cron de resultados (5.5) procesa el
 * partido. Mismas restricciones de Satori que la tarjeta Wrapped (lib/wrapped/card).
 */
import { ImageResponse } from "next/og";

/** Cuadrada 1:1, cómoda para feed/stories y previews de chat. */
export const MATCH_CARD_SIZE = 1080;

const COLOR = {
  background: "#0a0a0b",
  surface: "#161618",
  surfaceMuted: "#1f1f23",
  border: "#2a2a2f",
  foreground: "#ededed",
  muted: "#a1a1aa",
  brand: "#22c55e",
  accent: "#f59e0b",
} as const;

export interface MatchResultCardData {
  username: string;
  homeTeam: string;
  awayTeam: string;
  scoreHome: number;
  scoreAway: number;
  resultCorrect: boolean;
  goalsCorrect: boolean;
  pointsEarned: number;
}

/** Un cuadro Wordle con su etiqueta: verde si acertó, gris si no. */
function Square({ correct, label }: { correct: boolean; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 200,
          height: 200,
          borderRadius: 28,
          backgroundColor: correct ? COLOR.brand : COLOR.surfaceMuted,
          border: `4px solid ${correct ? COLOR.brand : COLOR.border}`,
        }}
      />
      <div
        style={{
          fontSize: 34,
          color: COLOR.muted,
          marginTop: 18,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function renderMatchResultImage(data: MatchResultCardData): ImageResponse {
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
        {/* Header */}
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
          <div style={{ fontSize: 36, color: COLOR.muted, marginTop: 6 }}>
            {`@${data.username}`}
          </div>
        </div>

        {/* Partido + marcador */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 56,
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700, textAlign: "center" }}>
            {`${data.homeTeam} vs ${data.awayTeam}`}
          </div>
          <div
            style={{
              fontSize: 130,
              fontWeight: 800,
              color: COLOR.foreground,
              marginTop: 8,
            }}
          >
            {`${data.scoreHome} - ${data.scoreAway}`}
          </div>
        </div>

        {/* Cuadritos Wordle */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            gap: 56,
            marginTop: 56,
          }}
        >
          <Square correct={data.resultCorrect} label="Resultado" />
          <Square correct={data.goalsCorrect} label="Goles" />
        </div>

        {/* Puntos + footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
          }}
        >
          <div style={{ fontSize: 84, fontWeight: 800, color: COLOR.brand }}>
            {`+${data.pointsEarned} pts`}
          </div>
          <div style={{ fontSize: 28, color: COLOR.muted, marginTop: 8 }}>
            mundialito26-six.vercel.app
          </div>
        </div>
      </div>
    ),
    { width: MATCH_CARD_SIZE, height: MATCH_CARD_SIZE },
  );
}

/** Datos de muestra (`?preview=1`), compartidos con la página de preview dev. */
export { SAMPLE_MATCH_RESULT } from "./samples";
