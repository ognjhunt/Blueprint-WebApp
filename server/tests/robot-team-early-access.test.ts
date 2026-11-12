// @vitest-environment node
/**
 * Robot teams see site tasks only once they are approved: by a person, or by
 * the fit checklist for a clear fit once enough site tasks are listed.
 *
 * Blueprint opens to a small group of robot teams first and matches each one
 * to sites by hand. These tests pin who sees what: the library, a plan, the
 * application, and the review queue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

import { sharedFakeFirestoreState as state, sharedFakeFirestore as store } from "./helpers/fake-firestore";
import { currentTermsAcceptance, passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";

const tokens = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const slack = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
const sendEmail = vi.hoisted(() => vi.fn(async () => { throw new Error("This test must only queue notices"); }));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    dbAdmin: sharedFakeFirestore,
    authAdmin: {
      verifyIdToken: async (token: string) => {
        const claims = tokens.get(token);
        if (!claims) throw new Error("invalid token");
        return claims;
      },
    },
    storageAdmin: null,
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/slack", () => ({ notifySlackRobotTeamAccessApplication: slack }));
vi.mock("../utils/email", () => ({ sendEmail }));
// The per-address limit would otherwise carry across tests from one address.
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const early = await import("../utils/robotTeamEarlyAccess");
const accessRouter = (await import("../routes/robot-team-access")).default;
const adminRouter = (await import("../routes/admin-robot-team-access")).default;
const siteWorldsRouter = (await import("../routes/site-worlds")).default;
const verifyFirebaseToken = (await import("../middleware/verifyFirebaseToken")).default;

const CSRF = { cookie: "csrf_token=test-token", "x-csrf-token": "test-token" };
const application = {
  name: "Ada Lovelace",
  email: "Ada@Arm.Example",
  company: "Arm Co",
  website: "https://arm.example",
  robot: "Fixed arm with a parallel gripper, one diffusion policy",
  workWanted: "Tote picking",
  region: "US",
  pilotPackage: "Two-week onsite trial, indicative $20,000, six-week lead time",
  acceptedTerms: true,
};

describe("partner application roles", () => {
  it("records delivery role and supported systems without erasing them on a legacy reapplication", async () => {
    const response = await fetch(`${base}/api/robot-team-access/apply`, {
      method: "POST", headers: { ...CSRF, "content-type": "application/json" },
      body: JSON.stringify({ ...application, partnerRole: "deployment", supportedSystems: "Franka and YAM", region: "Austin and surrounding central Texas sites" }),
    });
    expect(response.status).toBe(202);
    const id = early.accessRecordId(application.email);
    expect(state.docs.get(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${id}`)).toMatchObject({ partnerRole: "deployment", supportedSystems: "Franka and YAM", status: "applied" });
    const repeated = await fetch(`${base}/api/robot-team-access/apply`, { method: "POST", headers: { ...CSRF, "content-type": "application/json" }, body: JSON.stringify(application) });
    expect(repeated.status).toBe(202);
    expect(state.docs.get(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${id}`)).toMatchObject({ partnerRole: "deployment", supportedSystems: "Franka and YAM", status: "applied" });
  });

  it("rejects unsafe website schemes rather than storing clickable script links", async () => {
    const response = await fetch(`${base}/api/robot-team-access/apply`, { method: "POST", headers: { ...CSRF, "content-type": "application/json" },
      body: JSON.stringify({ ...application, website: "javascript:alert(1)", partnerRole: "technology" }) });
    expect(response.status).toBe(400);
    expect(state.docs.size).toBe(0);
  });
});

let server: Server;
let base: string;

async function withApp() {
  const { csrfProtection } = await import("../middleware/csrf");
  const app = express();
  app.use(express.json());
  app.use("/api/robot-team-access", csrfProtection, accessRouter);
  app.use("/api/admin/robot-team-access", csrfProtection, verifyFirebaseToken, adminRouter);
  app.use("/api/site-worlds", siteWorldsRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  base = `http://127.0.0.1:${address.port}`;
}

function listedSite(id: string) {
  state.docs.set(`siteTaskBriefs/${id}`, { requestId: id, summary: "Move totes between two stations", confirmedAtIso: null } as never);
  state.docs.set(`inboundRequests/${id}`, {
    requestId: id,
    request: { buyerType: "site_operator", siteName: "PRIVATE SITE", siteLocation: "PRIVATE ADDRESS",
      consent_attestation: sharedRecordingGrant() },
    public_task_listing: sharedJobListing("Move totes between two stations"),
    capture_privacy_screen: passedPrivacyScreen(id),
    site_task_triage: { disposition: "qualified" },
  } as never);
}

function approve(email: string) {
  const now = "2026-09-23T00:00:00.000Z";
  state.docs.set(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${early.accessRecordId(email)}`, {
    ...application, email: email.toLowerCase(), status: "approved",
    // An approved company that has accepted the current Terms (the gate is unchanged; the record carries it).
    termsAcceptance: currentTermsAcceptance(),
    appliedAtIso: now, updatedAtIso: now, decidedAtIso: now, decidedBy: "ops@tryblueprint.io", decisionNote: null,
  } as never);
}

beforeEach(async () => {
  state.docs.clear();
  tokens.clear();
  slack.mockClear();
  await withApp();
});

afterEach(async () => {
  expect(sendEmail).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("the switch", () => {
  it("is on unless explicitly opened, so a missing variable never exposes sites", () => {
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", "");
    expect(early.isRobotTeamEarlyAccessGated()).toBe(true);
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", "0");
    expect(early.isRobotTeamEarlyAccessGated()).toBe(false);
  });
});

describe("who sees the job library", () => {
  beforeEach(() => listedSite("site-1"));

  async function tasks(token?: string) {
    const response = await fetch(`${base}/api/site-worlds/tasks`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    expect(response.status).toBe(200);
    return (await response.json()) as { items: unknown[]; access: { status: string; allowed: boolean } };
  }

  it("shows an anonymous visitor nothing, and says why", async () => {
    const body = await tasks();
    expect(body.items).toEqual([]);
    expect(body.access).toMatchObject({ status: "none", allowed: false });
  });

  it("shows an approved team with a verified email the cards sites shared", async () => {
    approve("ada@arm.example");
    tokens.set("approved", { uid: "u1", email: "ada@arm.example", email_verified: true });
    const body = await tasks("approved");
    expect(body.access).toMatchObject({ status: "approved", allowed: true });
    expect(body.items).toHaveLength(1);
    expect(JSON.stringify(body.items)).not.toMatch(/PRIVATE/);
  });

  // The site agreed to share its job with robot deployment companies: an approved technology partner sees no job.
  it("shows an approved technology partner no job", async () => {
    approve("ada@arm.example");
    const key = `${early.ROBOT_TEAM_ACCESS_COLLECTION}/${early.accessRecordId("ada@arm.example")}`;
    state.docs.set(key, { ...(state.docs.get(key) as object), partnerRole: "technology" } as never);
    tokens.set("tech", { uid: "u1", email: "ada@arm.example", email_verified: true });
    const body = await tasks("tech");
    expect(body.access).toMatchObject({ status: "approved", allowed: false });
    expect(body.items).toEqual([]);
  });

  it("refuses an approved email that is not verified, since anyone can type an address", async () => {
    approve("ada@arm.example");
    tokens.set("unverified", { uid: "u1", email: "ada@arm.example", email_verified: false });
    const body = await tasks("unverified");
    expect(body.items).toEqual([]);
    expect(body.access).toMatchObject({ status: "approved", allowed: false });
  });

  it("shows staff the library without an application", async () => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    expect((await tasks("ops")).items).toHaveLength(1);
  });

  it("treats a token that does not verify as anonymous rather than an error", async () => {
    const body = await tasks("forged");
    expect(body.items).toEqual([]);
  });

  // Jobs are shared in full since 2026-11-12, so the open value of the switch admits nobody who is not approved.
  it.each(["0", "false", "no", "off", "open"])("admits no anonymous viewer when the switch is set to %s", async value => {
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", value);
    const body = await tasks();
    expect(body.items).toEqual([]);
    expect(body.access).toMatchObject({ allowed: false, signedIn: false });
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE|Move totes|Material handling/);
  });
});


describe("applying", () => {
  it("requires CSRF, records one application per email, and sends one receipt", async () => {
    const post = (headers: Record<string, string>) => fetch(`${base}/api/robot-team-access/apply`, {
      method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(application),
    });
    expect((await post({})).status).toBe(403);
    const first = await post(CSRF);
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ status: "applied", notificationStatus: "queued" });
    expect((await post(CSRF)).status).toBe(202);

    const records = [...state.docs.entries()].filter(([key]) => key.startsWith("robotTeamAccess/"));
    expect(records).toHaveLength(1);
    expect(records[0][1]).toMatchObject({
      email: "ada@arm.example", status: "applied",
      pilotPackage: "Two-week onsite trial, indicative $20,000, six-week lead time",
      // The Terms and Privacy versions the applicant accepted on the form, with the time (planner, 18:50Z).
      termsAcceptance: { accepted_terms: true, terms_version: "2026-11-12.1", privacy_version: "2026-11-12.1",
        terms_url: "/terms", privacy_url: "/privacy", accepted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    });
    const receipts = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/robot_team_access_received"));
    expect(receipts).toHaveLength(1);
    expect(receipts[0][1]).toMatchObject({ to: "ada@arm.example" });
    expect(slack).toHaveBeenCalledTimes(1);
  });

  it("rejects an application missing what matching needs", async () => {
    const response = await fetch(`${base}/api/robot-team-access/apply`, {
      method: "POST", headers: { "content-type": "application/json", ...CSRF },
      body: JSON.stringify({ ...application, robot: "" }),
    });
    expect(response.status).toBe(400);
  });

  it("never undoes an approval, and reopens a declined application for review", async () => {
    approve("ada@arm.example");
    expect((await early.recordAccessApplication({ ...application, website: null, region: null })).record.status).toBe("approved");
    await early.decideAccessApplication({ id: early.accessRecordId("ada@arm.example"), status: "declined", note: null, decidedBy: "ops" });
    expect((await early.recordAccessApplication({ ...application, website: null, region: null })).record.status).toBe("applied");
  });
});

describe("the review queue", () => {
  async function decide(token: string, id: string, status: string) {
    return fetch(`${base}/api/admin/robot-team-access/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}`, ...CSRF },
      body: JSON.stringify({ status, prerequisitesReviewed: status === "approved" }),
    });
  }

  it("is closed to anyone who is not staff", async () => {
    tokens.set("team", { uid: "u1", email: "ada@arm.example", email_verified: true });
    const response = await fetch(`${base}/api/admin/robot-team-access`, { headers: { Authorization: "Bearer team", ...CSRF } });
    expect(response.status).toBe(403);
  });

  it("approves once, emails the next step, and the approved email then sees the library", async () => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    // As the application form records it: the Terms accepted on the form travel with the application.
    const { applicationTermsAcceptance } = await import("../utils/companyTerms");
    await early.recordAccessApplication({ ...application, website: null, region: null }, { termsAcceptance: applicationTermsAcceptance() });
    const id = early.accessRecordId("ada@arm.example");

    const response = await decide("ops", id, "approved");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ application: { status: "approved", decidedBy: "ops@tryblueprint.io" } });
    const approvals = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/robot_team_access_approved"));
    expect(approvals).toHaveLength(1);
    expect(String((approvals[0][1] as { body: string }).body)).toMatch(/signup\/business\?invitation=/);

    listedSite("site-1");
    tokens.set("ada", { uid: "u1", email: "ada@arm.example", email_verified: true });
    const library = await fetch(`${base}/api/site-worlds/tasks`, { headers: { Authorization: "Bearer ada" } });
    expect(((await library.json()) as { items: unknown[] }).items).toHaveLength(1);
    // The application's acceptance was carried to the account on the first visit: it does not accept twice.
    expect(state.docs.get("users/u1")).toMatchObject({ acceptedTerms: true, termsVersion: "2026-11-12.1", privacyVersion: "2026-11-12.1" });
  });

  it("says a polite \"not yet\" by default, and nothing when the reviewer will reply", async () => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    await early.recordAccessApplication({ ...application, website: null, region: null });
    const response = await decide("ops", early.accessRecordId("ada@arm.example"), "declined");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ emailed: false, notificationStatus: "queued" });
    expect([...state.docs.keys()].some((key) => key.startsWith("captureOutbox/robot_team_access_approved"))).toBe(false);
    const notYet = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/robot_team_access_not_yet"));
    expect(notYet).toHaveLength(1);
    expect(String((notYet[0][1] as { body: string }).body)).toMatch(/can't offer your team access yet/);

    await early.recordAccessApplication({ ...application, email: "grace@arm.example", website: null, region: null });
    const quiet = await fetch(`${base}/api/admin/robot-team-access/${early.accessRecordId("grace@arm.example")}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer ops", ...CSRF },
      body: JSON.stringify({ status: "declined", notify: false }),
    });
    expect(await quiet.json()).toMatchObject({ emailed: false, notificationStatus: "not_requested", application: { status: "declined" } });
    expect([...state.docs.keys()].filter((key) => key.startsWith("captureOutbox/robot_team_access_not_yet"))).toHaveLength(1);
  });

  it("reports how many site tasks are listed and when auto-approval starts", async () => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    listedSite("site-1");
    const response = await fetch(`${base}/api/admin/robot-team-access`, { headers: { Authorization: "Bearer ops", ...CSRF } });
    expect(await response.json()).toMatchObject({
      library: { listedTaskCount: 1, autoApproveMinimumTasks: null, gated: true, openSuggestedAtTasks: 10 },
    });
  });
});

describe("the fit checklist", () => {
  const apply = (body: Record<string, unknown>) => fetch(`${base}/api/robot-team-access/apply`, {
    method: "POST", headers: { "content-type": "application/json", ...CSRF }, body: JSON.stringify(body),
  });
  const outbox = (kind: string) => [...state.docs.entries()].filter(([key]) => key.startsWith(`captureOutbox/${kind}`));
  const listFive = () => ["a", "b", "c", "d", "e"].forEach((id) => listedSite(`site-${id}`));

  it("records its reasons, and with nothing listed yet a person replies to everyone", async () => {
    expect(await (await apply({ ...application, testSite: "Our pilot warehouse in Ohio" })).json()).toMatchObject({ status: "applied" });
    const record = state.docs.get(`robotTeamAccess/${early.accessRecordId("ada@arm.example")}`) as Record<string, any>;
    expect(record.testSite).toBe("Our pilot warehouse in Ohio");
    expect(record.fit).toMatchObject({ clearFit: true, listedTaskCount: 0 });
    expect(record.fit.checks.map((check: { id: string; passed: boolean }) => [check.id, check.passed])).toEqual([
      ["work_email", true], ["website_matches_email", true], ["open_tasks_in_region", false],
    ]);
    const receipt = outbox("robot_team_access_received");
    expect(receipt).toHaveLength(1);
    expect(String((receipt[0][1] as { body: string }).body)).toMatch(/A person will review[\s\S]*Our pilot warehouse in Ohio/);
    expect(slack).toHaveBeenCalledWith(expect.objectContaining({ testSite: "Our pilot warehouse in Ohio", autoApproved: false }));
  });

  it("keeps a clear matching-domain fit pending even with listed tasks and a legacy auto-approval setting", async () => {
    listedSite("site-1");
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_AUTO_APPROVE_MIN_TASKS", "1");
    expect(await (await apply(application)).json()).toMatchObject({ status: "applied" });
    const record = state.docs.get(`robotTeamAccess/${early.accessRecordId("ada@arm.example")}`) as Record<string, any>;
    expect(record).toMatchObject({ status: "applied", decidedBy: null });
    expect(outbox("robot_team_access_approved")).toHaveLength(0);
    const receipt = outbox("robot_team_access_received");
    expect(receipt).toHaveLength(1);
    expect(String((receipt[0][1] as { body: string }).body)).toContain("approval is pending");
    // A shared job's card carries no free-text region since 2026-11-12 (the company page shows the country only), so
    // the region check cannot match a card; it never decided an approval.
    expect(record.fit.checks[2]).toMatchObject({ id: "open_tasks_in_region", passed: false });
  });

  it("leaves anything short of a clear fit, or a switched-off rule, to a person", async () => {
    listFive();
    expect(await (await apply({ ...application, email: "ada@gmail.com" })).json()).toMatchObject({ status: "applied" });
    expect(await (await apply({ ...application, email: "ada@other.example" })).json()).toMatchObject({ status: "applied" });
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_AUTO_APPROVE_MIN_TASKS", "off");
    expect(await (await apply({ ...application, email: "grace@arm.example" })).json()).toMatchObject({ status: "applied" });
    expect(outbox("robot_team_access_approved")).toHaveLength(0);
    const personal = state.docs.get(`robotTeamAccess/${early.accessRecordId("ada@gmail.com")}`) as Record<string, any>;
    expect(personal.fit.checks[0]).toMatchObject({ passed: false, detail: "gmail.com is a personal email provider" });
  });
});

describe("inviting a team after a call", () => {
  const invite = (token: string, body: Record<string, unknown>) => fetch(`${base}/api/admin/robot-team-access/invites`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}`, ...CSRF },
    body: JSON.stringify({ ...body, prerequisitesReviewed: true }),
  });

  it("grants that email access, sends one sign-up email, and is staff-only", async () => {
    tokens.set("team", { uid: "u1", email: "ada@arm.example", email_verified: true });
    expect((await invite("team", { name: "Ada", email: "ada@arm.example", company: "Arm Co" })).status).toBe(403);

    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    const first = await invite("ops", { name: "Ada Lovelace", email: "Ada@Arm.Example", company: "Arm Co", note: "Tote picking" });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({
      alreadyApproved: false, emailed: false, notificationStatus: "queued",
      application: { status: "approved", source: "invite", decidedBy: "ops@tryblueprint.io", email: "ada@arm.example" },
    });
    const emails = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/robot_team_access_approved"));
    expect(emails).toHaveLength(1);
    expect(String((emails[0][1] as { body: string }).body)).toMatch(/Following our conversation/);

    const again = await invite("ops", { name: "Ada Lovelace", email: "ada@arm.example", company: "Arm Co" });
    expect(await again.json()).toMatchObject({ alreadyApproved: true, emailed: false });

    listedSite("site-1");
    tokens.set("ada", { uid: "u1", email: "ada@arm.example", email_verified: true });
    // Invited after a call, it never saw the application form: it accepts the current Terms once, on its first visit.
    const firstVisit = await fetch(`${base}/api/site-worlds/tasks`, { headers: { Authorization: "Bearer ada" } });
    expect(firstVisit.status).toBe(403);
    const refused = await firstVisit.json() as Record<string, unknown>;
    expect(refused).toMatchObject({ code: "terms_acceptance_required", access: { allowed: false, termsRequired: true } });
    expect(refused).not.toHaveProperty("items");
    const accepted = await fetch(`${base}/api/robot-team-access/accept-terms`, { method: "POST",
      headers: { Authorization: "Bearer ada", "content-type": "application/json", ...CSRF },
      body: JSON.stringify({ acceptedTerms: true, termsVersion: "2026-11-12.1", privacyVersion: "2026-11-12.1" }) });
    expect(accepted.status).toBe(200);
    const library = await fetch(`${base}/api/site-worlds/tasks`, { headers: { Authorization: "Bearer ada" } });
    expect(((await library.json()) as { items: unknown[] }).items).toHaveLength(1);
  });
});


describe("an approved team that lost its invitation link", () => {
  it("gets a fresh link at its approved address, and the answer reveals nothing", async () => {
    approve("ada@arm.example");
    const ask = (email: string) => fetch(`${base}/api/robot-team-access/invitation`, {
      method: "POST", headers: { "content-type": "application/json", ...CSRF }, body: JSON.stringify({ email }),
    });
    const approved = await ask("Ada@Arm.Example");
    const unknown = await ask("nobody@arm.example");
    expect(approved.status).toBe(202);
    expect(await unknown.json()).toEqual(await approved.json());
    const sent = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/robot_team_access_approved"));
    expect(sent).toHaveLength(1);
    expect(sent[0][1]).toMatchObject({ to: "ada@arm.example" });
    expect(String((sent[0][1] as { body: string }).body)).toMatch(/signup\/business\?invitation=/);
  });
});

describe("access decisions and their durable email intent", () => {
  const email = "ada@arm.example";
  const recordKey = () => `robotTeamAccess/${early.accessRecordId(email)}`;
  const notices = (kind = "robot_team_access_approved") => [...state.docs.entries()]
    .filter(([key]) => key.startsWith(`captureOutbox/${kind}`));
  const post = (path: string, body: Record<string, unknown>) => fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer ops", ...CSRF },
    body: JSON.stringify(body),
  });
  const invite = () => post("/api/admin/robot-team-access/invites", {
    name: "Ada", email, company: "Arm Co", prerequisitesReviewed: true,
  });
  const decide = () => post(`/api/admin/robot-team-access/${early.accessRecordId(email)}/decision`, {
    status: "approved", prerequisitesReviewed: true,
  });
  const resend = () => post("/api/robot-team-access/invitation", { email });

  function failOutboxWriteOnce() {
    const original = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(fn => original(async tx => fn({
      ...tx,
      create: (ref, row) => {
        if (ref.path.startsWith("captureOutbox/")) throw new Error("outbox_write_unavailable");
        tx.create(ref, row);
      },
    })));
  }

  beforeEach(() => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
  });

  it("does not acknowledge an application whose receipt could not commit; retry saves both", async () => {
    failOutboxWriteOnce();
    expect((await post("/api/robot-team-access/apply", application)).status).toBe(503);
    expect(state.docs.has(recordKey())).toBe(false);
    expect(notices("robot_team_access_received")).toHaveLength(0);
    expect(await (await post("/api/robot-team-access/apply", application)).json())
      .toMatchObject({ status: "applied", notificationStatus: "queued" });
    expect(notices("robot_team_access_received")).toHaveLength(1);
  });

  it("preserves the pending application when invitation storage fails, then commits approval and notice together", async () => {
    await early.recordAccessApplication({ ...application, website: null, region: null });
    failOutboxWriteOnce();
    expect((await decide()).status).toBe(503);
    expect(state.docs.get(recordKey())).toMatchObject({ status: "applied", decidedAtIso: null });
    expect(notices()).toHaveLength(0);
    const approved = await (await decide()).json();
    expect(approved).toMatchObject({ emailed: false, notificationStatus: "queued", application: { status: "approved" } });
    const repeated = await (await decide()).json();
    expect(repeated.application.decidedAtIso).toBe(approved.application.decidedAtIso);
    expect(notices()).toHaveLength(1);
  });

  it("rolls back a new direct invitation on outbox failure without manufacturing approval", async () => {
    failOutboxWriteOnce();
    expect((await invite()).status).toBe(503);
    expect(state.docs.has(recordKey())).toBe(false);
    expect(notices()).toHaveLength(0);
    expect((await invite()).status).toBe(201);
    expect(notices()).toHaveLength(1);
  });

  it("retains a committed approval and invitation after response loss, and replay does not send another", async () => {
    const original = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(async fn => {
      await original(fn);
      throw new Error("response_lost_after_commit");
    });
    expect((await invite()).status).toBe(503);
    const revision = state.docs.get(recordKey())!.decidedAtIso;
    expect(notices()).toHaveLength(1);
    const retry = await invite();
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ alreadyApproved: true, emailed: false,
      notificationStatus: "queued", application: { decidedAtIso: revision } });
    expect(notices()).toHaveLength(1);
  });

  it("repairs a legacy approved record's missing notice under concurrent explicit invite retries", async () => {
    approve(email);
    const revision = state.docs.get(recordKey())!.decidedAtIso;
    const responses = await Promise.all([invite(), invite(), invite()]);
    for (const response of responses) expect(await response.json()).toMatchObject({ alreadyApproved: true,
      notificationStatus: "queued", emailed: false, application: { decidedAtIso: revision } });
    expect(notices()).toHaveLength(1);
    expect(state.docs.get(recordKey())!.decidedAtIso).toBe(revision);
  });

  it("keeps concurrent approval retries on one decision revision and one invitation", async () => {
    await early.recordAccessApplication({ ...application, website: null, region: null });
    const responses = await Promise.all([decide(), decide(), decide()]);
    const bodies = await Promise.all(responses.map(response => response.json()));
    expect(new Set(bodies.map(body => body.application.decidedAtIso)).size).toBe(1);
    expect(notices()).toHaveLength(1);
  });

  it("gives a rapid revoke/reinvite a newer revision even on the same clock tick", async () => {
    const now = Date.parse("2026-10-19T10:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    const first = await (await invite()).json();
    await early.decideAccessApplication({ id: early.accessRecordId(email), status: "declined", note: null,
      decidedBy: "fixture-ops", notify: false });
    const declinedRevision = String(state.docs.get(recordKey())!.decidedAtIso);
    const second = await (await invite()).json();
    expect(Date.parse(declinedRevision)).toBeGreaterThan(Date.parse(first.application.decidedAtIso));
    expect(Date.parse(second.application.decidedAtIso)).toBeGreaterThan(Date.parse(declinedRevision));
    expect(notices()).toHaveLength(2);
  });

  it.each(["sent", "unknown", "failed", "cancelled"] as const)("reports an existing %s notice without resetting or duplicating it", async status => {
    await invite();
    const [key, original] = notices()[0];
    state.docs.set(key, { ...original, status, attempts: 2 });
    expect(await (await invite()).json()).toMatchObject({ emailed: status === "sent",
      notificationStatus: status === "sent" ? "sent" : "needs_attention", notification: { outboxStatus: status } });
    expect(notices()).toHaveLength(1);
    expect(state.docs.get(key)).toMatchObject({ status, attempts: 2 });
  });

  it("reports an unknown notice as queued while it is re-sent with its provider key, and as needing attention once it is not", async () => {
    await invite();
    const [key, original] = notices()[0];
    state.docs.set(key, { ...original, status: "unknown", attempts: 2, deliveryKeyAttempt: 2, deliveryKeyFirstUsedAtMs: Date.now() - 60_000 });
    expect(await (await invite()).json()).toMatchObject({ emailed: false, notificationStatus: "queued", notification: { outboxStatus: "unknown" } });
    // Past the provider's idempotency window the pump does not send it again.
    state.docs.set(key, { ...state.docs.get(key)!, deliveryKeyFirstUsedAtMs: Date.now() - 24 * 60 * 60 * 1000 });
    expect(await (await invite()).json()).toMatchObject({ notificationStatus: "needs_attention", notification: { outboxStatus: "unknown" } });
    expect(notices()).toHaveLength(1);
  });

  it("preserves approval on resend queue failure and deduplicates concurrent explicit resends", async () => {
    approve(email);
    const originalApproval = structuredClone(state.docs.get(recordKey()));
    failOutboxWriteOnce();
    expect((await resend()).status).toBe(503);
    expect(state.docs.get(recordKey())).toEqual(originalApproval);
    const responses = await Promise.all([resend(), resend(), resend()]);
    expect(responses.map(response => response.status)).toEqual([202, 202, 202]);
    expect(notices()).toHaveLength(1);
    expect(state.docs.get(recordKey())).toEqual(originalApproval);
  });

  it("never queues a resend after approval has been withdrawn", async () => {
    approve(email);
    await early.decideAccessApplication({ id: early.accessRecordId(email), status: "declined", note: null,
      decidedBy: "fixture-ops", notify: false });
    expect((await resend()).status).toBe(202);
    expect(notices()).toHaveLength(0);
  });

  it.each(["pending", "sent", "unknown"] as const)("reissues a same-hour resend for a new approval while preserving the prior %s notice", async status => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T10:00:00.000Z"));
    try {
      approve(email);
      const first = await early.requestAccessInvitation(email);
      const originalKey = `captureOutbox/${first!.outboxId}`;
      const original = { ...state.docs.get(originalKey)!, status, attempts: 2 };
      state.docs.set(originalKey, original);
      await early.decideAccessApplication({ id: early.accessRecordId(email), status: "declined", note: null,
        decidedBy: "fixture-ops", notify: false });
      await early.decideAccessApplication({ id: early.accessRecordId(email), status: "approved", note: null,
        decidedBy: "fixture-ops", notify: false });
      const next = await early.requestAccessInvitation(email);
      expect(next).toMatchObject({ status: "queued", outboxStatus: "pending" });
      expect(next!.outboxId).not.toBe(first!.outboxId);
      expect(state.docs.get(originalKey)).toEqual(original);
      const replacement = state.docs.get(`captureOutbox/${next!.outboxId}`)!;
      expect(replacement.robotTeamAccessNotice).toMatchObject({ revision: state.docs.get(recordKey())!.decidedAtIso });
      const token = /invitation=([^\s]+)/.exec(String(replacement.body))![1];
      const { resolveAccountInvitation } = await import("../utils/accountInvitations");
      expect(await resolveAccountInvitation(decodeURIComponent(token)))
        .toMatchObject({ revision: state.docs.get(recordKey())!.decidedAtIso });
      expect(await early.requestAccessInvitation(email)).toEqual(next);
      expect(notices().filter(([key]) => key.includes(":resend-"))).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it.each(["pending", "sent", "unknown"] as const)("preserves an unbound legacy hourly %s resend for review without blindly requeuing", async status => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T10:00:00.000Z"));
    try {
      approve(email);
      const legacyId = `robot_team_access_approved:${early.accessRecordId(email)}:resend-2026-10-19T10`;
      const original = { kind: "robot_team_access_approved", requestId: `robot-team-access:${early.accessRecordId(email)}`,
        to: email, status, attempts: 2, body: "retained legacy invitation" };
      state.docs.set(`captureOutbox/${legacyId}`, original);
      expect(await early.requestAccessInvitation(email)).toEqual({ status: "needs_attention", outboxStatus: status, outboxId: legacyId });
      expect(notices()).toHaveLength(1);
      expect(state.docs.get(`captureOutbox/${legacyId}`)).toEqual(original);
    } finally { vi.useRealTimers(); }
  });
});

describe("one registration per approval", () => {
  it("reserves the approval once, so a concurrent registration with the same invitation is refused", async () => {
    const { reserveApprovalForRegistration, accessRecordId, ROBOT_TEAM_ACCESS_COLLECTION } = await import("../utils/robotTeamEarlyAccess");
    const id = accessRecordId("reserve@example.com");
    expect(await reserveApprovalForRegistration(id)).toBe("not_approved");
    state.docs.set(`${ROBOT_TEAM_ACCESS_COLLECTION}/${id}`, { email: "reserve@example.com", status: "approved" });
    const now = Date.parse("2026-10-15T12:00:00Z");
    expect(await reserveApprovalForRegistration(id, now)).toBe("reserved");
    expect(await reserveApprovalForRegistration(id, now + 1000)).toBe("in_progress");
    // A registration that failed lapses; one that bound its team holds the approval for good.
    expect(await reserveApprovalForRegistration(id, now + 121_000)).toBe("reserved");
    state.docs.set(`${ROBOT_TEAM_ACCESS_COLLECTION}/${id}`, { email: "reserve@example.com", status: "approved", teamIds: ["team-1"] });
    expect(await reserveApprovalForRegistration(id, now + 500_000)).toBe("team_exists");
  });
});
