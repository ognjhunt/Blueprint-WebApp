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
vi.mock("../utils/ownerTotals", () => ({
  loadJobTotals: async () => ({ siteJobs: 2, siteJobsThisWeek: 1, withVideo: 1, shownToCompanies: 1, answered: 0,
    introductionsAsked: 0, introductionsMade: 0, outcomeAnswers: 0, billableEvents: 0 }),
  billableEventsCsv: async () => '"event_id"\r\n',
}));
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

describe("the owner's totals and billable events CSV", () => {
  it("are admin only and answer before the job detail route", async () => {
    expect((await fetch(`${baseUrl}/totals`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/billable-events.csv`, { headers: { Authorization: "Bearer user" } })).status).toBe(403);
    const totals = await fetch(`${baseUrl}/totals`, admin);
    expect(totals.status).toBe(200);
    expect(await totals.json()).toMatchObject({ siteJobs: 2, siteJobsThisWeek: 1 });
    const csv = await fetch(`${baseUrl}/billable-events.csv`, admin);
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(csv.headers.get("content-disposition")).toMatch(/attachment/);
  });
});

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
    table("captureUploadSessions").set("walkthrough-job-a", { browser_stored_upload: { completed_at_iso: "2026-10-02T02:00:00.000Z" } });
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
    expect(body.standing).toEqual({ phase: "no_test", phrase: "Ended; waiting on Blueprint: its hold on sharing", siteSees: "The time for this job ran out.",
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
    capture_withdrawal: { state: "pipeline_acknowledged_cleanup_pending", pipelineAcknowledged: true } });
    table("opsWebsiteJobOverBudgetAlerts").set("job-w-safety-limit", { request_id: "job-w",
      safety_limit: { recorded_at_epoch: 1_791_000_000 } });
    const body = await (await fetch(`${baseUrl}/job-w`, admin)).json();
    expect(body.stops).toEqual([
      { key: "withdrawn", whose: "blueprint", atIso: "2026-10-06T00:00:00.000Z",
        text: "The site withdrew permission to use its video. Website copies: not deleted yet. The Pipeline acknowledged it."
          + " Neither the site's mapped files on the Pipeline host nor its cloud scene folder is verified removed."
          + " Provider copies, delivered packages, launch runs and their evidence, and the archive are not verified removed." },
      { key: "money-safety_limit", whose: "blueprint", atIso: new Date(1_791_000_000_000).toISOString(),
        text: "Spending was refused at this job's safety limit." },
    ]);
    expect(body.events.map((event: Row) => event.text)).toContain("Permission withdrawn by the site");
    expect(body.standing.companies).toBeNull();
    expect(body.standing.phrase).toBe("Building the simulation; waiting on Blueprint: withdrawal cleanup, budget");
  });

  it("never rounds a withdrawal up: deletion confirmed still names the cleanup nobody has verified", async () => {
    siteJob("job-d", "2026-10-02T00:00:00.000Z", { request: { buyerType: "site_operator",
      consent_attestation: { granted: true, revoked_at_iso: "2026-10-06T00:00:00.000Z" } },
    // What `deriveWebsiteWithdrawalState` writes once the website deleted its copies and the Pipeline acknowledged.
    capture_withdrawal: { state: "deletion_confirmed", deletionConfirmed: true, pipelineAcknowledged: true,
      webappDeletion: { phase: "deleted" }, localCleanupVerified: true, cloudObjectAbsenceVerified: false,
      deliveredCopyCleanupVerified: false } });
    const [stop] = (await (await fetch(`${baseUrl}/job-d`, admin)).json()).stops;
    expect(stop.text).toBe("The site withdrew permission to use its video. Website copies: deleted. The Pipeline acknowledged it."
      + " The site's mapped files on the Pipeline host are verified removed; its cloud scene folder is not verified removed."
      + " Provider copies, delivered packages, launch runs and their evidence, and the archive are not verified removed.");
    expect(stop.whose).toBe("blueprint");
    expect(stop.text).not.toMatch(/Cleanup is confirmed/);
  });

  it("says only what the Pipeline's receipt verified: its host's mapped files and the cloud scene folder, nothing else", async () => {
    // The reviewer's case: the website deleted its copies and the Pipeline acknowledged with the full receipt
    // (`website_capture_withdrawal.py`: local cleanup and cloud absence verified, scope the mapped site files, external
    // cleanup still required). `deriveWebsiteWithdrawalState` calls that `deletionConfirmed`.
    siteJob("job-v", "2026-10-02T00:00:00.000Z", { request: { buyerType: "site_operator",
      consent_attestation: { granted: true, revoked_at_iso: "2026-10-06T00:00:00.000Z" } },
    capture_withdrawal: { state: "deletion_confirmed", deletionConfirmed: true, webappDeletion: { phase: "deleted" },
      pipelineAcknowledged: true, pipelineState: "local_cleanup_verified_external_pending", localCleanupVerified: true,
      cloudStorageCleanupVerified: false, cloudObjectAbsenceVerified: true, cloudObjectCurrentAbsenceStatus: "verified",
      deliveredCopyCleanupVerified: false, retainedAuditRecords: true, legalHold: false } });
    const [stop] = (await (await fetch(`${baseUrl}/job-v`, admin)).json()).stops;
    expect(stop).toEqual({ key: "withdrawn", whose: "blueprint", atIso: "2026-10-06T00:00:00.000Z",
      text: "The site withdrew permission to use its video. Website copies: deleted. The Pipeline acknowledged it."
        + " The site's mapped files on the Pipeline host and its cloud scene folder are verified removed."
        + " Provider copies, delivered packages, launch runs and their evidence, and the archive are not verified removed." });
    expect(stop.text).not.toMatch(/Pipeline's own copies|Cleanup is confirmed|Nothing is left/);
  });

  it("reads the video as in from the capture record, with its time, for an internal test job no email is ever sent for", async () => {
    siteJob("job-tv", "2026-11-16T18:00:00.000Z", { internal_test: TEST_MARKER });
    table("captureUploadSessions").set("walkthrough-job-tv", { browser_stored_upload: { completed_at_iso: "2026-11-16T18:03:00.000Z" } });
    outlooks.byId.set("job-tv", { phase: "reading", reason: null, sentence: null });
    const body = await (await fetch(`${baseUrl}/job-tv`, admin)).json();
    expect(body.standing.phrase).toBe("Reading the video");
    expect(body.events).toContainEqual({ key: "video", text: "Video received", atIso: "2026-11-16T18:03:00.000Z" });
    const row = (await (await fetch(baseUrl, admin)).json()).jobs.find((job: Row) => job.requestId === "job-tv");
    expect(row.standing).toBe("Reading the video");
  });

  it("reads a hold as a hold, and a job with no video as waiting for it, never as an ending or as reading", async () => {
    siteJob("job-h", "2026-10-03T00:00:00.000Z");
    siteJob("job-n", "2026-10-02T00:00:00.000Z");
    siteJob("job-r", "2026-10-01T00:00:00.000Z");
    table("captureUploadSessions").set("walkthrough-job-r", { site_capture_bundle: { recorded_at_iso: "2026-10-01T01:00:00.000Z" } });
    outlooks.byId.set("job-h", { phase: "no_test", reason: "scene_held", sentence: "Work on the simulation of your job is on hold." });
    outlooks.byId.set("job-n", { phase: "reading", reason: null, sentence: null });
    outlooks.byId.set("job-r", { phase: "reading", reason: null, sentence: null });
    const rows = (await (await fetch(baseUrl, admin)).json()).jobs.map((row: Row) => [row.requestId, row.standing]);
    expect(rows).toEqual([["job-h", "On hold"], ["job-n", "Waiting for the video"], ["job-r", "Reading the video"]]);
  });

  it("shows a cancelled introduction as cancelled, and each billable event as recorded or voided with no price", async () => {
    siteJob("job-i", "2026-10-02T00:00:00.000Z");
    companies.panel = { sharing: { words: "Shared and visible to approved companies." }, autoSend: null, sends: [], responses: [],
      introductions: [{ companyId: "c1", company: "North Robotics", alias: "A", requestedAtIso: "2026-10-03T00:00:00.000Z",
        cancelledAtIso: "2026-10-03T00:05:00.000Z", cancelReason: "company_withdrew", latestOutcome: null }],
      billableEvents: [
        { id: "b1", kind: "introduction", companyId: "c1", company: "North Robotics", atIso: "2026-10-03T00:00:00.000Z", priceUsd: null, status: "recorded_no_price" },
        { id: "b2", kind: "introduction", companyId: "c2", company: "South Robotics", atIso: "2026-10-04T00:00:00.000Z", priceUsd: null, status: "void" },
      ] };
    const body = await (await fetch(`${baseUrl}/job-i`, admin)).json();
    expect(body.events.map((event: Row) => event.text)).toEqual(["Job received", "The site asked to meet North Robotics",
      "Billable event recorded for the introduction to North Robotics",
      "The introduction to North Robotics was cancelled (company withdrew); emails not yet sent for it were cancelled",
      "Billable event for the introduction to South Robotics: voided"]);
    expect(JSON.stringify(body.events)).not.toMatch(/\$|USD|price/i);
  });

  it("counts what the job's ledgers hold, and leaves the part out for a job with none", async () => {
    siteJob("job-c", "2026-10-02T00:00:00.000Z", { website_preparation_reservations: {
      a: { admission: { maximum_cost_usd: 4 }, settlement: { actual_cost_usd: 1.25 } },
      b: { admission: { maximum_cost_usd: 2.5 } } } });
    const body = await (await fetch(`${baseUrl}/job-c`, admin)).json();
    expect(body.cost).toEqual({ spentOrHeldUsd: 3.75, unreadable: [] });
    siteJob("job-0", "2026-10-02T00:00:00.000Z");
    expect((await (await fetch(`${baseUrl}/job-0`, admin)).json()).cost).toBeNull();
  });

  it("counts only what can be read, and names what it left out, never a placeholder figure for it", async () => {
    siteJob("job-u", "2026-10-02T00:00:00.000Z", { website_preparation_reservations: {
      a: { admission: { maximum_cost_usd: 4 }, settlement: { actual_cost_usd: 1.25 } } } });
    // A trial run whose result record cannot be read: the ceiling counts a $30 placeholder for it; the page does not.
    table("taskEvaluationPolicyRuns").set("run-1", { run_kind: "beta_policy_screening", run_id: "run-1",
      result_record_id: "missing", job_evidence_binding: { job_id: "job-u" } });
    const body = await (await fetch(`${baseUrl}/job-u`, admin)).json();
    expect(body.cost).toEqual({ spentOrHeldUsd: 1.25, unreadable: ["screening result missing"] });
  });
});
