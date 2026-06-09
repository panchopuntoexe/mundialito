import { describe, expect, it } from "vitest";
import {
  advanceStreak,
  daysBetween,
  toTournamentDay,
  type StreakState,
} from "@/lib/scoring/streaks";

/** Estado base: racha viva, freeze ya recargado en group_stage. */
function baseState(over: Partial<StreakState> = {}): StreakState {
  return {
    current_streak: 3,
    max_streak: 5,
    freeze_available: true,
    last_participated_on: "2026-06-10",
    freeze_refilled_round: "group_stage",
    ...over,
  };
}

describe("daysBetween", () => {
  it("cuenta días calendario", () => {
    expect(daysBetween("2026-06-10", "2026-06-11")).toBe(1);
    expect(daysBetween("2026-06-10", "2026-06-12")).toBe(2);
    expect(daysBetween("2026-06-10", "2026-06-10")).toBe(0);
  });
});

describe("toTournamentDay", () => {
  it("usa la TZ del torneo, no UTC", () => {
    // 2026-06-11 02:00 UTC = 2026-06-10 22:00 en America/New_York.
    const instant = new Date("2026-06-11T02:00:00Z");
    expect(toTournamentDay(instant, "America/New_York")).toBe("2026-06-10");
    expect(toTournamentDay(instant, "UTC")).toBe("2026-06-11");
  });
});

describe("advanceStreak", () => {
  const input = {
    today: "2026-06-11",
    macroRound: "group_stage" as const,
    completedToday: true,
  };

  it("primera participación de la historia → racha 1", () => {
    const r = advanceStreak(
      baseState({
        current_streak: 0,
        max_streak: 0,
        last_participated_on: null,
      }),
      input,
    );
    expect(r.current_streak).toBe(1);
    expect(r.max_streak).toBe(1);
    expect(r.last_participated_on).toBe("2026-06-11");
  });

  it("día consecutivo → +1", () => {
    const r = advanceStreak(baseState(), input);
    expect(r.current_streak).toBe(4);
    expect(r.max_streak).toBe(5); // no baja del histórico
    expect(r.last_participated_on).toBe("2026-06-11");
  });

  it("supera el máximo histórico", () => {
    const r = advanceStreak(
      baseState({ current_streak: 5, max_streak: 5 }),
      input,
    );
    expect(r.current_streak).toBe(6);
    expect(r.max_streak).toBe(6);
  });

  it("mismo día → sin cambio (idempotente)", () => {
    const r = advanceStreak(baseState(), { ...input, today: "2026-06-10" });
    expect(r.current_streak).toBe(3);
    expect(r.last_participated_on).toBe("2026-06-10");
  });

  it("salto de día con freeze → se mantiene la racha y se consume el freeze", () => {
    const r = advanceStreak(baseState({ freeze_available: true }), {
      ...input,
      today: "2026-06-12", // gap de 2 días
    });
    expect(r.current_streak).toBe(4);
    expect(r.freeze_available).toBe(false);
  });

  it("salto de día sin freeze → se reinicia a 1", () => {
    const r = advanceStreak(baseState({ freeze_available: false }), {
      ...input,
      today: "2026-06-12",
    });
    expect(r.current_streak).toBe(1);
    expect(r.freeze_available).toBe(false);
  });

  it("no completó el día → la racha no se mueve", () => {
    const r = advanceStreak(baseState(), { ...input, completedToday: false });
    expect(r.current_streak).toBe(3);
    expect(r.last_participated_on).toBe("2026-06-10");
  });

  it("nueva macro-ronda → recarga el freeze una vez", () => {
    // Freeze gastado en group_stage; al entrar a round_32 se recarga y puede
    // cubrir un salto en el límite de fase.
    const r = advanceStreak(
      baseState({
        freeze_available: false,
        freeze_refilled_round: "group_stage",
      }),
      { today: "2026-06-12", macroRound: "round_32", completedToday: true },
    );
    expect(r.freeze_refilled_round).toBe("round_32");
    expect(r.current_streak).toBe(4); // gap de 2 cubierto por el freeze recargado
    expect(r.freeze_available).toBe(false); // recargado y consumido
  });

  it("no depende de aciertos (solo de participación)", () => {
    // El input no tiene noción de 'correcto': misma entrada → mismo resultado.
    const a = advanceStreak(baseState(), input);
    const b = advanceStreak(baseState(), input);
    expect(a).toEqual(b);
  });
});
