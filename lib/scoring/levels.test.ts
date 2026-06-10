import { describe, expect, it } from "vitest";
import { levelForPoints, nextLevel, levelByKey } from "@/lib/scoring/levels";

describe("levelForPoints", () => {
  it("arranca en Suplente desde 0", () => {
    expect(levelForPoints(0).key).toBe("suplente");
    expect(levelForPoints(99).key).toBe("suplente");
  });

  it("Titular a partir de 100", () => {
    expect(levelForPoints(100).key).toBe("titular");
    expect(levelForPoints(299).key).toBe("titular");
  });

  it("Crack a partir de 300", () => {
    expect(levelForPoints(300).key).toBe("crack");
    expect(levelForPoints(699).key).toBe("crack");
  });

  it("Leyenda a partir de 700 (y se mantiene en el máximo)", () => {
    expect(levelForPoints(700).key).toBe("leyenda");
    expect(levelForPoints(99999).key).toBe("leyenda");
  });
});

describe("nextLevel", () => {
  it("devuelve el siguiente nivel por alcanzar", () => {
    expect(nextLevel(0)?.key).toBe("titular");
    expect(nextLevel(150)?.key).toBe("crack");
    expect(nextLevel(699)?.key).toBe("leyenda");
  });

  it("devuelve null en el nivel máximo", () => {
    expect(nextLevel(700)).toBeNull();
    expect(nextLevel(5000)).toBeNull();
  });
});

describe("levelByKey", () => {
  it("resuelve por key y cae a Suplente si no existe", () => {
    expect(levelByKey("crack").name).toBe("Crack");
    // @ts-expect-error key inválida a propósito
    expect(levelByKey("inexistente").key).toBe("suplente");
  });
});
