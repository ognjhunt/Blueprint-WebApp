// @vitest-environment node
/**
 * An account deletion request is told to the owner at 25 days and at 30, once each (outreach playbook fix 11).
 *
 * The Privacy Policy promises completion within 30 calendar days (`client/src/pages/Privacy.tsx:119`). The scan runs in
 * the beta ops monitor, sends on the existing ops alert route (Slack and one ops email), never names the account, and
 * never changes the request.
 *
 * OFFLINE: the real scan against the fake Firestore; Slack and email are fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { scanAgingAccountDeletionRequests, accountDeletionAgeLevel, __resetAccountDeletionAgeAlertsForTests } =
  await import("../utils/accountDeletionAgeAlerts");

const NOW = Date.parse("2026-11-27T02:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const UID = "uid-planted-123";
const EMAIL = "person@planted.example";

function request(id: string, ageDays: number, status = "requested") {
  const at = new Date(NOW - ageDays * DAY).toISOString();
  state.docs.set(`accountDeletionRequests/${id}`, { schemaVersion: "account_deletion_request.v1", id, accountUid: UID,
    accountEmail: EMAIL, status, requestedAtIso: at, updatedAtIso: at, reviewerUid: null, message: "x" } as never);
}

const delivered = () => ({ sent: true });
let alert: ReturnType<typeof vi.fn>; let email: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.docs.clear();
  __resetAccountDeletionAgeAlertsForTests();
  alert = vi.fn(async () => delivered()); email = vi.fn(async () => delivered());
});
afterEach(() => { vi.restoreAllMocks(); });

const scan = (nowMs = NOW) => scanAgingAccountDeletionRequests({ now: () => nowMs, alert: alert as never, email: email as never });

describe("the age of a request", () => {
  it("is owed nothing before 25 days, a warning from 25, and overdue from 30", () => {
    const at = (days: number) => new Date(NOW - days * DAY).toISOString();
    expect(accountDeletionAgeLevel(at(24.9), NOW)).toBeNull();
    expect(accountDeletionAgeLevel(at(25), NOW)).toEqual({ level: "warning", ageDays: 25 });
    expect(accountDeletionAgeLevel(at(29.9), NOW)).toEqual({ level: "warning", ageDays: 29 });
    expect(accountDeletionAgeLevel(at(30), NOW)).toEqual({ level: "overdue", ageDays: 30 });
    expect(accountDeletionAgeLevel("not a date", NOW)).toBeNull();
  });
});

describe("the owner's notice", () => {
  it("tells the 37-day request once as overdue, by Slack and email, naming neither the uid nor the email", async () => {
    request("deletion_old", 37);
    request("deletion_new", 3);
    const before = JSON.stringify(state.docs.get("accountDeletionRequests/deletion_old"));
    expect(await scan()).toEqual({ warning: 0, overdue: 1, newlyAlerted: 1 });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledTimes(1);
    const text = String(alert.mock.calls[0][1]);
    expect(text).toContain("1 account deletion request is past the 30 days the Privacy Policy promises");
    expect(text).toContain("- deletion_old: requested, 37 days since it was made");
    expect(text).toContain("/admin/jobs");
    expect(text).not.toContain("deletion_new");
    const mail = email.mock.calls[0][0] as { to: string; subject: string; text: string };
    expect(mail.to).toBe("ops@tryblueprint.io");
    expect(mail.subject).toMatch(/^\[ALERT\] /);
    for (const planted of [UID, EMAIL]) { expect(text).not.toContain(planted); expect(mail.text).not.toContain(planted); }
    // A notice, not an action: the request is untouched.
    expect(JSON.stringify(state.docs.get("accountDeletionRequests/deletion_old"))).toBe(before);
    // Once: the next passes send nothing, in this process or a new one.
    expect((await scan(NOW + 10 * 60 * 1000)).newlyAlerted).toBe(0);
    __resetAccountDeletionAgeAlertsForTests();
    expect((await scan(NOW + 20 * 60 * 1000)).newlyAlerted).toBe(0);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("warns at 25 days, then says overdue at 30, once each, whatever the request's status", async () => {
    request("deletion_a", 25, "in_review");
    expect(await scan()).toEqual({ warning: 1, overdue: 0, newlyAlerted: 1 });
    expect(String(alert.mock.calls[0][1])).toContain("1 account deletion request reaches the 30-day promise within 5 days");
    expect((email.mock.calls[0][0] as { subject: string }).subject).toMatch(/^\[NOTICE\] /);
    expect((await scan(NOW + 2 * DAY)).newlyAlerted).toBe(0);
    expect(await scan(NOW + 5 * DAY)).toEqual({ warning: 0, overdue: 1, newlyAlerted: 1 });
    expect(String(alert.mock.calls[1][1])).toContain("- deletion_a: in_review, 30 days since it was made");
    expect((await scan(NOW + 6 * DAY)).newlyAlerted).toBe(0);
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it("sends again on the next pass when neither Slack nor the email took it", async () => {
    request("deletion_old", 31);
    alert.mockResolvedValue({ sent: false }); email.mockResolvedValue({ sent: false });
    expect((await scan()).newlyAlerted).toBe(0);
    alert.mockResolvedValue({ sent: true });
    // Within the claim window another pass does not send; after it, it does.
    expect((await scan(NOW + 60 * 1000)).newlyAlerted).toBe(0);
    expect((await scan(NOW + 5 * 60 * 1000)).newlyAlerted).toBe(1);
    expect(alert.mock.calls.at(-1)?.[0]).toBe("account_deletion_overdue:deletion_old:2");
    expect((await scan(NOW + 10 * 60 * 1000)).newlyAlerted).toBe(0);
  });

  it("runs in the beta ops monitor pass", async () => {
    const source = await import("node:fs").then(fs => fs.readFileSync(new URL("../utils/betaOpsMonitor.ts", import.meta.url), "utf8"));
    expect(source).toContain("scanAgingAccountDeletionRequests()");
    expect(source).toContain("\"account_deletion_age_scan\"");
  });
});
