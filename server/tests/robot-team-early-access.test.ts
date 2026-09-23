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

describe("who sees the task library", () => {
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

  it("is refused a plan until its verified, bound account is approved", async () => {
    teamWithKey("team-1", "bpk_unbound", null, "ada@arm.example");
    approve("ada@arm.example");
    const refused = await fetch(`${base}/api/agent-team/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer bpk_unbound" },
      body: JSON.stringify({ checkpointId: "ckpt-1" }),
    });
    // The registration contact email is approved, but proves nothing.
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "early_access_required", apply: expect.stringContaining("/contact/robot-team") });
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
    expect(records[0][1]).toMatchObject({ email: "ada@arm.example", status: "applied" });
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
      body: JSON.stringify({ status }),
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
    expect(String((approvals[0][1] as { body: string }).body)).toMatch(/signup\/business\?buyerType=robot_team/);

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
    expect(await response.json()).toMatchObject({ library: { listedTaskCount: 1, autoApproveMinimumTasks: 5 } });
  });
});

describe("the fit checklist", () => {
  const apply = (body: Record<string, unknown>) => fetch(`${base}/api/robot-team-access/apply`, {
    method: "POST", headers: { "content-type": "application/json", ...CSRF }, body: JSON.stringify(body),
  });
  const outbox = (kind: string) => [...state.docs.entries()].filter(([key]) => key.startsWith(`captureOutbox/${kind}`));
  const listFive = () => ["a", "b", "c", "d", "e"].forEach((id) => listedSite(`site-${id}`));

  it("records its reasons, and while the library is thin a person replies to everyone", async () => {
    listedSite("site-1");
    expect(await (await apply({ ...application, testSite: "Our pilot warehouse in Ohio" })).json()).toEqual({ status: "applied" });
    const record = state.docs.get(`robotTeamAccess/${early.accessRecordId("ada@arm.example")}`) as Record<string, any>;
    expect(record.testSite).toBe("Our pilot warehouse in Ohio");
    expect(record.fit).toMatchObject({ clearFit: true, listedTaskCount: 1 });
    expect(record.fit.checks.map((check: { id: string; passed: boolean }) => [check.id, check.passed])).toEqual([
      ["work_email", true], ["website_matches_email", true], ["open_tasks_in_region", true],
    ]);
    const receipt = outbox("robot_team_access_received");
    expect(receipt).toHaveLength(1);
    expect(String((receipt[0][1] as { body: string }).body)).toMatch(/a person will reply[\s\S]*Our pilot warehouse in Ohio/);
    expect(slack).toHaveBeenCalledWith(expect.objectContaining({ testSite: "Our pilot warehouse in Ohio", autoApproved: false }));
  });

  it("approves a clear fit on its own once enough site tasks are listed", async () => {
    listFive();
    expect(await (await apply(application)).json()).toEqual({ status: "approved" });
    expect(state.docs.get(`robotTeamAccess/${early.accessRecordId("ada@arm.example")}`))
      .toMatchObject({ status: "approved", decidedBy: "auto: fit checklist" });
    expect(outbox("robot_team_access_received")).toHaveLength(0);
    const approval = outbox("robot_team_access_approved");
    expect(approval).toHaveLength(1);
    expect(String((approval[0][1] as { body: string }).body)).toMatch(/20-minute call/);
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
    body: JSON.stringify(body),
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
