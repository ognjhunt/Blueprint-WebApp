// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";

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
    // A team's request stays on record, counted, but no longer asks the operator to admit it (2026-11-12).
    expect(body.jobs[0]).toMatchObject({ siteName: "Site job-a", siteLocation: "Austin, TX", company: "Acme",
      evaluations: { total: 1, pendingAdmission: 1, admitted: 0 } });
    expect(body.jobs[0].stage).not.toBe("admission");
    expect(body.stages).not.toContain("admission");
    expect(body.jobs[1]).toMatchObject({ stage: "listing", actionOwner: "site" });
    expect(body.nextCursor).toBeNull();
    expect(body.stages).toContain("passing_run");
  });

  it("reads Blueprint's own scene as the job page does, only for a job with footage", async () => {
    siteJob("job-scene", "2026-10-02T00:00:00.000Z");
    table("captureUploadSessions").set("walkthrough-job-scene", { status: "uploaded" });
    table("taskEvaluationSceneIntakes").set("intake-1", { website_request_id: "job-scene",
      source_session_id: "walkthrough-job-scene", state: "accepted", created_at_iso: "2026-10-02T01:00:00.000Z" });
    // No footage: its scene intake is never read.
    siteJob("job-plain", "2026-10-01T00:00:00.000Z");
    table("taskEvaluationSceneIntakes").set("intake-2", { website_request_id: "job-plain",
      source_session_id: "walkthrough-job-plain", state: "accepted", created_at_iso: "2026-10-01T01:00:00.000Z" });

    const body = await (await fetch(baseUrl, admin)).json();
    const rows = Object.fromEntries(body.jobs.map((job: Row) => [job.requestId, job]));
    expect(rows["job-scene"]).toMatchObject({ stage: "scene_preparation", actionOwner: "none",
      nextAction: "Pipeline is preparing the scene",
      scene: { state: "in_progress", heldReason: null, progressOutcome: null, ending: null } });
    expect(rows["job-plain"].scene).toBeNull();
    expect(body.stages).toEqual(expect.arrayContaining(["scene_preparation", "screening", "estimate", "held", "ended"]));
  });

  it("filters by stage and searches by site name", async () => {
    // A card under the older statement is not shared (2026-11-12): the site's next step is to accept the current one.
    siteJob("job-a", "2026-10-02T00:00:00.000Z", { public_task_listing: { enabled: true, consentVersion: "public-task-card-v1",
      approvedAtIso: "2026-10-02T00:00:00.000Z", details: anonymizedOpportunityDraft("Pack cartons into totes") } });
    siteJob("job-b", "2026-10-01T00:00:00.000Z", { public_task_listing: null, operator_listing_hold: { held: true } });
    const byStage = await (await fetch(`${baseUrl}?stage=listing`, admin)).json();
    expect(byStage.jobs.map((job: Row) => [job.requestId, job.nextAction])).toEqual([
      ["job-a", "Not shared: waiting on site to accept the current statement on its job page"],
      ["job-b", "Shown to no company: Blueprint stopped showing this job (Deployment companies, below)"]]);
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

  it("returns the job, its timeline and its links, and no admission of a team's run (2026-11-12)", async () => {
    siteJob("job-a", "2026-10-02T00:00:00.000Z", { agent_execution_offer: { episode_count: 50 } });
    table("inboundRequests").set("eval-1", { createdAt: "2026-10-03T00:00:00.000Z", account_owner_uid: "team-owner",
      request: { buyerType: "robot_team" }, workspace_evaluation: { opportunityId: "job-a", setupId: "setup-1", setupName: "Arm v2",
        submittedAt: "2026-10-03T00:00:00.000Z" } });

    const response = await fetch(`${baseUrl}/job-a`, admin);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.job).toMatchObject({ requestId: "job-a" });
    expect(body.job.stage).not.toBe("admission");
    expect(body).not.toHaveProperty("admissions");
    expect(body).not.toHaveProperty("admissionDefaults");
    expect(body.links).toEqual({ lead: "/admin/leads/job-a", recommendation: "/admin/robot-team-access?job=job-a" });
    expect(body.timeline.map((entry: Row) => entry.key)).toContain("admitted");
  });


});
