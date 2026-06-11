import { describe, expect, it, vi } from "vitest";
import {
  createGuestProfileWith,
  generateGuestUsername,
  GUEST_PREFIX,
  type GuestProfileInserter,
} from "@/lib/users/guest";
import { usernameSchema } from "@/lib/validations/user";

describe("generateGuestUsername", () => {
  it("genera invitado_ + 6 chars [a-z0-9]", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(generateGuestUsername()).toMatch(/^invitado_[a-z0-9]{6}$/);
    }
  });

  it("es válido contra usernameSchema (3-20, charset, lowercase)", () => {
    const username = generateGuestUsername();
    const parsed = usernameSchema.safeParse(username);
    expect(parsed.success).toBe(true);
    expect(username.startsWith(GUEST_PREFIX)).toBe(true);
    expect(username.length).toBeLessThanOrEqual(20);
  });

  it("casi nunca colisiona (unicidad probabilística)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      seen.add(generateGuestUsername());
    }
    // 36^6 combinaciones: 1.000 muestras deberían ser (casi) todas distintas.
    expect(seen.size).toBeGreaterThanOrEqual(999);
  });
});

describe("createGuestProfileWith", () => {
  const USER_ID = "00000000-0000-0000-0000-000000000001";

  it("inserta a la primera y devuelve el username", async () => {
    const insertProfile = vi.fn().mockResolvedValue(null);
    const inserter: GuestProfileInserter = { insertProfile };

    const username = await createGuestProfileWith(inserter, USER_ID);

    expect(username).toMatch(/^invitado_[a-z0-9]{6}$/);
    expect(insertProfile).toHaveBeenCalledTimes(1);
    expect(insertProfile).toHaveBeenCalledWith({ id: USER_ID, username });
  });

  it("reintenta con otro username ante colisión 23505", async () => {
    const insertProfile = vi
      .fn()
      .mockResolvedValueOnce({ code: "23505", message: "duplicate key" })
      .mockResolvedValueOnce(null);
    const inserter: GuestProfileInserter = { insertProfile };

    const username = await createGuestProfileWith(inserter, USER_ID);

    expect(username).toMatch(/^invitado_[a-z0-9]{6}$/);
    expect(insertProfile).toHaveBeenCalledTimes(2);
    const [first, second] = insertProfile.mock.calls.map(
      (call) => (call[0] as { username: string }).username,
    );
    expect(first).not.toBe(second);
  });

  it("devuelve null tras agotar los intentos por colisiones", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const insertProfile = vi
      .fn()
      .mockResolvedValue({ code: "23505", message: "duplicate key" });
    const inserter: GuestProfileInserter = { insertProfile };

    const username = await createGuestProfileWith(inserter, USER_ID, 3);

    expect(username).toBeNull();
    expect(insertProfile).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });

  it("devuelve null sin reintentar ante un error no recuperable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const insertProfile = vi
      .fn()
      .mockResolvedValue({ code: "23503", message: "fk violation" });
    const inserter: GuestProfileInserter = { insertProfile };

    const username = await createGuestProfileWith(inserter, USER_ID);

    expect(username).toBeNull();
    expect(insertProfile).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
