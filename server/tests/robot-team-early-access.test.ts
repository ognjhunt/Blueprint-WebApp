// @vitest-environment node
/**
 * Robot teams see site tasks only once a person approves them.
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

  it("declines without sending anything", async () => {
    tokens.set("ops", { uid: "ops", email: "ops@tryblueprint.io", email_verified: true, ops: true });
    await early.recordAccessApplication({ ...application, website: null, region: null });
    const response = await decide("ops", early.accessRecordId("ada@arm.example"), "declined");
    expect(response.status).toBe(200);
    expect([...state.docs.keys()].some((key) => key.startsWith("captureOutbox/robot_team_access_approved"))).toBe(false);
  });
});
