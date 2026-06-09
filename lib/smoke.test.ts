import { describe, expect, it } from "vitest";

// Test dummy: confirma que el runner de Vitest está cableado (tarea 0.4).
describe("smoke", () => {
  it("el entorno de tests corre", () => {
    expect(1 + 1).toBe(2);
  });
});
