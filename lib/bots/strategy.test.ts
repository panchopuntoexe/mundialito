import { describe, expect, it } from "vitest";
import { fnv1a, mulberry32, personaFor } from "@/lib/bots/persona";
import {
  decidePrediction,
  predictAtFor,
  type BotMatch,
} from "@/lib/bots/strategy";
import { GOALS_RANGES } from "@/types/domain";

/** Ids sintéticos con forma de UUID-ish: solo importa que sean estables. */
const botIds = Array.from({ length: 50 }, (_, i) => `bot-${i}-fake-uuid`);

const groupMatch: BotMatch = {
  id: 1,
  home_team: "Mexico",
  away_team: "South Africa",
  macro_round: "group_stage",
  kickoff_at: "2026-06-11T19:00:00+00:00",
};

const knockoutMatch: BotMatch = {
  id: 80,
  home_team: "Winner Group A",
  away_team: "Runner-up Group B",
  macro_round: "round_32",
  kickoff_at: "2026-06-29T19:00:00+00:00",
};

function manyGroupMatches(count: number): BotMatch[] {
  return Array.from({ length: count }, (_, i) => ({
    ...groupMatch,
    id: i + 1,
  }));
}

describe("fnv1a / mulberry32", () => {
  it("hash estable y distinto por entrada", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
  });

  it("PRNG determinista en [0, 1)", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("personaFor", () => {
  it("determinista y dentro de rangos, con skill sesgado mediocre", () => {
    let skillSum = 0;
    for (const id of botIds) {
      const p = personaFor(id);
      expect(p).toEqual(personaFor(id));
      expect(p.skill).toBeGreaterThanOrEqual(0.2);
      expect(p.skill).toBeLessThanOrEqual(0.55);
      expect(p.drawAffinity).toBeGreaterThanOrEqual(0.4);
      expect(p.drawAffinity).toBeLessThanOrEqual(1.6);
      expect(p.earliness).toBeGreaterThanOrEqual(0);
      expect(p.earliness).toBeLessThanOrEqual(1);
      skillSum += p.skill;
    }
    // Sesgo mediocre: el promedio queda por debajo del punto medio del rango.
    expect(skillSum / botIds.length).toBeLessThan(0.4);
  });
});

describe("decidePrediction", () => {
  it("determinista: mismo (bot, partido) → mismo pick", () => {
    for (const id of botIds.slice(0, 10)) {
      expect(decidePrediction(id, groupMatch)).toEqual(
        decidePrediction(id, groupMatch),
      );
    }
  });

  it("nunca empate en knockout", () => {
    for (const id of botIds) {
      for (const match of manyGroupMatches(40)) {
        const pick = decidePrediction(id, { ...match, macro_round: "round_16" });
        expect(pick.result_pred).not.toBe("draw");
      }
    }
    expect(decidePrediction(botIds[0], knockoutMatch).result_pred).not.toBe(
      "draw",
    );
  });

  it("en grupos los tres resultados aparecen, con el empate minoritario", () => {
    const counts = { home: 0, draw: 0, away: 0 };
    const matches = manyGroupMatches(200);
    for (const id of botIds) {
      for (const match of matches) {
        counts[decidePrediction(id, match).result_pred]++;
      }
    }
    const total = botIds.length * matches.length;
    expect(counts.home / total).toBeGreaterThan(0.25);
    expect(counts.away / total).toBeGreaterThan(0.2);
    expect(counts.draw / total).toBeGreaterThan(0.05);
    expect(counts.draw / total).toBeLessThan(0.4);
  });

  it("favoritismo: con tier dispar el favorito recibe más picks", () => {
    const lopsided: BotMatch = {
      ...groupMatch,
      home_team: "Argentina", // tier 1
      away_team: "Curaçao", // tier 3
    };
    const counts = { home: 0, draw: 0, away: 0 };
    for (const id of botIds) {
      for (const match of manyGroupMatches(100)) {
        counts[decidePrediction(id, { ...lopsided, id: match.id }).result_pred]++;
      }
    }
    expect(counts.home).toBeGreaterThan(counts.away);
  });

  it("los cuatro rangos de goles aparecen y 2-3 es el más común", () => {
    const counts = new Map<string, number>(GOALS_RANGES.map((r) => [r, 0]));
    for (const id of botIds) {
      for (const match of manyGroupMatches(200)) {
        const pick = decidePrediction(id, match);
        counts.set(
          pick.goals_range_pred,
          (counts.get(pick.goals_range_pred) ?? 0) + 1,
        );
      }
    }
    for (const range of GOALS_RANGES) {
      expect(counts.get(range)).toBeGreaterThan(0);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe("2-3");
  });
});

describe("predictAtFor", () => {
  it("determinista, siempre ≥10 min y ≤36 h antes del kickoff", () => {
    const kickoff = new Date(groupMatch.kickoff_at).getTime();
    for (const id of botIds) {
      for (const match of manyGroupMatches(50)) {
        const at = predictAtFor(id, match);
        expect(at).toEqual(predictAtFor(id, match));
        const offset = kickoff - at.getTime();
        expect(offset).toBeGreaterThanOrEqual(10 * 60 * 1000);
        expect(offset).toBeLessThanOrEqual(36 * 60 * 60 * 1000);
      }
    }
  });

  it("dispersa a los bots: no pronostican todos en la misma ventana de 5 min", () => {
    const buckets = new Set<number>();
    for (const id of botIds) {
      const at = predictAtFor(id, groupMatch);
      buckets.add(Math.floor(at.getTime() / (5 * 60 * 1000)));
    }
    // 50 bots repartidos en bastante más que un puñado de ventanas de cron.
    expect(buckets.size).toBeGreaterThan(20);
  });
});
