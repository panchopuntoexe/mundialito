import { describe, expect, it } from "vitest";
import {
  chosenUsernameSchema,
  createUserSchema,
  updateUsernameSchema,
  usernameSchema,
} from "@/lib/validations/user";

describe("usernameSchema", () => {
  it("acepta usernames válidos y los normaliza a minúsculas", () => {
    expect(usernameSchema.parse("Messi10")).toBe("messi10");
    expect(usernameSchema.parse("juan_perez")).toBe("juan_perez");
    expect(usernameSchema.parse("  Pelusa  ")).toBe("pelusa"); // trim + lower
  });

  it("rechaza por longitud (min 3 / max 20)", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(usernameSchema.safeParse("abc").success).toBe(true);
    expect(usernameSchema.safeParse("a".repeat(20)).success).toBe(true);
  });

  it("rechaza caracteres no permitidos (espacios, símbolos, acentos)", () => {
    expect(usernameSchema.safeParse("juan perez").success).toBe(false);
    expect(usernameSchema.safeParse("juan-perez").success).toBe(false);
    expect(usernameSchema.safeParse("juán").success).toBe(false);
    expect(usernameSchema.safeParse("🔥streak").success).toBe(false);
  });

  it("createUserSchema valida la forma del body", () => {
    expect(createUserSchema.safeParse({ username: "valido" }).success).toBe(
      true,
    );
    expect(createUserSchema.safeParse({}).success).toBe(false);
    expect(createUserSchema.safeParse({ username: "x" }).success).toBe(false);
  });
});

describe("chosenUsernameSchema", () => {
  it("reserva el prefijo invitado_ (auto-generados de guest.ts)", () => {
    expect(chosenUsernameSchema.safeParse("invitado_abc123").success).toBe(
      false,
    );
    // El refine corre DESPUÉS del lowercase: "Invitado_x" también cae.
    expect(chosenUsernameSchema.safeParse("Invitado_abc123").success).toBe(
      false,
    );
    expect(chosenUsernameSchema.parse("invitadox")).toBe("invitadox");
    expect(chosenUsernameSchema.parse("Messi10")).toBe("messi10");
  });

  it("createUserSchema y updateUsernameSchema rechazan el prefijo reservado", () => {
    expect(
      createUserSchema.safeParse({ username: "invitado_abc123" }).success,
    ).toBe(false);
    expect(
      updateUsernameSchema.safeParse({ username: "invitado_abc123" }).success,
    ).toBe(false);
    expect(
      updateUsernameSchema.safeParse({ username: "nuevo_nombre" }).success,
    ).toBe(true);
  });
});
