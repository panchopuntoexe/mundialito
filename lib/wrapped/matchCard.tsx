/**
 * Renderizador de la mini-tarjeta de resultado de un partido (tarea 7.5).
 *
 * Estilo "cuadritos de Wordle": dos cuadros que resumen el pronóstico del usuario
 * frente al resultado real — Resultado y Goles, verde si acertó, rojo si no — con
 * las banderas de ambos equipos y los puntos ganados arriba a la derecha, estilo
 * "HP" de carta Pokémon. Compartible apenas el cron de resultados (5.5) procesa el
 * partido. Mismas restricciones de Satori que la tarjeta Wrapped (lib/wrapped/card).
 */
import { ImageResponse } from "next/og";
import { APP_HOST } from "@/lib/appUrl";

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
  danger: "#ef4444",
} as const;

export interface MatchResultCardData {
  username: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string | null;
  awayFlag: string | null;
  scoreHome: number;
  scoreAway: number;
  resultCorrect: boolean;
  goalsCorrect: boolean;
  pointsEarned: number;
}

/**
 * La DB guarda banderas de flagcdn en w80 (suficiente para la UI); en la imagen
 * de 1080px se verían pixeladas, así que pedimos la variante w160.
 */
function hiResFlag(url: string): string {
  return url.replace("https://flagcdn.com/w80/", "https://flagcdn.com/w160/");
}

/** Bandera + nombre del equipo, a cada lado del marcador. */
function TeamBlock({ flag, name }: { flag: string | null; name: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 300,
      }}
    >
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hiResFlag(flag)}
          width={156}
          height={104}
          alt=""
          style={{
            borderRadius: 14,
            objectFit: "cover",
            border: `3px solid ${COLOR.border}`,
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: 156,
            height: 104,
            borderRadius: 14,
            backgroundColor: COLOR.surfaceMuted,
            border: `3px solid ${COLOR.border}`,
          }}
        />
      )}
      <div
        style={{
          fontSize: 38,
          fontWeight: 700,
          marginTop: 18,
          textAlign: "center",
        }}
      >
        {name}
      </div>
    </div>
  );
}

/** Un cuadro Wordle con su etiqueta: verde si acertó, rojo si no. */
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
          backgroundColor: correct ? COLOR.brand : COLOR.danger,
          border: `4px solid ${correct ? COLOR.brand : COLOR.danger}`,
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

export async function renderMatchResultImage(
  data: MatchResultCardData,
): Promise<ImageResponse> {
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
            <div style={{ fontSize: 44, fontWeight: 800 }}>Mi resultado</div>
            <div style={{ fontSize: 36, color: COLOR.muted, marginTop: 6 }}>
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
                fontSize: 36,
                fontWeight: 700,
                color: COLOR.muted,
                letterSpacing: 2,
                marginRight: 12,
                marginBottom: 16,
              }}
            >
              PTS
            </div>
            <div style={{ fontSize: 96, fontWeight: 800, color: COLOR.brand }}>
              {`+${data.pointsEarned}`}
            </div>
          </div>
        </div>

        {/* Banderas + marcador */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            marginTop: 64,
          }}
        >
          <TeamBlock flag={data.homeFlag} name={data.homeTeam} />
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: COLOR.foreground,
              marginBottom: 56,
            }}
          >
            {`${data.scoreHome} - ${data.scoreAway}`}
          </div>
          <TeamBlock flag={data.awayFlag} name={data.awayTeam} />
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
          <Square correct={data.goalsCorrect} label="Marcador" />
        </div>

        {/* Footer: branding + URL de la app (igual que la tarjeta Wrapped) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            marginTop: "auto",
          }}
        >
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
          <div style={{ fontSize: 28, color: COLOR.muted }}>{APP_HOST}</div>
        </div>
      </div>
    ),
    { width: MATCH_CARD_SIZE, height: MATCH_CARD_SIZE },
  );
}

/** Datos de muestra (`?preview=1`), compartidos con la página de preview dev. */
export { SAMPLE_MATCH_RESULT } from "./samples";
