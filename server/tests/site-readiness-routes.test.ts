// @vitest-environment node
/**
 * The readiness routes over HTTP: the owner's read and how-the-job-runs save on
 * the private link, and the staff preview beside robot fit. What this pins is
 * the route's side: owner link only, strict whole-number answers, the report
 * only while shared, and withdrawn consent closing the link like every other
 * capture-derived read.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});
vi.mock("../utils/access-control", () => ({
  hasAnyRole: async (res: express.Response) => res.locals.firebaseUser?.admin === true,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/captureOutbox", () => ({
  enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));
vi.mock("../utils/siteWalkthrough", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/siteWalkthrough")>()),
  savedWalkthrough: async () => ({ received: true }),
}));

const { default: adminRouter } = await import("../routes/admin-job-console");
const { default: briefRouter } = await import("../routes/site-task-brief");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

const NOW = "2026-10-20T12:00:00.000Z";
let server: Server;
let base: string;

function seed(extra: Record<string, unknown> = {}) {
  sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: { buyerType: "site_operator" },
    site_task_scope: { supported: true, kind: "rigid_pick_and_place", reason: null },
    site_video_evidence: { status: "analysed", footage_status: "usable", measured_cycle_seconds: 60, people_relationship_to_work: null }, ...extra });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", { requestId: "job-1", summary: "Pack finished parts into cartons", confirmedAtIso: NOW });
}

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.firebaseUser = req.headers.authorization === "Bearer admin" ? { uid: "admin-1", admin: true } : null;
    next();
  });
  app.use("/api/admin/jobs", adminRouter);
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const token = (scope: "owner" | "film") => createCaptureUploadToken({ requestId: "job-1", captureId: "walkthrough-job-1", sceneId: "site-job-1", scope });
const readiness = (scope: "owner" | "film" = "owner") => fetch(`${base}/site-task-brief/${token(scope)}/readiness`);
const saveOperations = (body: unknown, scope: "owner" | "film" = "owner") => fetch(`${base}/site-task-brief/${token(scope)}/operations`, {
  method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("the owner's readiness read", () => {
  it("returns the tracker, next things and what the job takes, with no report until shared", async () => {
    seed();
    const response = await readiness();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, summary: "Pack finished parts into cartons", report: null, workload: null,
      speed: { state: "needs_target" } });
    expect(body.tracker.steps[0]).toMatchObject({ id: "video", state: "done" });
    expect(body.nextThings.map((entry: { id: string }) => entry.id)).toEqual(["measure_distance", "times_per_day", "weigh_object"]);
    expect((await readiness("film")).status).toBe(403);
    expect((await fetch(`${base}/site-task-brief/not-a-token/readiness`)).status).toBe(404);
  });

  it("saves how the job runs, turns it into hours, and refuses what is not a whole-number answer", async () => {
    seed();
    const saved = await saveOperations({ timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared" });
    expect(saved.status).toBe(200);
    expect((await saved.json()).operations).toMatchObject({ timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared" });
    expect(sharedFakeFirestoreState.docs.get("siteTaskOperations/job-1")).toMatchObject({ savedByScope: "owner", timesPerDay: 120 });
    const body = await (await readiness()).json();
    expect(body.workload).toMatchObject({ hoursPerDay: 2, hoursPerWeek: 10 });
    for (const bad of [{ timesPerDay: 1.5, daysPerWeek: null, peopleNearby: null }, { timesPerDay: 10, daysPerWeek: 8, peopleNearby: null },
      { timesPerDay: 10, daysPerWeek: null, peopleNearby: "everyone" }, { timesPerDay: 10 }]) {
      const refused = await saveOperations(bad);
      expect(refused.status).toBe(400);
      expect((await refused.json()).code).toBe("operations_invalid");
    }
    expect((await saveOperations({ timesPerDay: 1, daysPerWeek: null, peopleNearby: null }, "film")).status).toBe(403);
  });

  it("closes once recording consent is withdrawn", async () => {
    seed({ capture_rights: { consent_revoked: true } });
    const response = await readiness();
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("capture_processing_not_authorized");
  });
});

describe("staff preview", () => {
  it("shows the whole report as the site would see it, before it is shared", async () => {
    seed();
    const response = await fetch(`${base}/admin/jobs/job-1/robot-fit`, { headers: { Authorization: "Bearer admin" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sharing).toBeNull();
    expect(body.readiness.report.checklist.map((entry: { id: string }) => entry.id))
      .toEqual(["floor_space", "standing_spot", "power_network", "safe_zone", "object_arrival"]);
    expect(body.readiness.report.examples.map((entry: { id: string }) => entry.id)).toEqual(["line-side-packing"]);
    expect(body.readiness.speed.state).toBe("needs_target");
  });
});
