import { describe, expect, it } from "vitest";
import { liveRank } from "@/lib/leaderboards/rank";

describe("liveRank", () => {
  it("el primero del ranking: nadie por encima → #1", () => {
    expect(liveRank({ higherCount: 0, positiveCount: 230, points: 145 })).toEqual(
      { rank: 1, total: 230 },
    );
  });

  it("usuario del medio: rank = usuarios por encima + 1", () => {
    expect(liveRank({ higherCount: 13, positiveCount: 230, points: 80 })).toEqual(
      { rank: 14, total: 230 },
    );
  });

  it("empates comparten posición (mismo higherCount → mismo rank)", () => {
    // Dos usuarios con los mismos puntos tienen idéntico `higherCount`, igual
    // que el standard competition ranking de assignRanks (1, 2, 2, 4).
    const a = liveRank({ higherCount: 1, positiveCount: 4, points: 20 });
    const b = liveRank({ higherCount: 1, positiveCount: 4, points: 20 });
    expect(a.rank).toBe(2);
    expect(b.rank).toBe(2);
  });

  it("usuario con 0 puntos: queda fuera del universo → total = rank", () => {
    expect(liveRank({ higherCount: 230, positiveCount: 230, points: 0 })).toEqual(
      { rank: 231, total: 231 },
    );
  });

  it("torneo recién arrancado: nadie con puntos → #1 de 1", () => {
    expect(liveRank({ higherCount: 0, positiveCount: 0, points: 0 })).toEqual({
      rank: 1,
      total: 1,
    });
  });
});
