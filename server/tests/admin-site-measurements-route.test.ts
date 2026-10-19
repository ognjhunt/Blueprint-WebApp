// @vitest-environment node
/**
 * The job console's view of a site's measurements, and the source-document
 * export an operator retains as the qualification request's `measurement`.
 *
 * The export is read-only: it returns exact bytes and their sha256 and writes
 * nothing. It takes the request's binding as input because WebApp holds no
 * scene, task-spec, success-contract or robot-model digest before a run.
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

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: router } = await import("../routes/admin-job-console");
const { saveMeasurements } = await import("../utils/siteTaskMeasurements");

const SHA = (digit: string) => `sha256:${digit.repeat(64)}`;
const binding = (requestId: string) => ({
  scene_request_id: requestId, site_id: `site-${requestId}`, task_id: "task-1", capture_id: `walkthrough-${requestId}`,
  source_capture_digest: SHA("1"), testbed_digest_sha256: SHA("2"), scene_revision_digest: SHA("3"),
  task_spec_digest: SHA("4"), success_contract_digest: SHA("5"), robot_model_digest: SHA("6"),
  policy_interface_id: "blueprint_policy_https.v1",
});

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    res.locals.firebaseUser = auth === "Bearer admin" ? { uid: "admin", admin: true }
      : auth === "Bearer user" ? { uid: "user" } : null;
    next();
  });
  app.use("/api/admin/jobs", router);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/admin/jobs`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const admin = { Authorization: "Bearer admin", "content-type": "application/json" };

async function recordReadings() {
  await saveMeasurements("job-1", {
    revision: 0, family: "articulated_open_close", articulation: "sliding",
    readings: { handle_height: { value: 80, unit: "cm" }, opening_travel: { value: 45, unit: "cm" } },
    referencePaper: "none", referenceSheetLongEdge: null, measuredBy: "Sam", note: "Bottom drawer.",
  }, { scope: "film" }, new Date("2026-10-17T09:00:00.000Z"));
}

describe("GET /api/admin/jobs/:requestId/site-measurements", () => {
  it("is for admins only", async () => {
    expect((await fetch(`${baseUrl}/job-1/site-measurements`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/job-1/site-measurements`, { headers: { Authorization: "Bearer user" } })).status)
      .toBe(403);
  });

  it("says plainly when a job has no measurements", async () => {
    const response = await fetch(`${baseUrl}/job-1/site-measurements`, { headers: admin });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ measurements: null });
  });

  it("shows SI values, provenance and what the readings cannot fill", async () => {
    await recordReadings();
    const response = await fetch(`${baseUrl}/job-1/site-measurements`, { headers: admin });
    const { measurements } = await response.json();
    expect(measurements).toMatchObject({ family: "articulated_open_close", articulation: "sliding", revision: 1,
      note: "Bottom drawer." });
    expect(measurements.readings).toEqual([
      expect.objectContaining({ sampleId: "handle_height", si: 0.8, siUnit: "m", basis: "tape",
        recordedByScope: "film", recordedByName: "Sam" }),
      expect.objectContaining({ sampleId: "opening_travel", si: 0.45 }),
    ]);
    expect(measurements.coverage.missingDimensions).toEqual(["collision", "observation", "scale", "task_dynamics"]);
  });
});

describe("POST /api/admin/jobs/:requestId/site-measurements/source-document", () => {
  it("returns the exact bytes and their digest, and writes nothing", async () => {
    await recordReadings();
    const before = JSON.stringify([...sharedFakeFirestoreState.docs.entries()]);
    const response = await fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
      method: "POST", headers: admin,
      body: JSON.stringify({ binding: binding("job-1"), producerId: "site_job:job-1", calibrationSampleIds: [] }),
    });
    expect(response.status).toBe(200);
    const exported = await response.json();
    expect(exported.fileName).toBe("site-task-measurements-job-1-r1.json");
    expect(exported.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.parse(exported.json)).toMatchObject({ producer_id: "site_job:job-1",
      binding: { scene_request_id: "job-1" } });
    expect(exported.dimensionsWithoutSamples).toEqual(["collision", "observation", "scale", "task_dynamics"]);
    expect(JSON.stringify([...sharedFakeFirestoreState.docs.entries()])).toBe(before);
  });

  it("refuses a binding for another job", async () => {
    await recordReadings();
    const response = await fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
      method: "POST", headers: admin, body: JSON.stringify({ binding: binding("job-2"), producerId: "site_job:job-1" }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("binding_job_mismatch");
  });

  it("says when there is nothing to export", async () => {
    const response = await fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
      method: "POST", headers: admin, body: JSON.stringify({ binding: binding("job-1"), producerId: "site_job:job-1" }),
    });
    expect(response.status).toBe(404);
  });

  it("refuses a malformed body", async () => {
    const response = await fetch(`${baseUrl}/job-1/site-measurements/source-document`, {
      method: "POST", headers: admin, body: JSON.stringify({ binding: binding("job-1") }),
    });
    expect(response.status).toBe(400);
  });
});
