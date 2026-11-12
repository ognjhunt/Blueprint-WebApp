// @vitest-environment node
/**
 * Robot fit over HTTP: the console's admin routes. What this pins is the
 * route's side: admins only, a ranking runs one model task and keeps its
 * result, and withdrawn consent refuses a ranking. Nothing here reaches the
 * site: the readiness report and its sharing were removed on 2026-11-12.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const runtime = vi.hoisted(() => ({ runAgentTask: vi.fn() }));

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
vi.mock("../agents/runtime", () => ({ runAgentTask: runtime.runAgentTask }));

const { default: adminRouter } = await import("../routes/admin-job-console");

const NOW = "2026-10-20T12:00:00.000Z";
const NOTE = "Task: Mixed-case palletizing. Delivery/evidence: cobots stacking sealed cartons onto pallets for named customers.";

let server: Server;
let base: string;

function seed(extra: Record<string, unknown> = {}) {
  sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1",
    request: { buyerType: "site_operator", siteTaskSpec: { humanProximity: "shared" } },
    site_task_scope: { supported: true, kind: "rigid_pick_and_place", reason: null }, ...extra });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/job-1", { requestId: "job-1", summary: "Move sealed cartons onto a pallet" });
  sharedFakeFirestoreState.docs.set("siteTaskMeasurements/job-1", { requestId: "job-1", family: "rigid_pick_place",
    articulation: null, referencePaper: null, measuredBy: null, note: null, revision: 1, updatedAtIso: NOW, readings: {
      pick_to_place_distance: { value: 80, unit: "cm", si: 0.8, basis: "tape", recordedAtIso: NOW, recordedByScope: "owner", recordedByName: null },
      object_mass: { value: 5, unit: "kg", si: 5, basis: "scale", recordedAtIso: NOW, recordedByScope: "owner", recordedByName: null },
    } });
  sharedFakeFirestoreState.docs.set("robotTeams/pallet-co", { id: "pallet-co", name: "Pallet Co", status: "prospect",
    capability: {}, fieldProvenance: {}, capabilityDescription: NOTE, createdAt: NOW, updatedAt: NOW });
}

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  runtime.runAgentTask.mockReset();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    res.locals.firebaseUser = auth === "Bearer admin" ? { uid: "admin-1", admin: true }
      : auth === "Bearer user" ? { uid: "user" } : null;
    next();
  });
  app.use("/api/admin/jobs", adminRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const admin = { Authorization: "Bearer admin", "content-type": "application/json" };
const post = (path: string, body: unknown, headers: Record<string, string> = admin) =>
  fetch(`${base}/admin/jobs/job-1/robot-fit${path}`, { method: "POST", headers, body: JSON.stringify(body) });
describe("admin robot fit", () => {
  it("is for admins only", async () => {
    seed();
    expect((await fetch(`${base}/admin/jobs/job-1/robot-fit`, { headers: { Authorization: "Bearer user" } })).status).toBe(403);
    expect((await post("/ranking", {}, { Authorization: "Bearer user", "content-type": "application/json" })).status).toBe(403);
    expect(runtime.runAgentTask).not.toHaveBeenCalled();
  });

  it("reads the live ratings, and 404s an unknown job", async () => {
    seed();
    const response = await fetch(`${base}/admin/jobs/job-1/robot-fit`, { headers: admin });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.job.forms.map((entry: { id: string; verdict: string }) => [entry.id, entry.verdict])).toEqual([
      ["fixed_base_arm", "fits"], ["bimanual_arm", "fits"], ["mobile_manipulator", "fits"], ["wheeled_humanoid", "fits"],
      ["humanoid", "fits"], ["legged_manipulator", "fits"]]);
    expect(body.job.needs).toContain("It has to work safely alongside people in the same space (you told us).");
    expect(body).toMatchObject({ ranking: null, lastAttempt: null, consentRevoked: false });
    // The readiness report and its site preview are gone (2026-11-12): nothing here is for the site.
    expect(body).not.toHaveProperty("site");
    expect(body).not.toHaveProperty("readiness");
    expect((await fetch(`${base}/admin/jobs/nope/robot-fit`, { headers: admin })).status).toBe(404);
  });

  it("runs one ranking task, keeps the quote-checked result and reports it current", async () => {
    seed();
    runtime.runAgentTask.mockResolvedValue({ status: "completed", provider: "openai_responses", model: "m", output: {
      ranked: [{ teamId: "pallet-co", fit: "strong", form: "fixed_base_arm", concerns: ["Region not stated."],
        reasons: [{ claim: "Palletizes sealed cartons", quote: "cobots stacking sealed cartons onto pallets" }] }] } });
    const response = await post("/ranking", {});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ attempt: { state: "ranked", by: "admin-1" },
      ranking: { rankedBy: "admin-1", teams: [{ teamId: "pallet-co", fit: "strong" }] } });
    expect(runtime.runAgentTask).toHaveBeenCalledWith(expect.objectContaining({ kind: "robot_fit_ranking" }));
    const read = await (await fetch(`${base}/admin/jobs/job-1/robot-fit`, { headers: admin })).json();
    expect(read).toMatchObject({ ranking: { stale: false }, lastAttempt: { state: "ranked" } });
  });

  it("refuses ranking once consent is withdrawn, and has no sharing route", async () => {
    seed({ capture_rights: { consent_revoked: true } });
    const ranking = await post("/ranking", {});
    expect(ranking.status).toBe(409);
    expect((await ranking.json()).code).toBe("consent_revoked");
    expect(runtime.runAgentTask).not.toHaveBeenCalled();
    expect((await post("/sharing", { shared: true })).status).toBe(404);
  });

});

