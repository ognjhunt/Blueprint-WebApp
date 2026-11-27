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
        orderBy: (order: string) => ({ limit: (n: number) => {
          const page = (after: string | null) => ({
            startAfter: (id: string) => page(id),
            get: async () => {
              expect([name, field, value, order]).toEqual(["robotTeamAccess", "status", "applied", "__name__"]);
              const sorted = [...applications].sort((x, y) => x.id.localeCompare(y.id)).filter(row => !after || row.id > after);
              return { docs: sorted.slice(0, n).map(row => ({ id: row.id, data: () => ({ status: "applied", appliedAtIso: row.appliedAtIso }) })) };
            },
          });
          return page(null);
        } }),
      }),
      doc: (id: string) => ({
        create: async () => {
          if (markers.has(id)) throw Object.assign(new Error("exists"), { code: 6 });
          markers.add(id);
        },
        delete: async () => { markers.delete(id); },
      }),
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
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert })).toEqual({ waiting: 1, reminded: 1, emailed: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
    const [, text] = alert.mock.calls[0] as unknown as [string, string];
    expect(text).toContain(`/admin/robot-team-access?application=${"a".repeat(64)}`);
    expect(text).not.toContain("b".repeat(64));
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert })).toEqual({ waiting: 1, reminded: 0, emailed: 0 });
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("reaches applications past the first page of 200", async () => {
    const rows = Array.from({ length: 205 }, (_, i) => ({ id: `app${String(i).padStart(4, "0")}`, appliedAtIso: "2026-11-20T10:00:00.000Z" }));
    const store = fakeStore(rows);
    const alert = vi.fn(async () => ({ sent: true }));
    const now = () => Date.parse("2026-11-25T10:00:00.000Z");
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert })).toEqual({ waiting: 205, reminded: 205, emailed: 0 });
    expect(store.markers.has("app0204")).toBe(true);
  });

  it("keeps the reminder for the next pass when the alert is not delivered", async () => {
    const store = fakeStore([{ id: "a".repeat(64), appliedAtIso: "2026-11-20T10:00:00.000Z" }]);
    const now = () => Date.parse("2026-11-25T10:00:00.000Z");
    const failed = vi.fn(async () => ({ sent: false }));
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert: failed })).toEqual({ waiting: 1, reminded: 0, emailed: 0 });
    expect(store.markers.size).toBe(0);
    const thrown = vi.fn(async () => { throw new Error("slack down"); });
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert: thrown })).toEqual({ waiting: 1, reminded: 0, emailed: 0 });
    const ok = vi.fn(async () => ({ sent: true }));
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert: ok })).toEqual({ waiting: 1, reminded: 1, emailed: 0 });
    expect(ok).toHaveBeenCalledTimes(1);
  });

  // Outreach gap 1 (2026-11-27): the owner's email is a second channel; either one taking the reminder keeps its marker.
  it("keeps the marker when Slack fails but the owner's email was queued, and releases only what neither channel took", async () => {
    const store = fakeStore([{ id: "a".repeat(64), appliedAtIso: "2026-11-20T10:00:00.000Z" },
      { id: "c".repeat(64), appliedAtIso: "2026-11-20T10:00:00.000Z" }]);
    const now = () => Date.parse("2026-11-25T10:00:00.000Z");
    const failed = vi.fn(async () => ({ sent: false }));
    const email = vi.fn(async (id: string) => (id.startsWith("a") ? "queued" as const : "not_queued" as const));
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert: failed, email }))
      .toEqual({ waiting: 2, reminded: 1, emailed: 1 });
    expect([...store.markers]).toEqual(["a".repeat(64)]);
    expect(email).toHaveBeenCalledTimes(2);
    // The next pass asks again only for the one neither channel took.
    const queued = vi.fn(async () => "queued" as const);
    expect(await remindWaitingAccessApplications({ store: store as never, now, alert: failed, email: queued }))
      .toEqual({ waiting: 2, reminded: 1, emailed: 1 });
    expect(queued).toHaveBeenCalledWith("c".repeat(64));
    expect(queued).toHaveBeenCalledTimes(1);
  });
});
