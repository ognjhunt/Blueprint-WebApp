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

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { listedTaskCard } from "./helpers/listedTaskCard";

const tokens = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const slack = vi.hoisted(() => vi.fn(async () => ({ sent: true })));

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
// The per-address limit would otherwise carry across tests from one address.
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const early = await import("../utils/robotTeamEarlyAccess");
const { createHash } = await import("node:crypto");
const hashKey = (key: string) => createHash("sha256").update(key.trim()).digest("hex");
const accessRouter = (await import("../routes/robot-team-access")).default;
const adminRouter = (await import("../routes/admin-robot-team-access")).default;
const siteWorldsRouter = (await import("../routes/site-worlds")).default;
const agentTeamRouter = (await import("../routes/agent-team")).default;
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

let server: Server;
let base: string;

async function withApp() {
  const { csrfProtection } = await import("../middleware/csrf");
  const app = express();
  app.use(express.json());
  app.use("/api/robot-team-access", csrfProtection, accessRouter);
  app.use("/api/admin/robot-team-access", csrfProtection, verifyFirebaseToken, adminRouter);
  app.use("/api/site-worlds", siteWorldsRouter);
  app.use("/api/agent-team", agentTeamRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  base = `http://127.0.0.1:${address.port}`;
}

function listedSite(id: string) {
  state.docs.set(`inboundRequests/${id}`, {
    requestId: id,
    request: { buyerType: "site_operator", siteName: "PRIVATE SITE", siteLocation: "PRIVATE ADDRESS" },
    public_task_listing: listedTaskCard(),
    site_task_triage: { disposition: "qualified" },
  } as never);
}

function approve(email: string) {
  const now = "2026-09-23T00:00:00.000Z";
  state.docs.set(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${early.accessRecordId(email)}`, {
    ...application, email: email.toLowerCase(), status: "approved",
    appliedAtIso: now, updatedAtIso: now, decidedAtIso: now, decidedBy: "ops@tryblueprint.io", decisionNote: null,
  } as never);
}

function teamWithKey(teamId: string, key: string, account: { uid: string; email: string } | null, contactEmail?: string) {
  state.docs.set(`robotTeams/${teamId}`, {
    id: teamId, name: "Arm Co", status: "self_registered", capability: {}, fieldProvenance: {},
    contactEmail: contactEmail ?? null,
    ...(account ? { accountUid: account.uid, accountEmail: account.email } : {}),
    createdAt: "2026-09-23T00:00:00.000Z", updatedAt: "2026-09-23T00:00:00.000Z",
  } as never);
  state.docs.set(`robotTeamAgentKeys/${hashKey(key)}`, {
    keyHash: hashKey(key), teamId, label: "test", createdAtIso: "2026-09-23T00:00:00.000Z", lastUsedAtIso: null, revokedAtIso: null,
  } as never);
}

beforeEach(async () => {
  state.docs.clear();
  tokens.clear();
  slack.mockClear();
  await withApp();
});

afterEach(async () => {
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

  it("opens to everyone when early access is switched off", async () => {
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", "0");
    expect((await tasks()).items).toHaveLength(1);
  });
});

describe("an agent key's team", () => {
  beforeEach(() => listedSite("site-1"));

  it("refuses the paid plan while preserving the account admission check", async () => {
    teamWithKey("team-1", "bpk_unbound", null, "ada@arm.example");
    approve("ada@arm.example");
    const refused = await fetch(`${base}/api/agent-team/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer bpk_unbound" },
      body: JSON.stringify({ checkpointId: "ckpt-1" }),
    });
    // The registration contact email is approved, but proves nothing.
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "paid_evaluations_disabled" });
    expect(await early.teamHasEarlyAccess("team-1")).toBe(false);

    teamWithKey("team-2", "bpk_bound", { uid: "u1", email: "ada@arm.example" });
    expect(await early.teamHasEarlyAccess("team-2")).toBe(true);
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
    expect(await first.json()).toEqual({ status: "applied" });
    expect((await post(CSRF)).status).toBe(202);

    const records = [...state.docs.entries()].filter(([key]) => key.startsWith("robotTeamAccess/"));
    expect(records).toHaveLength(1);
    expect(records[0][1]).toMatchObject({
      email: "ada@arm.example", status: "applied",
      pilotPackage: "Two-week onsite trial, indicative $20,000, six-week lead time",
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
    await early.recordAccessApplication({ ...application, website: null, region: null });
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
  });

  it("says a polite \"not yet\" by default, and nothing when the reviewer will reply", async () => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    await early.recordAccessApplication({ ...application, website: null, region: null });
    const response = await decide("ops", early.accessRecordId("ada@arm.example"), "declined");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ emailed: true });
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
    expect(await quiet.json()).toMatchObject({ emailed: false, application: { status: "declined" } });
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
    expect(await (await apply({ ...application, testSite: "Our pilot warehouse in Ohio" })).json()).toEqual({ status: "applied" });
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
    expect(await (await apply(application)).json()).toEqual({ status: "applied" });
    const record = state.docs.get(`robotTeamAccess/${early.accessRecordId("ada@arm.example")}`) as Record<string, any>;
    expect(record).toMatchObject({ status: "applied", decidedBy: null });
    expect(outbox("robot_team_access_approved")).toHaveLength(0);
    const receipt = outbox("robot_team_access_received");
    expect(receipt).toHaveLength(1);
    expect(String((receipt[0][1] as { body: string }).body)).toContain("approval is pending");
    expect(record.fit.checks[2]).toMatchObject({ id: "open_tasks_in_region", passed: true });
  });

  it("leaves anything short of a clear fit, or a switched-off rule, to a person", async () => {
    listFive();
    expect(await (await apply({ ...application, email: "ada@gmail.com" })).json()).toEqual({ status: "applied" });
    expect(await (await apply({ ...application, email: "ada@other.example" })).json()).toEqual({ status: "applied" });
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_AUTO_APPROVE_MIN_TASKS", "off");
    expect(await (await apply({ ...application, email: "grace@arm.example" })).json()).toEqual({ status: "applied" });
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
      alreadyApproved: false, emailed: true,
      application: { status: "approved", source: "invite", decidedBy: "ops@tryblueprint.io", email: "ada@arm.example" },
    });
    const emails = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/robot_team_access_approved"));
    expect(emails).toHaveLength(1);
    expect(String((emails[0][1] as { body: string }).body)).toMatch(/Following our conversation/);

    const again = await invite("ops", { name: "Ada Lovelace", email: "ada@arm.example", company: "Arm Co" });
    expect(await again.json()).toMatchObject({ alreadyApproved: true, emailed: false });

    listedSite("site-1");
    tokens.set("ada", { uid: "u1", email: "ada@arm.example", email_verified: true });
    const library = await fetch(`${base}/api/site-worlds/tasks`, { headers: { Authorization: "Bearer ada" } });
    expect(((await library.json()) as { items: unknown[] }).items).toHaveLength(1);
  });
});

describe("registering a team through the agent API", () => {
  const register = (body: Record<string, unknown>, token?: string) => fetch(`${base}/api/agent-team/register`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ teamName: "Arm Co", ...body }),
  });
  const teams = () => [...state.docs.entries()].filter(([key]) => key.startsWith("robotTeams/"));
  const approvalOf = (email: string) => state.docs.get(`${early.ROBOT_TEAM_ACCESS_COLLECTION}/${early.accessRecordId(email)}`) as never;
  const invitationFor = async (email: string) =>
    (await import("../utils/accountInvitations")).robotTeamAccountInvitation(approvalOf(email));

  it("is by invitation: anonymous, unapproved and stale callers get typed refusals and no team", async () => {
    const anonymous = await register({});
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toMatchObject({ code: "registration_invitation_required" });

    tokens.set("stranger", { uid: "u9", email: "stranger@arm.example", email_verified: true });
    const stranger = await register({}, "stranger");
    expect(stranger.status).toBe(403);
    expect(await stranger.json()).toMatchObject({ code: "registration_not_approved" });

    approve("ada@arm.example");
    const invitation = await invitationFor("ada@arm.example");
    await early.decideAccessApplication({ id: early.accessRecordId("ada@arm.example"), status: "declined", note: null, decidedBy: "ops" });
    const stale = await register({ invitation });
    expect(stale.status).toBe(403);
    expect(await stale.json()).toMatchObject({ code: "registration_invitation_invalid" });
    expect(teams()).toHaveLength(0);
  });

  it("binds the approval to the one team it registers, which the approved account then holds", async () => {
    approve("ada@arm.example");
    const invitation = await invitationFor("ada@arm.example");
    const created = await register({ invitation, contactEmail: "someone@else.example" });
    expect(created.status).toBe(201);
    const { teamId } = (await created.json()) as { teamId: string };
    expect(state.docs.get(`robotTeams/${teamId}`)).toMatchObject({
      contactEmail: "ada@arm.example",
      accessApproval: { accessRecordId: early.accessRecordId("ada@arm.example") },
    });
    expect(approvalOf("ada@arm.example")).toMatchObject({ teamIds: [teamId] });

    const again = await register({ invitation });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "registration_team_exists", teamId });

    // The approved account signs in: it takes that team rather than starting another.
    listedSite("site-1");
    tokens.set("ada", { uid: "u1", email: "ada@arm.example", email_verified: true });
    const library = await fetch(`${base}/api/site-worlds/tasks`, { headers: { Authorization: "Bearer ada" } });
    expect(((await library.json()) as { items: unknown[] }).items).toHaveLength(1);
    expect(teams()).toHaveLength(1);
    expect(state.docs.get(`robotTeams/${teamId}`)).toMatchObject({ accountUid: "u1" });
    expect(await early.teamHasEarlyAccess(teamId)).toBe(true);

    // Access is the team's: another team the account picks up later is not
    // covered, and declining the application withdraws the team's access.
    teamWithKey("team-later", "bpk_later", { uid: "u1", email: "ada@arm.example" });
    expect(await early.teamHasEarlyAccess("team-later")).toBe(false);
    await early.decideAccessApplication({ id: early.accessRecordId("ada@arm.example"), status: "declined", note: null, decidedBy: "ops" });
    expect(await early.teamHasEarlyAccess(teamId)).toBe(false);
  });

  it("keeps an approval given before approvals were bound to teams on the team the account already holds", async () => {
    approve("ada@arm.example");
    teamWithKey("team-legacy", "bpk_legacy", { uid: "u1", email: "ada@arm.example" });
    const refused = await register({ invitation: await invitationFor("ada@arm.example") });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "registration_team_exists", teamId: "team-legacy" });
    expect(teams()).toHaveLength(1);
    expect(await early.teamHasEarlyAccess("team-legacy")).toBe(true);
  });

  it("lets staff register a team", async () => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    expect((await register({}, "ops")).status).toBe(201);
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
