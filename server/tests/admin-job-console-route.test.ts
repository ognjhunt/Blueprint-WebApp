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

/** The job's outlook, as the shared loader would decide it; the page only words its phase. */
const outlooks = vi.hoisted(() => ({ byId: new Map<string, unknown>() }));
vi.mock("../utils/jobOutlook", () => ({
  loadJobOutlook: async (requestId: string) => {
    const outlook = outlooks.byId.get(requestId);
    if (outlook instanceof Error) throw outlook;
    return outlook ?? { phase: "building", reason: null, sentence: null };
  },
}));
const companies = vi.hoisted(() => ({ panel: null as null | Record<string, unknown> }));
vi.mock("../utils/jobCompanies", () => ({ loadAdminJobCompanies: async () => companies.panel }));
vi.mock("../utils/siteAnswer", () => ({ loadSiteAnswer: async () => null }));

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async (res: express.Response) => res.locals.firebaseUser?.admin === true,
}));

vi.mock("../utils/field-encryption", () => ({
  decryptFieldValue: async (value: string) => value,
  decryptInboundRequestForAdmin: async (record: Row) => ({ ...record,
    contact: { company: record.contact?.company ?? "" },
    request: { ...record.request, siteName: record.request?.siteName, siteLocation: record.request?.siteLocation } }),
}));

function siteJob(id: string, createdAt: string, extra: Row = {}) {
  table("inboundRequests").set(id, {
    createdAt, account_owner_uid: `owner-${id}`,
    request: { buyerType: "site_operator", siteName: `Site ${id}`, siteLocation: "Austin, TX",
      consent_attestation: { granted: true } },
    contact: { company: "Acme" },
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
  outlooks.byId.clear();
  companies.panel = null;
  ({ server, baseUrl } = await start());
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.resetModules();
});

const admin = { headers: { Authorization: "Bearer admin" } };
const TEST_MARKER = { label: "mug to tray", footage_id: "f-1", created_by: "pipeline_sync_signature", created_at_iso: "2026-11-16T18:00:00.000Z" };

describe("GET /api/admin/jobs", () => {
  it("requires authentication", async () => {
    expect((await fetch(baseUrl)).status).toBe(401);
  });

  it("requires an admin or ops role", async () => {
    expect((await fetch(baseUrl, { headers: { Authorization: "Bearer user" } })).status).toBe(403);
  });

  it("returns one row per site job, newest first: its sentence or test label, the outlook's phase in words, when it was received", async () => {
    siteJob("job-a", "2026-10-02T00:00:00.000Z");
    siteJob("job-t", "2026-10-03T00:00:00.000Z", { internal_test: TEST_MARKER });
    siteJob("job-b", "2026-10-01T00:00:00.000Z");
    table("siteTaskBriefs").set("job-a", { summary: "Stack cartons onto the pallet." });
    table("inboundRequests").set("eval-1", { createdAt: "2026-10-04T00:00:00.000Z", request: { buyerType: "robot_team" },
      workspace_evaluation: { opportunityId: "job-a" } });
    outlooks.byId.set("job-t", { phase: "testing", reason: null, sentence: null });
    outlooks.byId.set("job-b", new Error("unreadable"));

    const response = await fetch(baseUrl, admin);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ nextCursor: null, jobs: [
      { requestId: "job-t", sentence: null, internalTest: { label: "mug to tray" }, phase: "testing", standing: "Simulation ready",
        receivedAtIso: "2026-10-03T00:00:00.000Z" },
      { requestId: "job-a", sentence: "Stack cartons onto the pallet.", internalTest: null, phase: "building",
        standing: "Building the simulation", receivedAtIso: "2026-10-02T00:00:00.000Z" },
      { requestId: "job-b", sentence: null, internalTest: null, phase: null, standing: "Could not read where it stands right now",
        receivedAtIso: "2026-10-01T00:00:00.000Z" },
    ] });
    // The list never carries the site's name, place or contact.
    expect(JSON.stringify(body)).not.toMatch(/Site job-|Austin|Acme/);
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

  it("has no stage filter or search, and rejects an oversized page", async () => {
    expect((await fetch(`${baseUrl}?stage=listing`, admin)).status).toBe(400);
    expect((await fetch(`${baseUrl}?q=dock`, admin)).status).toBe(400);
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

  it("returns a site's job: its sentence, name and place, the outlook, sharing, events, and nothing the page does not show", async () => {
    siteJob("job-a", "2026-10-02T00:00:00.000Z", { operator_listing_hold: { held: true, atIso: "2026-10-05T00:00:00.000Z", by: "ops", reason: "Checking" } });
    table("siteTaskBriefs").set("job-a", { summary: "Stack cartons onto the pallet.", confirmedAtIso: "2026-10-02T01:00:00.000Z" });
    table("captureOutbox").set("job-a:video_received", { createdAtIso: "2026-10-02T02:00:00.000Z" });
    outlooks.byId.set("job-a", { phase: "no_test", reason: "window_expired", sentence: "The time for this job ran out." });
    companies.panel = { sharing: { state: "shared_not_visible", words: "Shared, but not visible to companies right now: Blueprint stopped showing it.", reason: "blueprint_hold" },
      autoSend: { sentAtIso: "2026-10-03T00:00:00.000Z", count: 3 }, sends: [],
      responses: [{ companyId: "c1", company: "North Robotics", alias: "A", state: "interested", inputs: "x", updatedAtIso: "2026-10-04T00:00:00.000Z", recordedBy: "company" }],
      introductions: [] };

    const response = await fetch(`${baseUrl}/job-a`, admin);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["cost", "events", "job", "requestId", "scenePreviewViewUrl", "simulationPackage", "simulationPackageUrl", "standing", "stops"]);
    expect(body.scenePreviewViewUrl).toBeNull();
    expect(body.job).toEqual({ sentence: "Stack cartons onto the pallet.", drafted: false, site: { name: "Site job-a", place: "Austin, TX" }, internalTest: null });
    expect(body.standing).toEqual({ phase: "no_test", phrase: "Ended", siteSees: "The time for this job ran out.",
      companies: "Shared, but not visible to companies right now: Blueprint stopped showing it.", pipeline: null });
    expect(body.stops).toEqual([{ key: "blueprint-hold", whose: "blueprint", atIso: "2026-10-05T00:00:00.000Z",
      text: "Blueprint stopped showing this job to companies: Checking" }]);
    expect(body.events.map((event: Row) => event.text)).toEqual(["Job received", "Video received",
      "Shared with 3 approved deployment companies", "North Robotics answered: Interested"]);
    expect(body.simulationPackageUrl).toBeNull();
    expect(body.cost).toBeNull();
    // Nothing of the old console: no stage, gates, coverage, public card, ops notice, claim, links or runs.
    expect(JSON.stringify(body)).not.toMatch(/stage|gate|coverage|public card|opsNotice|claimed|recommendation|runs|timeline/i);
  });

  it("returns an internal test job with its label and no site, no sharing and no company reads", async () => {
    siteJob("job-t", "2026-11-16T18:00:00.000Z", { internal_test: TEST_MARKER });
    outlooks.byId.set("job-t", { phase: "testing", reason: null, sentence: null });
    companies.panel = { sharing: { words: "should not be read" } };
    const body = await (await fetch(`${baseUrl}/job-t`, admin)).json();
    expect(body.job).toEqual({ sentence: null, drafted: false, site: null, internalTest: { label: "mug to tray" } });
    expect(body.standing).toMatchObject({ phrase: "Simulation ready", companies: null });
    expect(body.stops).toEqual([]);
  });

  it("names only privacy, rights and money stops, each with whose step it is", async () => {
    siteJob("job-w", "2026-10-02T00:00:00.000Z", { request: { buyerType: "site_operator",
      consent_attestation: { granted: true, revoked_at_iso: "2026-10-06T00:00:00.000Z" } },
    capture_withdrawal: { state: "pipeline_acknowledged_cleanup_pending" } });
    table("opsWebsiteJobOverBudgetAlerts").set("job-w-safety-limit", { request_id: "job-w",
      safety_limit: { recorded_at_epoch: 1_791_000_000 } });
    const body = await (await fetch(`${baseUrl}/job-w`, admin)).json();
    expect(body.stops).toEqual([
      { key: "withdrawn", whose: "blueprint", atIso: "2026-10-06T00:00:00.000Z",
        text: "The site withdrew permission to use its video. The Pipeline has it; confirm the cleanup." },
      { key: "money-safety_limit", whose: "blueprint", atIso: new Date(1_791_000_000_000).toISOString(),
        text: "Spending was refused at this job's safety limit." },
    ]);
    expect(body.events.map((event: Row) => event.text)).toContain("Permission withdrawn by the site");
    expect(body.standing.companies).toBeNull();
  });

  it("counts what the job's ledgers hold, and leaves the part out for a job with none", async () => {
    siteJob("job-c", "2026-10-02T00:00:00.000Z", { website_preparation_reservations: {
      a: { admission: { maximum_cost_usd: 4 }, settlement: { actual_cost_usd: 1.25 } },
      b: { admission: { maximum_cost_usd: 2.5 } } } });
    const body = await (await fetch(`${baseUrl}/job-c`, admin)).json();
    expect(body.cost).toEqual({ spentOrHeldUsd: 3.75, unreadable: [] });
  });
});
