// @vitest-environment node
/**
 * Outreach gap 1 (2026-11-27): what tells the owner an application waits, and what each press sends. The live Slack
 * webhook is unverified, and with none set the bell and the three-working-day reminder reached nobody. The owner now
 * gets one email per application per notice as well, through the outbox, to the ops address only
 * (`ownerApplicationNotice.ts`). Real `slack.ts`, real `opsProcessAlerts.ts`, real reminder, real decision, real outbox
 * dispatch on the repo's fake Firestore; `fetch` is spied so a Slack post would be seen, and `sendEmail` is a stub, so
 * nothing is sent anywhere.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null,
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } } };
});
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock("../logger", () => ({ logger: log }));
const sendEmail = vi.hoisted(() => vi.fn(async () => ({ sent: true, provider: "resend", messageId: "local-test-message" })));
vi.mock("../utils/email", async (actual) => ({ ...(await actual<typeof import("../utils/email")>()), sendEmail }));

const saved = { a: process.env.SLACK_WEBHOOK_URL, b: process.env.SLACK_INBOUND_WEBHOOK_URL, c: process.env.CONTACT_TO };
delete process.env.SLACK_WEBHOOK_URL;
delete process.env.SLACK_INBOUND_WEBHOOK_URL;
delete process.env.CONTACT_TO;
afterAll(() => {
  if (saved.a !== undefined) process.env.SLACK_WEBHOOK_URL = saved.a;
  if (saved.b !== undefined) process.env.SLACK_INBOUND_WEBHOOK_URL = saved.b;
  if (saved.c !== undefined) process.env.CONTACT_TO = saved.c;
});

const fetchSpy = vi.fn(async () => new Response("ok"));
vi.stubGlobal("fetch", fetchSpy);

const slack = await import("../utils/slack");
const early = await import("../utils/robotTeamEarlyAccess");
const { notifyOwnerOfApplication, OWNER_APPLICATION_EMAIL_DAILY_CAP, OWNER_APPLICATION_EMAIL_LAST_LINES } =
  await import("../utils/ownerApplicationNotice");
const { remindWaitingAccessApplications } = await import("../utils/accessApplicationReminder");
const { checkNewCompanyApplication } = await import("../utils/companyCheck");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { __resetOpsProcessAlertsForTests } = await import("../utils/opsProcessAlerts");

const APPLICANT = "ops@outreach-fixture-arm.example.com";
const outboxKeys = () => [...state.docs.keys()].filter(key => key.startsWith("captureOutbox/"));
const ownerRows = () => outboxKeys().filter(key => key.startsWith("captureOutbox/ops_access_application:"))
  .map(key => ({ key, ...(state.docs.get(key) as Record<string, string>) }));
const markers = () => [...state.docs.keys()].filter(key => key.startsWith("opsAccessApplicationReminders/"));
const expectLinkOnly = (row: { to: string; subject: string; body: string }, id: string) => {
  expect(row.to).toBe("ops@tryblueprint.io");
  expect(row.body).toContain(`https://tryblueprint.io/admin/robot-team-access?application=${id}`);
  for (const text of [row.subject, row.body]) expect(text).not.toMatch(/outreach-fixture|Fixture Applicant|Fixture Co/);
};

async function apply(email: string) {
  const { record } = await early.recordAccessApplication({ name: "Fixture Applicant", email, company: "Fixture Co",
    website: "https://outreach-fixture-arm.example.com", partnerRole: "deployment" });
  return { id: early.accessRecordId(record.email), record };
}
const waitedSinceLastWeek = (id: string) => state.docs.set(`robotTeamAccess/${id}`,
  { ...(state.docs.get(`robotTeamAccess/${id}`) as object), appliedAtIso: "2026-11-20T10:00:00.000Z" });
const now = () => Date.parse("2026-11-27T02:00:00.000Z");

beforeEach(() => {
  state.docs.clear(); fetchSpy.mockClear(); sendEmail.mockClear(); log.warn.mockClear(); log.error.mockClear();
  __resetOpsProcessAlertsForTests();
});

describe("with no Slack webhook set", () => {
  it("the new-application notice is emailed to the ops address once, link-only; the bell itself still reaches nobody", async () => {
    const { id } = await apply(APPLICANT);
    expect(await slack.notifySlackRobotTeamAccessApplication({ email: APPLICANT })).toEqual({ sent: false });
    expect(ownerRows()).toEqual([]);
    const rung = await notifyOwnerOfApplication({ email: APPLICANT, autoApproved: false,
      check: { outcome: "needs_owner", reasons: ["no_model"] } });
    expect(rung).toEqual({ sent: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    const rows = ownerRows();
    expect(rows.map(row => row.key)).toEqual([`captureOutbox/ops_access_application:new_application:${id}`]);
    expect(rows[0]).toMatchObject({ kind: "ops_access_application", status: "pending",
      subject: "Blueprint: a deployment company applied and needs you" });
    expectLinkOnly(rows[0], id);
    // A second ring for the same application (a retry that settles it) adds no second email.
    await notifyOwnerOfApplication({ email: APPLICANT, autoApproved: true, check: { outcome: "approved", reasons: [] } });
    expect(ownerRows()).toHaveLength(1);
  });

  it("the three-working-day reminder is emailed once and its marker kept; later passes add nothing", async () => {
    const { id } = await apply(APPLICANT);
    waitedSinceLastWeek(id);
    expect(await remindWaitingAccessApplications({ now })).toEqual({ waiting: 1, reminded: 1, emailed: 1 });
    expect(markers()).toEqual([`opsAccessApplicationReminders/${id}`]);
    for (let pass = 0; pass < 2; pass++) {
      __resetOpsProcessAlertsForTests();
      expect(await remindWaitingAccessApplications({ now })).toEqual({ waiting: 1, reminded: 0, emailed: 0 });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    const rows = ownerRows();
    expect(rows.map(row => row.key)).toEqual([`captureOutbox/ops_access_application:waiting_reminder:${id}`]);
    expect(rows[0].subject).toBe("Blueprint: a deployment company application waited 3 working days");
    expectLinkOnly(rows[0], id);
  });

  it("the outbox sends the owner's email to the ops address, and to no one else", async () => {
    const { id } = await apply(APPLICANT);
    await notifyOwnerOfApplication({ email: APPLICANT, check: { outcome: "needs_owner", reasons: ["webmail"] } });
    const summary = await deliverOutbox({ limit: 10 });
    expect(summary.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((sendEmail.mock.calls[0] as unknown as [{ to: string }])[0].to).toBe("ops@tryblueprint.io");
    expect(state.docs.get(`captureOutbox/ops_access_application:new_application:${id}`)).toMatchObject({ status: "sent" });
  });

  it("goes to CONTACT_TO when it is set, the address every ops alert uses", async () => {
    process.env.CONTACT_TO = "owner-inbox@blueprint.test";
    try {
      await apply(APPLICANT);
      await notifyOwnerOfApplication({ email: APPLICANT });
      expect(ownerRows()[0]).toMatchObject({ to: "owner-inbox@blueprint.test", subject: "Blueprint: a deployment company applied and needs you" });
    } finally { delete process.env.CONTACT_TO; }
  });

  it("is never a gate: with the outbox write failing, the application is still saved and checked", async () => {
    const { id } = await apply("someone@gmail.com");
    const realCreate = state.docs.set.bind(state.docs);
    const spy = vi.spyOn(state.docs, "set").mockImplementation((key: string, value: unknown) => {
      if (key.startsWith("captureOutbox/ops_access_application:")) throw new Error("outbox_write_unavailable");
      return realCreate(key, value);
    });
    try {
      await expect(checkNewCompanyApplication({ email: "someone@gmail.com" })).resolves.toBeUndefined();
    } finally { spy.mockRestore(); }
    const record = state.docs.get(`robotTeamAccess/${id}`) as Record<string, any>;
    expect(record.status).toBe("applied");
    expect(record.companyCheck).toMatchObject({ outcome: "needs_owner", reasons: ["webmail"] });
    expect(ownerRows()).toEqual([]);
  });
});

// Review, 2026-11-27: the owner's emails share the plan customers' emails use (100 a day), and the form has no global
// cap. A burst of applications queues at most the day's ceiling; the last one says so; every application is still saved.
describe("the daily ceiling on the owner's application emails", () => {
  const burst = (count: number) => Array.from({ length: count }, (_, index) => `ops${index}@burst.example.com`);

  it("a burst of applications queues at most the ceiling, the last one says no more today, and each is still saved", async () => {
    expect(OWNER_APPLICATION_EMAIL_DAILY_CAP).toBe(10);
    const emails = burst(15);
    for (const email of emails) {
      await apply(email);
      await notifyOwnerOfApplication({ email, check: { outcome: "needs_owner", reasons: ["no_model"] } });
    }
    for (const email of emails) expect(state.docs.get(`robotTeamAccess/${early.accessRecordId(email)}`)).toBeTruthy();
    const rows = ownerRows();
    expect(rows).toHaveLength(10);
    const byId = (email: string) => rows.find(row => row.key.endsWith(early.accessRecordId(email)));
    for (const email of emails.slice(0, 9)) expect(byId(email)?.body).not.toContain(OWNER_APPLICATION_EMAIL_LAST_LINES[0]);
    const last = byId(emails[9])!;
    for (const line of OWNER_APPLICATION_EMAIL_LAST_LINES) expect(last.body).toContain(line);
    expect(last.body).toContain("Blueprint sends at most 10 a day");
    expect(last.body.trim().endsWith("https://tryblueprint.io/admin/robot-team-access")).toBe(true);
    expectLinkOnly(last, early.accessRecordId(emails[9]));
    for (const email of emails.slice(10)) expect(byId(email)).toBeUndefined();
    // The ceiling is one durable counter for the day, not in-process memory.
    const counters = [...state.docs.entries()].filter(([key]) => key.startsWith("durableDailyCaps/ops_access_application_email__"));
    expect(counters.map(([, value]) => (value as { used: number }).used)).toEqual([10]);
  });

  it("a second ring for an application already emailed is not counted again", async () => {
    for (let ring = 0; ring < 12; ring++) await notifyOwnerOfApplication({ email: APPLICANT });
    expect(ownerRows()).toHaveLength(1);
    const [[, counter]] = [...state.docs.entries()].filter(([key]) => key.startsWith("durableDailyCaps/ops_access_application_email__"));
    expect((counter as { used: number }).used).toBe(1);
    await notifyOwnerOfApplication({ email: "ops@another.example.com" });
    expect(ownerRows()).toHaveLength(2);
  });

  it("past the ceiling, a reminder no channel took keeps no marker, so a later pass tries again", async () => {
    for (const email of burst(10)) { await apply(email); await notifyOwnerOfApplication({ email }); }
    expect(ownerRows()).toHaveLength(10);
    const { id } = await apply(APPLICANT);
    waitedSinceLastWeek(id);
    expect(await remindWaitingAccessApplications({ now })).toEqual({ waiting: 1, reminded: 0, emailed: 0 });
    expect(markers()).toEqual([]);
    expect(ownerRows()).toHaveLength(10);
  });
});

describe("with a Slack webhook set", () => {
  it("the reminder is posted once, its marker kept, and the email queued once beside it", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.invalid/local-test";
    try {
      const { id } = await apply(APPLICANT);
      waitedSinceLastWeek(id);
      expect(await remindWaitingAccessApplications({ now })).toEqual({ waiting: 1, reminded: 1, emailed: 1 });
      expect(markers()).toEqual([`opsAccessApplicationReminders/${id}`]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify((fetchSpy.mock.calls[0] as unknown[])[1])).not.toMatch(/outreach-fixture|Fixture Applicant/);
      expect(ownerRows()).toHaveLength(1);
    } finally { delete process.env.SLACK_WEBHOOK_URL; }
  });
});

describe("the owner's one press", () => {
  it("approve queues one approval email with a 7-day invitation link and a Find jobs link", async () => {
    const { id } = await apply("ops@outreach-fixture-arm.example.com");
    const decided = await early.decideAccessApplication({ id, status: "approved", note: null, decidedBy: "owner" });
    expect(decided?.notification.status).toBe("queued");
    const rows = outboxKeys();
    expect(rows).toHaveLength(1);
    const row = state.docs.get(rows[0]) as Record<string, string>;
    expect(row.kind).toBe("robot_team_access_approved");
    expect(row.subject).toBe("Your company is approved to see jobs on Blueprint");
    expect(row.body).toMatch(/\/signup\/business\?invitation=/);
    expect(row.body).toMatch(/expires in 7 days/);
    expect(row.body).toMatch(/Find jobs:\nhttps:\/\/tryblueprint\.io\/sign-in\?next=%2Fcontact%2Frobot-team\n/);
    expect(row.body).not.toMatch(/vendor|integrator|OEM|\$\d|price/i);
  });

  it("decline of a waiting application queues exactly one fixed decline email (status pending until the outbox delivers it)", async () => {
    const { id } = await apply("ops@outreach-fixture-arm.example.com");
    const decided = await early.decideAccessApplication({ id, status: "declined", note: null, decidedBy: "owner" });
    expect(decided?.notification.status).toBe("queued");
    const rows = outboxKeys();
    expect(rows).toHaveLength(1);
    const row = state.docs.get(rows[0]) as Record<string, string>;
    expect(row.kind).toBe("robot_team_access_declined");
    expect(row.status).toBe("pending");
    expect(row.to).toBe("ops@outreach-fixture-arm.example.com");
    // Pressing it again sends nothing more.
    await early.decideAccessApplication({ id, status: "declined", note: null, decidedBy: "owner" });
    expect(outboxKeys()).toHaveLength(1);
  });

  it("withdrawing an approval (decline after approve) sends the company nothing", async () => {
    const { id } = await apply("ops@outreach-fixture-arm.example.com");
    await early.decideAccessApplication({ id, status: "approved", note: null, decidedBy: "owner" });
    const afterApproval = outboxKeys().length;
    await early.decideAccessApplication({ id, status: "declined", note: null, decidedBy: "owner" });
    expect(outboxKeys()).toHaveLength(afterApproval);
    expect((state.docs.get(`robotTeamAccess/${id}`) as Record<string, string>).status).toBe("declined");
  });
});
