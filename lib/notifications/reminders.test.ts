import { describe, expect, it } from "vitest";
import { buildReminderPlan, reminderPayload } from "./reminders";

// Kickoffs en UTC; el día del torneo se evalúa en America/New_York (UTC-4 en junio).
const MATCHES = [
  { id: 1, kickoff_at: "2026-06-12T16:00:00.000Z" }, // 12-jun 12:00 NY
  { id: 2, kickoff_at: "2026-06-13T02:00:00.000Z" }, // 12-jun 22:00 NY (cruza medianoche UTC)
];

describe("buildReminderPlan", () => {
  it("sin partidos o sin usuarios suscritos → plan vacío", () => {
    expect(
      buildReminderPlan({ matches: [], predictions: [], userIds: ["u1"] }),
    ).toEqual([]);
    expect(
      buildReminderPlan({ matches: MATCHES, predictions: [], userIds: [] }),
    ).toEqual([]);
  });

  it("excluye al usuario que ya pronosticó todos los partidos de la ventana", () => {
    const plan = buildReminderPlan({
      matches: MATCHES,
      predictions: [
        { user_id: "u1", match_id: 1 },
        { user_id: "u1", match_id: 2 },
      ],
      userIds: ["u1"],
    });
    expect(plan).toEqual([]);
  });

  it("cuenta solo los partidos faltantes de cada usuario", () => {
    const plan = buildReminderPlan({
      matches: MATCHES,
      predictions: [{ user_id: "u1", match_id: 1 }],
      userIds: ["u1", "u2"],
    });
    expect(plan).toEqual([
      { userId: "u1", missing: 1, dedupeKey: "2026-06-12" },
      { userId: "u2", missing: 2, dedupeKey: "2026-06-12" },
    ]);
  });

  it("el dedupeKey es el día del torneo del primer partido FALTANTE", () => {
    // u1 ya pronosticó el de las 16:00Z; su primer faltante es el de las 02:00Z
    // del 13 en UTC, que en TZ del torneo sigue siendo 12-jun → mismo día, un
    // solo aviso aunque el partido cruce la medianoche UTC.
    const [candidate] = buildReminderPlan({
      matches: MATCHES,
      predictions: [{ user_id: "u1", match_id: 1 }],
      userIds: ["u1"],
    });
    expect(candidate.dedupeKey).toBe("2026-06-12");
  });
});

describe("reminderPayload", () => {
  it("singular con 1 faltante", () => {
    const payload = reminderPayload(1);
    expect(payload.body).toContain("1 partido sin pronosticar");
    expect(payload.tag).toBe("prediction-reminder");
  });

  it("plural con varios faltantes", () => {
    expect(reminderPayload(3).body).toContain("3 partidos sin pronosticar");
  });
});
