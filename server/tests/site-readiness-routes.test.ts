// @vitest-environment node
/**
 * The readiness routes over HTTP: the owner's read on the private link, the
 * printable brief by its own read-only link, and the staff preview beside
 * robot fit. What this pins is the route's side: owner link only, nothing for
 * the site to save, a brief link that reads and opens nothing else, the report
 * only while shared, and withdrawn consent closing both links like every other
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
const { createReadinessBriefToken } = await import("../utils/readinessBriefToken");

const NOW = "2026-10-20T12:00:00.000Z";
let server: Server;
let base: string;

function seed(extra: Record<string, unknown> = {}) {
  sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: { buyerType: "site_operator" },
    site_task_scope: { supported: true, kind: "rigid_pick_and_place", reason: null },
    site_video_evidence: { status: "analysed", footage_status: "usable", measured_cycle_seconds: 60, people_relationship_to_work: null },
    walkthrough_job_estimates: { capture_id: "walkthrough-job-1", reviewed_at_iso: NOW,
      job_estimates: { pick_to_place_m: 0.9, object_mass_kg_low: 1, object_mass_kg_high: 2 } }, ...extra });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", { requestId: "job-1", summary: "Sort parcels onto outbound chutes", confirmedAtIso: NOW });
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
const brief = (briefToken: string) => fetch(`${base}/site-task-brief/readiness-brief/${encodeURIComponent(briefToken)}`);

describe("the owner's readiness read", () => {
  it("returns where the job stands and a read-only brief link, with no report until shared", async () => {
    seed();
    const response = await readiness();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["briefPath", "ok", "report", "summary", "tracker"]);
    expect(body).toMatchObject({ ok: true, summary: "Sort parcels onto outbound chutes", report: null });
    expect(body.briefPath).toMatch(/^\/readiness-brief\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(body.briefPath).not.toContain(token("owner"));
    expect(body.tracker.steps[0]).toMatchObject({ id: "video", state: "done" });
    expect((await readiness("film")).status).toBe(403);
    expect((await fetch(`${base}/site-task-brief/not-a-token/readiness`)).status).toBe(404);
  });

  it("has nothing for the site to fill in", async () => {
    seed();
    const saved = await fetch(`${base}/site-task-brief/${token("owner")}/operations`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ timesPerDay: 120 }) });
    expect(saved.status).toBe(404);
    expect(sharedFakeFirestoreState.docs.has("siteTaskOperations/job-1")).toBe(false);
  });

  it("closes once recording consent is withdrawn", async () => {
    seed({ capture_rights: { consent_revoked: true } });
    const response = await readiness();
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("capture_processing_not_authorized");
  });
});

describe("the printable brief's own link", () => {
  it("reads what the owner's read shows, and the report once shared, without minting another link", async () => {
    seed();
    const briefPath = (await (await readiness()).json()).briefPath as string;
    const unshared = await brief(briefPath.split("/").pop()!);
    expect(unshared.status).toBe(200);
    expect(await unshared.json()).toMatchObject({ ok: true, summary: "Sort parcels onto outbound chutes", report: null, briefPath: null });
    sharedFakeFirestoreState.docs.set("siteRobotFit/job-1", { sharing: { shared: true, changedAtIso: NOW, changedBy: "admin" } });
    const shared = await (await brief(createReadinessBriefToken("job-1"))).json();
    expect(shared.report.robotFit.forms).toHaveLength(6);
    expect(shared.report.robotFit.needs).toContain("It can work from one place: the object moves about 90 cm (estimated from your video).");
  });

  it("opens nothing else, and nothing else opens it", async () => {
    seed();
    const briefToken = createReadinessBriefToken("job-1");
    for (const path of [`${briefToken}/readiness`, `${briefToken}/robot-fit`, briefToken]) {
      expect((await fetch(`${base}/site-task-brief/${path}`)).status, path).toBe(404);
    }
    const confirm = await fetch(`${base}/site-task-brief/${briefToken}/confirm`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    expect(confirm.status).toBeGreaterThanOrEqual(400);
    expect((await brief(token("owner"))).status).toBe(404);
    expect((await brief(createReadinessBriefToken("job-1", -60))).status).toBe(404);
    expect((await brief(`${briefToken}x`)).status).toBe(404);
  });

  it("closes once recording consent is withdrawn", async () => {
    seed({ capture_rights: { consent_revoked: true } });
    const response = await brief(createReadinessBriefToken("job-1"));
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
    expect(Object.keys(body.readiness)).toEqual(["report"]);
    expect(body.readiness.report.checklist.map((entry: { id: string }) => entry.id))
      .toEqual(["floor_space", "standing_spot", "power_network", "safe_zone"]);
    expect(body.readiness.report.examples.map((entry: { id: string }) => entry.id)).toEqual(["parcel-sorting"]);
  });
});
