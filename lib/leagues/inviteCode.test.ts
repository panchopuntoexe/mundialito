import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
} from "@/lib/leagues/inviteCode";

describe("generateInviteCode", () => {
  it("tiene la longitud fija y solo usa el alfabeto no ambiguo", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    for (const ch of code) {
      expect(INVITE_CODE_ALPHABET).toContain(ch);
    }
  });

  it("nunca incluye caracteres ambiguos (0, O, 1, I, L)", () => {
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("es determinista con un RNG inyectado", () => {
    // Todos los bytes = 0 → primer caracter del alfabeto repetido.
    const allZeros = generateInviteCode((out) => out.fill(0));
    expect(allZeros).toBe(INVITE_CODE_ALPHABET[0].repeat(INVITE_CODE_LENGTH));

    // Byte = índice → mapea a esa posición del alfabeto (módulo).
    const mapped = generateInviteCode((out) => {
      for (let i = 0; i < out.length; i++) out[i] = i;
    });
    expect(mapped).toBe(
      Array.from({ length: INVITE_CODE_LENGTH }, (_, i) =>
        INVITE_CODE_ALPHABET[i % INVITE_CODE_ALPHABET.length],
      ).join(""),
    );
  });
});
