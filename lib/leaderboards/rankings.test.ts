import { describe, expect, it } from "vitest";
import { assignRanks, type RankedUser } from "@/lib/leaderboards/rankings";

function user(id: string, points: number): RankedUser {
  return {
    user_id: id,
    username: id,
    display_name: null,
    avatar_url: null,
    total_points: points,
  };
}

describe("assignRanks", () => {
  it("asigna posiciones 1..N sin empates", () => {
    const ranked = assignRanks([user("a", 30), user("b", 20), user("c", 10)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("empates comparten posición y la siguiente salta (1,2,2,4)", () => {
    const ranked = assignRanks([
      user("a", 30),
      user("b", 20),
      user("c", 20),
      user("d", 10),
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("todos empatados → todos en la posición 1", () => {
    const ranked = assignRanks([user("a", 5), user("b", 5), user("c", 5)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("preserva los datos del usuario y devuelve lista vacía si no hay usuarios", () => {
    expect(assignRanks([])).toEqual([]);
    const [entry] = assignRanks([user("a", 0)]);
    expect(entry).toMatchObject({ user_id: "a", total_points: 0, rank: 1 });
  });
});
