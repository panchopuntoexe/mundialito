import { describe, expect, it } from "vitest";
import { levelForPoints, nextLevel, levelByKey } from "@/lib/scoring/levels";

describe("levelForPoints", () => {
  it("arranca en Suplente desde 0", () => {
    expect(levelForPoints(0).key).toBe("suplente");
    expect(levelForPoints(11).key).toBe("suplente");
  });

  it("recorre la escalera de 12 niveles por sus cotas", () => {
    expect(levelForPoints(12).key).toBe("promesa");
    expect(levelForPoints(25).key).toBe("titular");
    expect(levelForPoints(37).key).toBe("goleador");
    expect(levelForPoints(50).key).toBe("crack");
    expect(levelForPoints(75).key).toBe("figura");
    expect(levelForPoints(100).key).toBe("leyenda");
    expect(levelForPoints(125).key).toBe("capitan");
    expect(levelForPoints(150).key).toBe("campeon");
    expect(levelForPoints(175).key).toBe("idolo");
    expect(levelForPoints(200).key).toBe("cesped");
    expect(levelForPoints(300).key).toBe("inmortal");
  });

  it("se mantiene en el nivel mientras no cruza la siguiente cota", () => {
    expect(levelForPoints(49).key).toBe("goleador");
    expect(levelForPoints(149).key).toBe("capitan");
    expect(levelForPoints(199).key).toBe("idolo");
    expect(levelForPoints(5000).key).toBe("inmortal");
  });
});

describe("nextLevel", () => {
  it("devuelve el siguiente nivel por alcanzar", () => {
    expect(nextLevel(0)?.key).toBe("promesa");
    expect(nextLevel(24)?.key).toBe("titular");
    expect(nextLevel(50)?.key).toBe("figura");
    expect(nextLevel(99)?.key).toBe("leyenda");
    expect(nextLevel(150)?.key).toBe("idolo");
    expect(nextLevel(199)?.key).toBe("cesped");
  });

  it("devuelve null en el nivel máximo", () => {
    expect(nextLevel(300)).toBeNull();
    expect(nextLevel(5000)).toBeNull();
  });
});

describe("levelByKey", () => {
  it("resuelve por key y cae a Suplente si no existe", () => {
    expect(levelByKey("crack").name).toBe("Crack");
    expect(levelByKey("inmortal").name).toBe("Inmortal");
    // @ts-expect-error key inválida a propósito
    expect(levelByKey("inexistente").key).toBe("suplente");
  });
});
