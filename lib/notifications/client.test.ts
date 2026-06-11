import { describe, expect, it } from "vitest";
import { isValidVapidPublicKey } from "@/lib/notifications/client";

describe("isValidVapidPublicKey", () => {
  it("acepta una clave P-256 válida (65 bytes, prefijo 0x04)", () => {
    expect(
      isValidVapidPublicKey(
        "BF7Aj8Tudcz2RXQjHzS54bFYb-khKbCaeHw6lc1YgAKUMuZ6wdL3kUVh5HICg2fygIsV3dyWf9fYImUa0J4vD54",
      ),
    ).toBe(true);
  });

  it("rechaza vacío, basura o clave privada mal usada como pública", () => {
    expect(isValidVapidPublicKey("")).toBe(false);
    expect(isValidVapidPublicKey("not-a-key")).toBe(false);
    expect(isValidVapidPublicKey("  ")).toBe(false);
  });
});
