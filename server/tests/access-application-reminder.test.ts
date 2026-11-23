// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { remindWaitingAccessApplications, workingDaysAfter } = await import("../utils/accessApplicationReminder");

function fakeStore(applications: Array<{ id: string; appliedAtIso: string }>) {
  const markers = new Set<string>();
  return {
    markers,
    collection: (name: string) => ({
      where: (field: string, _op: unknown, value: unknown) => ({
        limit: () => ({ get: async () => {
          expect([name, field, value]).toEqual(["robotTeamAccess", "status", "applied"]);
          return { docs: applications.map(row => ({ id: row.id, data: () => ({ status: "applied", appliedAtIso: row.appliedAtIso }) })) };
        } }),
      }),
      doc: (id: string) => ({ create: async () => {
        if (markers.has(id)) throw Object.assign(new Error("exists"), { code: 6 });
        markers.add(id);
      } }),
    }),
  };
}

describe("the owner's reminder when an application waited three working days", () => {
  it("counts working days, Monday to Friday", () => {
    // Friday → Wednesday; Monday → Thursday; Saturday → Wednesday.
    expect(new Date(workingDaysAfter("2026-11-20T10:00:00.000Z", 3)!).toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(new Date(workingDaysAfter("2026-11-23T10:00:00.000Z", 3)!).toISOString()).toBe("2026-11-26T10:00:00.000Z");
    expect(new Date(workingDaysAfter("2026-11-21T10:00:00.000Z", 3)!).toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(workingDaysAfter("not a date", 3)).toBeNull();
  });

  it("reminds once per waited application, through the alert route, with the approvals link and no applicant details", async () => {
    const store = fakeStore([{ id: "a".repeat(64), appliedAtIso: "2026-11-20T10:00:00.000Z" },
      { id: "b".repeat(64), appliedAtIso: "2026-11-24T10:00:00.000Z" }]);
    const alert = vi.fn(async () => ({ sent: true }));
    const now = () => Date.parse("2026-11-25T10:00:00.000Z");
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert })).toEqual({ waiting: 1, reminded: 1 });
    expect(alert).toHaveBeenCalledTimes(1);
    const [, text] = alert.mock.calls[0] as unknown as [string, string];
    expect(text).toContain(`/admin/robot-team-access?application=${"a".repeat(64)}`);
    expect(text).not.toContain("b".repeat(64));
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert })).toEqual({ waiting: 1, reminded: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
