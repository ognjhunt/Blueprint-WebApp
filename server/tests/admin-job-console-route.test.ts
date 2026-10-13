// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, any>>>(),
  checkpoints: [] as Array<Record<string, any>>,
}));

function table(name: string) {
  if (!state.collections.has(name)) state.collections.set(name, new Map());
  return state.collections.get(name)!;
}

function read(row: Row, path: string) {
  return path.split(".").reduce<any>((value, key) => (value == null ? undefined : value[key]), row);
}

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const docRef = (collection: string, id: string): any => ({
    id,
    get: async () => ({ id, exists: table(collection).has(id), data: () => table(collection).get(id) }),
    collection: (sub: string) => ({ doc: (subId: string) => docRef(`${collection}/${id}/${sub}`, subId) }),
  });
  const query = (collection: string, filters: Array<(row: Row) => boolean>, order: string | null, after: string | null, limit: number): any => ({
    where: (field: string, op: string, value: unknown) => query(collection, [...filters,
      (row: Row) => op === "in" ? (value as unknown[]).includes(read(row, field)) : read(row, field) === value], order, after, limit),
    orderBy: (field: string) => query(collection, filters, field, after, limit),
    startAfter: (snapshot: { id: string }) => query(collection, filters, order, snapshot.id, limit),
    limit: (count: number) => query(collection, filters, order, after, count),
    get: async () => {
      let rows = [...table(collection).entries()].filter(([, row]) => filters.every((filter) => filter(row)));
      if (order) rows = rows.sort(([, a], [, b]) => String(read(b, order)).localeCompare(String(read(a, order))));
      if (after) rows = rows.slice(rows.findIndex(([id]) => id === after) + 1);
      return { docs: rows.slice(0, limit).map(([id, row]) => ({ id, data: () => row })) };
    },
  });
  return {
    default: {},
    dbAdmin: {
      collection: (name: string) => ({ doc: (id: string) => docRef(name, id), ...query(name, [], null, null, 10_000) }),
      getAll: async (...refs: any[]) => Promise.all(refs.map((ref) => ref.get())),
    },
  };
});

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async (res: express.Response) => res.locals.firebaseUser?.admin === true,
}));

vi.mock("../utils/field-encryption", () => ({
  decryptFieldValue: async (value: string) => value,
  decryptInboundRequestForAdmin: async (record: Row) => ({ ...record,
    contact: { company: record.contact?.company ?? "" },
    request: { ...record.request, siteName: record.request?.siteName, siteLocation: record.request?.siteLocation } }),
}));

vi.mock("../utils/robotCheckpoints", () => ({
  listCheckpoints: async (teamId: string) => state.checkpoints.filter((checkpoint) => checkpoint.teamId === teamId),
}));

function siteJob(id: string, createdAt: string, extra: Row = {}) {
  table("inboundRequests").set(id, {
    createdAt, account_owner_uid: `owner-${id}`,
    request: { buyerType: "site_operator", siteName: `Site ${id}`, siteLocation: "Austin, TX",
      consent_attestation: { granted: true } },
    contact: { company: "Acme" },
    capture_coverage: { covers_scene: true },
    public_task_listing: { enabled: true },
    ...extra,
  });
}

async function start() {
  const { default: router } = await import("../routes/admin-job-console");
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    res.locals.firebaseUser = auth === "Bearer admin" ? { uid: "admin", admin: true }
      : auth === "Bearer user" ? { uid: "user" } : null;
    next();
  });
  app.use("/api/admin/jobs", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/api/admin/jobs` };
}

let server: Server;
let baseUrl: string;
beforeEach(async () => {
  state.collections.clear();
  state.checkpoints.length = 0;
  ({ server, baseUrl } = await start());
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.resetModules();
});

const admin = { headers: { Authorization: "Bearer admin" } };

describe("GET /api/admin/jobs", () => {
  it("requires authentication", async () => {
    expect((await fetch(baseUrl)).status).toBe(401);
  });

  it("requires an admin or ops role", async () => {
    expect((await fetch(baseUrl, { headers: { Authorization: "Bearer user" } })).status).toBe(403);
  });

  it("returns one row per site job with its stage, skipping evaluation requests and other leads", async () => {
    siteJob("job-a", "2026-10-02T00:00:00.000Z");
    siteJob("job-b", "2026-10-01T00:00:00.000Z", { public_task_listing: null });
    table("inboundRequests").set("eval-1", { createdAt: "2026-10-03T00:00:00.000Z", account_owner_uid: "team-owner",
      request: { buyerType: "robot_team" }, workspace_evaluation: { opportunityId: "job-a", setupId: "setup-1", setupName: "Arm v2" } });
    table("inboundRequests").set("lead-1", { createdAt: "2026-10-04T00:00:00.000Z", request: { buyerType: "robot_team" } });
    table("robotTeams").set("team-1", { name: "Atlas", accountUid: "team-owner" });

    const response = await fetch(baseUrl, admin);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.jobs.map((job: Row) => job.requestId)).toEqual(["job-a", "job-b"]);
    expect(body.jobs[0]).toMatchObject({ siteName: "Site job-a", siteLocation: "Austin, TX", company: "Acme",
      stage: "admission", nextAction: "Admit evaluation for Atlas", actionOwner: "blueprint",
      evaluations: { total: 1, pendingAdmission: 1, admitted: 0 } });
    expect(body.jobs[1]).toMatchObject({ stage: "listing", actionOwner: "site" });
    expect(body.nextCursor).toBeNull();
    expect(body.stages).toContain("recommend");
  });

  it("filters by stage and searches by site name", async () => {
    siteJob("job-a", "2026-10-02T00:00:00.000Z");
    siteJob("job-b", "2026-10-01T00:00:00.000Z", { public_task_listing: null });
    const byStage = await (await fetch(`${baseUrl}?stage=listing`, admin)).json();
    expect(byStage.jobs.map((job: Row) => job.requestId)).toEqual(["job-b"]);
    const bySearch = await (await fetch(`${baseUrl}?q=${encodeURIComponent("site JOB-A")}`, admin)).json();
    expect(bySearch.jobs.map((job: Row) => job.requestId)).toEqual(["job-a"]);
  });

  it("paginates with a cursor", async () => {
    siteJob("job-a", "2026-10-03T00:00:00.000Z");
    siteJob("job-b", "2026-10-02T00:00:00.000Z");
    siteJob("job-c", "2026-10-01T00:00:00.000Z");
    const first = await (await fetch(`${baseUrl}?limit=2`, admin)).json();
    expect(first.jobs.map((job: Row) => job.requestId)).toEqual(["job-a", "job-b"]);
    expect(first.nextCursor).toBe("job-b");
    const second = await (await fetch(`${baseUrl}?limit=2&cursor=${first.nextCursor}`, admin)).json();
    expect(second.jobs.map((job: Row) => job.requestId)).toEqual(["job-c"]);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects an unknown stage and an oversized page", async () => {
    expect((await fetch(`${baseUrl}?stage=paid`, admin)).status).toBe(400);
    expect((await fetch(`${baseUrl}?limit=500`, admin)).status).toBe(400);
  });
});

describe("GET /api/admin/jobs/:requestId", () => {
  it("requires an admin or ops role", async () => {
    siteJob("job-a", "2026-10-02T00:00:00.000Z");
    expect((await fetch(`${baseUrl}/job-a`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/job-a`, { headers: { Authorization: "Bearer user" } })).status).toBe(403);
  });

  it("returns 404 for a missing job or a non-site record", async () => {
    table("inboundRequests").set("eval-1", { request: { buyerType: "robot_team" }, workspace_evaluation: { opportunityId: "x" } });
    expect((await fetch(`${baseUrl}/missing`, admin)).status).toBe(404);
    expect((await fetch(`${baseUrl}/eval-1`, admin)).status).toBe(404);
  });

  it("lists evaluation requests with the team, setup reference and matching checkpoints", async () => {
    siteJob("job-a", "2026-10-02T00:00:00.000Z");
    table("inboundRequests").set("eval-1", { createdAt: "2026-10-03T00:00:00.000Z", account_owner_uid: "team-owner",
      request: { buyerType: "robot_team" }, workspace_evaluation: { opportunityId: "job-a", setupId: "setup-1", setupName: "Arm v2",
        submittedAt: "2026-10-03T00:00:00.000Z" } });
    table("inboundRequests").set("eval-2", { createdAt: "2026-10-04T00:00:00.000Z", account_owner_uid: "no-team",
      request: { buyerType: "robot_team" }, workspace_evaluation: { opportunityId: "job-a", setupId: "setup-9" } });
    table("robotTeams").set("team-1", { name: "Atlas", accountUid: "team-owner", status: "applied" });
    table("users/team-owner/robotSetups").set("setup-1", { payload: JSON.stringify({ name: "Arm v2", reference: "https://policy.example.com/v2" }) });
    state.checkpoints.push(
      { checkpointId: "ckpt_1", teamId: "team-1", label: "v2", runtime: "policy_endpoint", reference: "https://policy.example.com/v2", status: "registered" },
      { checkpointId: "ckpt_old", teamId: "team-1", label: "v1", runtime: "policy_endpoint", reference: "https://policy.example.com/v1", status: "registered" },
    );

    const response = await fetch(`${baseUrl}/job-a`, admin);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.job).toMatchObject({ requestId: "job-a", stage: "admission" });
    expect(body.admissionDefaults).toMatchObject({ episodes: 50, sponsorCapUsd: 20, maxSponsorCapUsd: 20,
      maxAttempts: 1, evidenceScope: "development_only" });
    expect(body.links).toEqual({ lead: "/admin/leads/job-a", recommendation: "/admin/robot-team-access?job=job-a" });
    const [ready, blocked] = body.admissions;
    expect(ready).toMatchObject({ evaluationRequestId: "eval-1", admitted: false, team: { teamId: "team-1", name: "Atlas" },
      setup: { setupId: "setup-1", name: "Arm v2", reference: "https://policy.example.com/v2", missing: false },
      matchingCheckpoints: [{ checkpointId: "ckpt_1", label: "v2", runtime: "policy_endpoint", status: "registered" }], blockers: [] });
    expect(blocked.blockers).toEqual([
      "The requesting account has no bound robot team.",
      "The team removed or never saved the setup this request names.",
    ]);
    expect(body.timeline.map((entry: Row) => entry.key)).toContain("admitted");
  });
});
