import { describe, expect, it } from "vitest";
import { errorFingerprint, normalizeError } from "@/lib/alerts/fingerprint";

describe("normalizeError", () => {
  it("quita dígitos, UUIDs y espacios variables", () => {
    expect(
      normalizeError(new Error("error actualizando match 123")),
    ).toBe(normalizeError(new Error("error  actualizando match 456")));
    expect(
      normalizeError(
        new Error("usuario 0c446e47-24af-46f6-be2a-e0a1142f5347 falló"),
      ),
    ).toBe(
      normalizeError(
        new Error("usuario d836dd02-aa28-4b14-b08b-23b8c780eb4b falló"),
      ),
    );
  });

  it("distingue errores realmente distintos", () => {
    expect(normalizeError(new Error("timeout de API-Football"))).not.toBe(
      normalizeError(new Error("falló el upsert de matches")),
    );
  });

  it("tolera no-Errors sin lanzar", () => {
    expect(normalizeError("texto plano")).toContain("texto plano");
    expect(normalizeError(null)).toContain("sin mensaje");
    expect(normalizeError(undefined)).toContain("sin mensaje");
    expect(normalizeError(42)).toContain("<n>");
  });
});

describe("errorFingerprint", () => {
  it("misma huella para errores equivalentes, distinta para distintos", () => {
    const a = errorFingerprint(new Error("error en match 7"));
    const b = errorFingerprint(new Error("error en match 99"));
    const c = errorFingerprint(new Error("redis caído"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });
});
