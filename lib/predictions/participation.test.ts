import { describe, expect, it } from "vitest";
import { isParticipationComplete } from "@/lib/predictions/participation";

// "Ahora" fijo para todos los casos.
const NOW = new Date("2026-06-11T16:00:00Z");

/** Partido con kickoff relativo a NOW (en horas; negativo = ya arrancó). */
function match(id: number, hoursFromNow: number) {
  return {
    id,
    kickoff_at: new Date(NOW.getTime() + hoursFromNow * 3_600_000).toISOString(),
  };
}

describe("isParticipationComplete", () => {
  it("true cuando todos los partidos abiertos están pronosticados", () => {
    const todaysMatches = [match(1, 2), match(2, 5)];
    expect(
      isParticipationComplete({
        todaysMatches,
        predictedMatchIds: [1, 2],
        now: NOW,
      }),
    ).toBe(true);
  });

  it("false cuando falta pronosticar un partido abierto", () => {
    const todaysMatches = [match(1, 2), match(2, 5)];
    expect(
      isParticipationComplete({
        todaysMatches,
        predictedMatchIds: [1],
        now: NOW,
      }),
    ).toBe(false);
  });

  it("ignora los partidos ya cerrados (alcanzable para quien llega tarde)", () => {
    // El partido 1 ya arrancó; solo el 2 sigue abierto y está pronosticado.
    const todaysMatches = [match(1, -1), match(2, 3)];
    expect(
      isParticipationComplete({
        todaysMatches,
        predictedMatchIds: [2],
        now: NOW,
      }),
    ).toBe(true);
  });

  it("false si no queda ningún partido abierto (nada que completar)", () => {
    const todaysMatches = [match(1, -2), match(2, -1)];
    expect(
      isParticipationComplete({
        todaysMatches,
        predictedMatchIds: [1, 2],
        now: NOW,
      }),
    ).toBe(false);
  });

  it("false sin partidos en el día", () => {
    expect(
      isParticipationComplete({
        todaysMatches: [],
        predictedMatchIds: [],
        now: NOW,
      }),
    ).toBe(false);
  });

  it("pronósticos de más (de partidos ya cerrados) no afectan", () => {
    const todaysMatches = [match(1, -1), match(2, 3)];
    expect(
      isParticipationComplete({
        todaysMatches,
        predictedMatchIds: [1, 2],
        now: NOW,
      }),
    ).toBe(true);
  });
});
